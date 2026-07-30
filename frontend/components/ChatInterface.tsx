/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface CapturedImage {
  data: string;
  mimeType: string;
}

interface DisplayMessage {
  role: "user" | "assistant";
  text: string;
  images?: CapturedImage[];
  toolsUsed?: string[];
  thinkingSteps?: string[];
  isLoading?: boolean;
}

interface ApiMessage {
  role: "user" | "assistant";
  content: string;
}

function formatToolsUsed(tools: string[]): string {
  if (tools.length === 1) return `Tools used: ${tools[0]}`;
  if (tools.length === 2) return `Tools used: ${tools[0]} and ${tools[1]}`;
  return `Tools used: ${tools.slice(0, -1).join(", ")}, and ${tools[tools.length - 1]}`;
}

export default function ChatInterface() {
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([]);
  const [apiHistory, setApiHistory] = useState<ApiMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 104) + "px";
  }, [input]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();

    const text = input.trim();
    if (!text || isLoading) return;

    const userApiMessage: ApiMessage = { role: "user", content: text };
    const updatedHistory = [...apiHistory, userApiMessage];

    setDisplayMessages((prev) => [
      ...prev,
      { role: "user", text },
      { role: "assistant", text: "", isLoading: true, thinkingSteps: [] },
    ]);
    setApiHistory(updatedHistory);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedHistory }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let event: Record<string, unknown>;
          try {
            event = JSON.parse(line.slice(6)) as Record<string, unknown>;
          } catch {
            continue;
          }

          if (event.type === "tool_call") {
            setDisplayMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              updated[updated.length - 1] = {
                ...last,
                thinkingSteps: [
                  ...(last.thinkingSteps ?? []),
                  event.label as string,
                ],
              };
              return updated;
            });
          } else if (event.type === "done") {
            const finalText = event.text as string;
            const images = event.images as CapturedImage[];
            const toolsUsed = event.tools_used as string[];

            setApiHistory((prev) => [
              ...prev,
              { role: "assistant", content: finalText },
            ]);
            setDisplayMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: "assistant",
                text: finalText,
                images,
                toolsUsed,
                isLoading: false,
              };
              return updated;
            });
          } else if (event.type === "error") {
            throw new Error(event.message as string);
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setDisplayMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          text: `Error: ${message}`,
          isLoading: false,
        };
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto p-4">
      <header className="py-4 border-b border-gray-200 dark:border-gray-700 mb-4">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          Web Insights
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Ask me to check uptime, fetch page metadata, or take a screenshot.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {displayMessages.length === 0 && (
          <div className="text-center text-gray-400 dark:text-gray-500 mt-16 space-y-2">
            <p className="text-lg">Try asking:</p>
            <p className="italic">&ldquo;Is example.com up?&rdquo;</p>
            <p className="italic">&ldquo;What is the title of github.com?&rdquo;</p>
            <p className="italic">&ldquo;Take a screenshot of news.ycombinator.com&rdquo;</p>
          </div>
        )}

        {displayMessages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
              }`}
            >
              {msg.isLoading ? (
                <div>
                  {msg.thinkingSteps && msg.thinkingSteps.length > 0 ? (
                    <div className="space-y-1">
                      {msg.thinkingSteps.map((step, j) => (
                        <p key={j} className="text-xs text-gray-500 dark:text-gray-400 flex items-start gap-1.5">
                          <span className="mt-px opacity-50">→</span>
                          <span>{step}</span>
                        </p>
                      ))}
                      <span className="flex gap-1 mt-2">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                      </span>
                    </div>
                  ) : (
                    <span className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    </span>
                  )}
                </div>
              ) : (
                <>
                  {msg.role === "user" ? (
                    <p className="whitespace-pre-wrap text-sm">{msg.text}</p>
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="text-sm mb-2 last:mb-0">{children}</p>,
                        h1: ({ children }) => <h1 className="text-base font-semibold mb-2 mt-1">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-sm font-semibold mb-1 mt-1">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 mt-1">{children}</h3>,
                        ul: ({ children }) => <ul className="text-sm list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
                        ol: ({ children }) => <ol className="text-sm list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
                        li: ({ children }) => <li>{children}</li>,
                        code: ({ children, className }) =>
                          className ? (
                            <code className="block bg-black/10 dark:bg-white/10 rounded p-2 overflow-x-auto text-xs font-mono my-2 whitespace-pre">{children}</code>
                          ) : (
                            <code className="bg-black/10 dark:bg-white/10 rounded px-1 text-xs font-mono">{children}</code>
                          ),
                        pre: ({ children }) => <pre className="my-0">{children}</pre>,
                        blockquote: ({ children }) => <blockquote className="border-l-2 border-current pl-3 opacity-70 my-2">{children}</blockquote>,
                        a: ({ href, children }) => <a href={href} className="underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        hr: () => <hr className="border-current opacity-30 my-3" />,
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  )}
                  {msg.images && msg.images.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {msg.images.map((img, j) => (
                        <img
                          key={j}
                          src={`data:${img.mimeType};base64,${img.data}`}
                          alt="Page screenshot"
                          className="rounded-lg w-full border border-gray-200 dark:border-gray-600"
                        />
                      ))}
                    </div>
                  )}
                  {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                    <p className="text-[11px] text-gray-400/50 dark:text-gray-500/50 mt-2 pt-1.5 border-t border-gray-200/40 dark:border-gray-600/40">
                      {formatToolsUsed(msg.toolsUsed)}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700"
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about any website..."
          disabled={isLoading}
          className="flex-1 resize-none overflow-y-auto rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
