"use client";

import { useChat } from '@ai-sdk/react';
import type { Message } from '@ai-sdk/react';

export default function EnduranceDashboard() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-black">
      {/* Dashboard Header */}
      <header className="p-4 bg-gray-900 text-white shadow-md">
        <h1 className="text-xl font-bold">Endurance Ledger</h1>
        <p className="text-sm text-gray-400">System Active</p>
      </header>

      {/* Chat History */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
        {messages.length === 0 && (
          <div className="text-gray-500 text-center mt-10">
            Awaiting input. Log your workout or report physical status.
          </div>
        )}
        {messages.map((m: Message) => (
          <div key={m.id} className={`p-3 rounded-lg max-w-[80%] ${m.role === 'user' ? 'bg-blue-600 text-white self-end ml-auto' : 'bg-gray-200 text-black mr-auto'}`}>
            <span className="block font-bold text-xs opacity-75 mb-1">
              {m.role === 'user' ? 'Athlete' : 'System'}
            </span>
            {m.content}
          </div>
        ))}
      </main>

      {/* Input Form */}
      <div className="p-4 bg-white border-t border-gray-200">
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-4xl mx-auto">
          <input
            className="flex-1 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
            value={input}
            placeholder="Log a run, note fatigue, or request schedule adjustment..."
            onChange={handleInputChange}
          />
          <button type="submit" className="px-6 py-3 bg-gray-900 text-white rounded-md font-bold">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}