'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/navigation/Sidebar';
import MobileNav from '@/components/navigation/MobileNav';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { MessageCircle, Send, Loader2, Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Message {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender?: { displayName: string; username: string };
}

interface Conversation {
  id: string;
  type: string;
  name?: string;
  participants: Array<{ id: string; displayName: string; username: string }>;
  lastMessage?: Message;
  unreadCount: number;
  updatedAt: string;
}

export default function MessagesPage() {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api
      .get('/api/messages/conversations')
      .then(({ data }) => setConversations(data.data || []))
      .catch(() => setConversations([]))
      .finally(() => setLoading(false));
  }, []);

  async function openConversation(convo: Conversation) {
    setActiveConvo(convo);
    try {
      const { data } = await api.get(`/api/messages/conversations/${convo.id}`);
      setMessages(data.data.messages || []);
    } catch {
      setMessages([]);
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !activeConvo) return;
    setSending(true);
    try {
      const { data } = await api.post(`/api/messages/conversations/${activeConvo.id}/messages`, {
        content: newMessage,
        type: 'text',
      });
      setMessages((prev) => [...prev, data.data]);
      setNewMessage('');
    } catch {
      // silent fail
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex h-screen overflow-hidden">
        {/* Conversation list */}
        <div className="w-full md:w-80 border-r border-gray-200 dark:border-gray-800 flex flex-col bg-white dark:bg-gray-900">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-bold mb-3">Messages</h2>
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations…"
                className="bg-transparent text-sm outline-none w-full"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 text-gray-400 p-6">
              <MessageCircle className="w-12 h-12 opacity-30" />
              <p className="text-sm text-center">No conversations yet</p>
            </div>
          ) : (
            <ul className="overflow-y-auto flex-1">
              {conversations.map((convo) => {
                // Pick the first participant who isn't the signed-in user.
                // Falls back to the first participant for self-only group rows.
                const other =
                  convo.participants.find((p) => p.id !== currentUserId) ||
                  convo.participants[0];
                return (
                  <li key={convo.id}>
                    <button
                      onClick={() => openConversation(convo)}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left ${
                        activeConvo?.id === convo.id ? 'bg-brand-50 dark:bg-brand-900/20' : ''
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {(convo.name || other?.displayName || 'G').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm truncate">
                            {convo.name || other?.displayName || 'Group'}
                          </p>
                          {convo.unreadCount > 0 && (
                            <span className="bg-brand-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center flex-shrink-0">
                              {convo.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 truncate">
                          {convo.lastMessage?.content || 'No messages yet'}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Message thread */}
        {activeConvo ? (
          <div className="hidden md:flex flex-col flex-1 bg-gray-50 dark:bg-gray-950">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold text-sm">
                {(activeConvo.name || activeConvo.participants[0]?.displayName || 'G').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-sm">
                  {activeConvo.name || activeConvo.participants[0]?.displayName || 'Group'}
                </p>
                <p className="text-xs text-gray-400">
                  {activeConvo.participants.length} participant{activeConvo.participants.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    {(msg.sender?.displayName || '?').charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">
                      {msg.sender?.displayName} ·{' '}
                      {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                    </p>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-2 text-sm max-w-md">
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={sendMessage}
              className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex gap-3"
            >
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message…"
                className="input flex-1"
                autoComplete="off"
              />
              <button type="submit" disabled={sending} className="btn-primary px-4">
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="hidden md:flex flex-col items-center justify-center flex-1 gap-4 text-gray-400">
            <MessageCircle className="w-16 h-16 opacity-20" />
            <p className="text-sm">Select a conversation to start messaging</p>
          </div>
        )}
      </main>
      <MobileNav />
    </div>
  );
}
