'use client';

import { useState } from 'react';
import Sidebar from '@/components/navigation/Sidebar';
import MobileNav from '@/components/navigation/MobileNav';
import api from '@/lib/api';
import { Search, User, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const { data } = await api.get('/api/users', { params: { q: query } });
      setResults(data.data || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-6">
        <h1 className="text-2xl font-bold mb-6">Search</h1>

        <form onSubmit={handleSearch} className="flex gap-3 mb-6">
          <div className="flex-1 flex items-center gap-3 bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3">
            <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people, communities, posts…"
              className="bg-transparent outline-none flex-1 text-sm"
            />
          </div>
          <button type="submit" className="btn-primary px-5">
            Search
          </button>
        </form>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
          </div>
        ) : searched && results.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No results for &quot;{query}&quot;</p>
          </div>
        ) : (
          <div className="space-y-2">
            {results.map((user: any) => (
              <Link
                key={user.id}
                href={`/user/${user.username}`}
                className="card p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{user.displayName}</p>
                  <p className="text-sm text-gray-400">@{user.username}</p>
                  {user.bio && <p className="text-xs text-gray-500 mt-0.5 truncate">{user.bio}</p>}
                </div>
                <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </main>
      <MobileNav />
    </div>
  );
}
