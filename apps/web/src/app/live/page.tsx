'use client';

import { useState } from 'react';
import Sidebar from '@/components/navigation/Sidebar';
import MobileNav from '@/components/navigation/MobileNav';
import { Radio, Users, Heart, MessageCircle } from 'lucide-react';

// Demo live streams for UI showcase
const DEMO_STREAMS = [
  {
    id: '1',
    title: 'Morning music session 🎵',
    host: { displayName: 'Sarah Chen', username: 'sarahchen' },
    viewersCount: 1243,
    thumbnailColor: 'from-pink-400 to-red-500',
    tags: ['Music', 'Live'],
  },
  {
    id: '2',
    title: 'Coding a full-stack app from scratch',
    host: { displayName: 'DevMaster', username: 'devmaster' },
    viewersCount: 892,
    thumbnailColor: 'from-blue-400 to-indigo-600',
    tags: ['Tech', 'Coding'],
  },
  {
    id: '3',
    title: 'Photography tips & tricks',
    host: { displayName: 'LensStudio', username: 'lensstudio' },
    viewersCount: 567,
    thumbnailColor: 'from-amber-400 to-orange-500',
    tags: ['Art', 'Photography'],
  },
  {
    id: '4',
    title: 'Startup Q&A — Ask Me Anything',
    host: { displayName: 'Priya Patel', username: 'priyapatel' },
    viewersCount: 2103,
    thumbnailColor: 'from-green-400 to-teal-600',
    tags: ['Business', 'AMA'],
  },
];

export default function LivePage() {
  const [activeStream, setActiveStream] = useState<(typeof DEMO_STREAMS)[0] | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { id: '1', user: 'alex99', text: 'This is amazing! 🔥', time: '2:14 PM' },
    { id: '2', user: 'maria_k', text: 'Love this content!', time: '2:14 PM' },
    { id: '3', user: 'techfan', text: 'Great quality stream 👏', time: '2:15 PM' },
  ]);

  function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    setChatMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), user: 'You', text: chatMessage, time: 'Now' },
    ]);
    setChatMessage('');
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex overflow-hidden h-screen">
        {/* Stream list */}
        <div className="w-full md:w-auto md:flex-1 overflow-y-auto px-4 py-6 pb-24 md:pb-6">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <Radio className="w-6 h-6 text-red-500 animate-pulse" />
              <h1 className="text-2xl font-bold">Live Streams</h1>
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                LIVE
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {DEMO_STREAMS.map((stream) => (
                <button
                  key={stream.id}
                  onClick={() => setActiveStream(stream)}
                  className={`card overflow-hidden text-left transition-transform hover:scale-[1.01] ${
                    activeStream?.id === stream.id ? 'ring-2 ring-brand-500' : ''
                  }`}
                >
                  {/* Thumbnail */}
                  <div className={`h-40 bg-gradient-to-br ${stream.thumbnailColor} flex items-center justify-center relative`}>
                    <Radio className="w-12 h-12 text-white opacity-50" />
                    <div className="absolute top-3 left-3 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                      LIVE
                    </div>
                    <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {stream.viewersCount.toLocaleString()}
                    </div>
                  </div>

                  <div className="p-3">
                    <p className="font-semibold text-sm leading-snug mb-1 line-clamp-2">{stream.title}</p>
                    <p className="text-xs text-gray-500">{stream.host.displayName}</p>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {stream.tags.map((tag) => (
                        <span key={tag} className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live player + chat */}
        {activeStream && (
          <div className="hidden md:flex flex-col w-80 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            {/* Video placeholder */}
            <div className={`h-48 bg-gradient-to-br ${activeStream.thumbnailColor} flex items-center justify-center relative`}>
              <Radio className="w-10 h-10 text-white opacity-60" />
              <div className="absolute inset-0 flex items-end p-3">
                <div>
                  <p className="text-white font-semibold text-sm leading-snug">{activeStream.title}</p>
                  <p className="text-white/70 text-xs">{activeStream.host.displayName}</p>
                </div>
              </div>
            </div>

            {/* Stream actions */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800">
              <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                <Heart className="w-4 h-4" />
                Like
              </button>
              <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-500 transition-colors px-2 py-1 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20">
                <MessageCircle className="w-4 h-4" />
                Comment
              </button>
              <div className="flex-1" />
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {activeStream.viewersCount.toLocaleString()} watching
              </span>
            </div>

            {/* Live chat */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {chatMessages.map((msg) => (
                <div key={msg.id} className="text-sm">
                  <span className="font-medium text-brand-600 dark:text-brand-400">{msg.user}: </span>
                  <span className="text-gray-700 dark:text-gray-300">{msg.text}</span>
                </div>
              ))}
            </div>

            {/* Chat input */}
            <form onSubmit={sendChat} className="p-3 border-t border-gray-100 dark:border-gray-800 flex gap-2">
              <input
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Say something…"
                className="input text-sm flex-1 py-2"
              />
              <button type="submit" className="btn-primary text-sm px-3">
                Send
              </button>
            </form>
          </div>
        )}
      </main>
      <MobileNav />
    </div>
  );
}
