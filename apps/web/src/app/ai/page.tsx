'use client';

import { useEffect, useRef, useState } from 'react';
import Sidebar from '@/components/navigation/Sidebar';
import MobileNav from '@/components/navigation/MobileNav';
import api from '@/lib/api';
import { Sparkles, Send, Loader2, Trash2 } from 'lucide-react';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  at: string;
}

export default function AiAssistantPage() {
  const [history, setHistory] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .get('/api/ai/chat/history')
      .then((r) => setHistory(r.data.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [history]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || sending) return;
    setSending(true);
    setInput('');
    try {
      const res = await api.post('/api/ai/chat', { message });
      setHistory(res.data.data.history || []);
    } catch {
      // ignore — could surface a toast
    } finally {
      setSending(false);
    }
  }

  async function clearHistory() {
    await api.delete('/api/ai/chat/history').catch(() => {});
    setHistory([]);
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 max-w-3xl mx-auto w-full p-4 md:p-6 pb-20 md:pb-6 flex flex-col">
        <header className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-brand-500" />
            <h1 className="text-2xl font-bold">AI Assistant</h1>
          </div>
          {history.length > 0 && (
            <button
              onClick={clearHistory}
              className="text-sm text-gray-500 hover:text-red-500 flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" /> Clear
            </button>
          )}
        </header>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 mb-4 min-h-[60vh]"
        >
          {history.length === 0 && (
            <div className="text-center text-gray-500 py-12">
              <Sparkles className="w-10 h-10 mx-auto mb-3 text-brand-400" />
              <p className="font-semibold">Your personal Ather AI</p>
              <p className="text-sm mt-1">
                Ask me to draft posts, summarize feeds, or suggest replies.
              </p>
            </div>
          )}
          {history.map((t, i) => (
            <div
              key={i}
              className={`flex mb-3 ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                  t.role === 'user'
                    ? 'bg-brand-500 text-white rounded-br-sm'
                    : 'bg-gray-100 dark:bg-gray-800 rounded-bl-sm'
                }`}
              >
                {t.content}
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={send} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything…"
            maxLength={4000}
            className="input flex-1"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="btn-primary px-4 flex items-center gap-2 disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send
          </button>
        </form>
      </main>
      <MobileNav />
    </div>
  );
}
