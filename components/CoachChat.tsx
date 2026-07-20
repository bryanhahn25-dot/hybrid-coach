"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { isToolUIPart, getToolName, type UIMessage } from "ai";
import { useRouter } from "next/navigation";

export default function CoachChat({ initialMessages }: { initialMessages: UIMessage[] }) {
  const router = useRouter();
  const { messages, sendMessage, status } = useChat({ messages: initialMessages });
  const [input, setInput] = useState("");

  const isBusy = status === "submitted" || status === "streaming";

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isBusy) return;
    setInput("");
    sendMessage({ text });
    // Tool calls in this turn may have adjusted the plan; refresh once it settles.
    setTimeout(() => router.refresh(), 1500);
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <h2 className="font-semibold text-sm">Coach</h2>
        <p className="text-xs text-neutral-500">Tell it how you&apos;re feeling — it can adjust your plan</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-neutral-500 text-center mt-8">
            e.g. &quot;I woke up sick, what should I do today?&quot;
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "bg-neutral-100 dark:bg-neutral-800"
              }`}
            >
              {m.parts.map((part, i) => {
                if (part.type === "text") return <span key={i}>{part.text}</span>;
                if (isToolUIPart(part)) {
                  return (
                    <div key={i} className="text-xs italic opacity-70 mt-1">
                      ↻ updated plan ({getToolName(part)})
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}
        {isBusy && <p className="text-xs text-neutral-400">Coach is thinking…</p>}
      </div>

      <form onSubmit={onSubmit} className="p-3 border-t border-neutral-200 dark:border-neutral-800 flex gap-2">
        <input
          className="flex-1 px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-neutral-400"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message your coach..."
        />
        <button
          type="submit"
          disabled={isBusy || !input.trim()}
          className="px-4 py-2 text-sm font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-md disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
