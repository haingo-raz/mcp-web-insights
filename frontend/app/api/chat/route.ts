import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

export const runtime = "nodejs";
export const maxDuration = 120;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface CapturedImage {
  data: string;
  mimeType: string;
}

type SendFn = (event: object) => void;

async function createMcpClient(): Promise<Client> {
  const serverUrl = process.env.MCP_SERVER_URL;
  if (!serverUrl) throw new Error("MCP_SERVER_URL is not set");

  const client = new Client(
    { name: "web-frontend", version: "1.0.0" },
    { capabilities: {} }
  );
  await client.connect(new SSEClientTransport(new URL(`${serverUrl}/sse`)));
  return client;
}

function toolCallLabel(name: string, input: unknown): string {
  const args = input as Record<string, unknown>;
  const url = typeof args?.url === "string" ? args.url : null;
  return url ? `${name} → ${url}` : name;
}

async function executeToolCall(
  toolUse: Anthropic.Messages.ToolUseBlock,
  mcpClient: Client,
  images: CapturedImage[],
  toolsUsed: string[],
  send: SendFn
): Promise<Anthropic.Messages.ToolResultBlockParam> {
  send({ type: "tool_call", label: toolCallLabel(toolUse.name, toolUse.input) });
  toolsUsed.push(toolUse.name);

  const result = await mcpClient.callTool({
    name: toolUse.name,
    arguments: toolUse.input as Record<string, unknown>,
  });

  const content = result.content as Array<{ type: string; text?: string }>;
  const rawText =
    content.length > 0 && content[0].type === "text"
      ? (content[0].text ?? "")
      : JSON.stringify(content);

  if (toolUse.name === "screenshot_url") {
    const parsed = JSON.parse(rawText) as {
      screenshot_base64?: string;
      error?: string;
    };

    if (parsed.screenshot_base64) {
      images.push({ data: parsed.screenshot_base64, mimeType: "image/png" });
      return {
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: parsed.screenshot_base64,
            },
          },
        ],
      };
    }

    return {
      type: "tool_result",
      tool_use_id: toolUse.id,
      content: [{ type: "text", text: parsed.error ?? "Screenshot failed" }],
    };
  }

  return {
    type: "tool_result",
    tool_use_id: toolUse.id,
    content: [{ type: "text", text: rawText }],
  };
}

async function runAgentLoop(
  messages: Anthropic.Messages.MessageParam[],
  tools: Anthropic.Messages.Tool[],
  mcpClient: Client,
  images: CapturedImage[],
  toolsUsed: string[],
  send: SendFn
): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    tools,
    messages,
  });

  if (response.stop_reason !== "tool_use") {
    const textBlock = response.content.find((b) => b.type === "text");
    return textBlock?.type === "text" ? textBlock.text : "";
  }

  const toolUseBlocks = response.content.filter(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
  );

  const toolResults = await Promise.all(
    toolUseBlocks.map((tu) =>
      executeToolCall(tu, mcpClient, images, toolsUsed, send)
    )
  );

  return runAgentLoop(
    [
      ...messages,
      { role: "assistant", content: response.content },
      { role: "user", content: toolResults },
    ],
    tools,
    mcpClient,
    images,
    toolsUsed,
    send
  );
}

export async function POST(request: Request): Promise<Response> {
  const encoder = new TextEncoder();

  const body = new ReadableStream({
    async start(controller) {
      const send: SendFn = (event) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      };

      let mcpClient: Client | null = null;
      try {
        const { messages } = (await request.json()) as {
          messages: Anthropic.Messages.MessageParam[];
        };

        mcpClient = await createMcpClient();
        const { tools: mcpTools } = await mcpClient.listTools();

        const anthropicTools: Anthropic.Messages.Tool[] = mcpTools.map(
          (t) => ({
            name: t.name,
            description: t.description ?? "",
            input_schema:
              t.inputSchema as Anthropic.Messages.Tool["input_schema"],
          })
        );

        const images: CapturedImage[] = [];
        const toolsUsed: string[] = [];

        const text = await runAgentLoop(
          messages,
          anthropicTools,
          mcpClient,
          images,
          toolsUsed,
          send
        );

        send({
          type: "done",
          text,
          images,
          tools_used: [...new Set(toolsUsed)],
        });
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        await mcpClient?.close();
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
