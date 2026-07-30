/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useRef, useEffect } from "react";

interface CapturedImage {
  data: string;
  mimeType: string;
}

/** Message shown in the UI — may include images for screenshot results. */
interface DisplayMessage {
  role: "user" | "assistant";
  text: string;
  images?: CapturedImage[];
  isLoading?: boolean;
}

/** Trimmed message sent to /api/chat — only role + text content. */
interface ApiMessage {
  role: "user" | "assistant";
  content: string;
}

export default function ChatInterface() {
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([]);
  const [apiHistory, setApiHistory] = useState<ApiMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();

    const text = input.trim();
    if (!text || isLoading) return;

    const userApiMessage: ApiMessage = { role: "user", content: text };
    const updatedHistory = [...apiHistory, userApiMessage];

    setDisplayMessages((prev) => [
      ...prev,
      { role: "user", text },
      { role: "assistant", text: "", isLoading: true },
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

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as {
        text: string;
        images: CapturedImage[];
        error?: string;
      };

      if (data.error) throw new Error(data.error);

      setApiHistory((prev) => [
        ...prev,
        { role: "assistant", content: data.text },
      ]);

      setDisplayMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          text: data.text,
          images: data.images,
          isLoading: false,
        };
        return updated;
      });
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
                <span className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                </span>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-sm">{msg.text}</p>
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
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about any website..."
          disabled={isLoading}
          className="flex-1 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
