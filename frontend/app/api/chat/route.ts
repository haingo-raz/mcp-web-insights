import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

export const runtime = "nodejs";
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface CapturedImage {
  data: string;
  mimeType: string;
}

interface ChatResponse {
  text: string;
  images: CapturedImage[];
}

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

async function executeToolCall(
  toolUse: Anthropic.Messages.ToolUseBlock,
  mcpClient: Client,
  images: CapturedImage[]
): Promise<Anthropic.Messages.ToolResultBlockParam> {
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
      url?: string;
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
  images: CapturedImage[]
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
    toolUseBlocks.map((tu) => executeToolCall(tu, mcpClient, images))
  );

  return runAgentLoop(
    [
      ...messages,
      { role: "assistant", content: response.content },
      { role: "user", content: toolResults },
    ],
    tools,
    mcpClient,
    images
  );
}

export async function POST(request: Request): Promise<Response> {
  let mcpClient: Client | null = null;

  try {
    const { messages } = (await request.json()) as {
      messages: Anthropic.Messages.MessageParam[];
    };

    mcpClient = await createMcpClient();
    const { tools: mcpTools } = await mcpClient.listTools();

    const anthropicTools: Anthropic.Messages.Tool[] = mcpTools.map((t) => ({
      name: t.name,
      description: t.description ?? "",
      input_schema: t.inputSchema as Anthropic.Messages.Tool["input_schema"],
    }));

    const images: CapturedImage[] = [];
    const text = await runAgentLoop(messages, anthropicTools, mcpClient, images);

    return Response.json({ text, images } satisfies ChatResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  } finally {
    await mcpClient?.close();
  }
}
