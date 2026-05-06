'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/navigation/Sidebar';
import MobileNav from '@/components/navigation/MobileNav';
import api from '@/lib/api';
import { Users, Lock, Globe, Plus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Community {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  membersCount: number;
  postsCount: number;
  isPrivate: boolean;
  isMember: boolean;
}

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', category: 'General', isPrivate: false });

  useEffect(() => {
    api
      .get('/api/communities')
      .then(({ data }) => setCommunities(data.data || []))
      .catch(() => setCommunities([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleJoinLeave(community: Community) {
    try {
      if (community.isMember) {
        await api.delete(`/api/communities/${community.id}/join`);
        toast.success('Left community');
      } else {
        await api.post(`/api/communities/${community.id}/join`);
        toast.success('Joined community');
      }
      setCommunities((prev) =>
        prev.map((c) =>
          c.id === community.id
            ? {
                ...c,
                isMember: !c.isMember,
                membersCount: c.isMember ? c.membersCount - 1 : c.membersCount + 1,
              }
            : c,
        ),
      );
    } catch {
      toast.error('Action failed');
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { data } = await api.post('/api/communities', form);
      setCommunities((prev) => [data.data, ...prev]);
      setShowCreate(false);
      setForm({ name: '', description: '', category: 'General', isPrivate: false });
      toast.success('Community created!');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to create');
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Communities</h1>
          <button onClick={() => setShowCreate(!showCreate)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" />
            New Community
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="card p-5 mb-5 animate-slide-up">
            <h2 className="font-semibold mb-4">Create a Community</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Community name"
                className="input"
                required
              />
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Description"
                className="input resize-none"
                rows={3}
              />
              <div className="flex items-center gap-3">
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="input"
                >
                  {['General', 'Tech', 'Gaming', 'Music', 'Sports', 'Science', 'Art', 'Business'].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={form.isPrivate}
                    onChange={(e) => setForm((f) => ({ ...f, isPrivate: e.target.checked }))}
                    className="rounded"
                  />
                  Private
                </label>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn-primary text-sm">Create</button>
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary text-sm">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          </div>
        ) : communities.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No communities yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {communities.map((community) => (
              <div key={community.id} className="card p-4 flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {community.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold truncate">{community.name}</h3>
                    {community.isPrivate ? (
                      <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    ) : (
                      <Globe className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    )}
                    <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full flex-shrink-0">
                      {community.category}
                    </span>
                  </div>
                  {community.description && (
                    <p className="text-sm text-gray-500 mb-2 line-clamp-2">{community.description}</p>
                  )}
                  <p className="text-xs text-gray-400">
                    {community.membersCount.toLocaleString()} members
                  </p>
                </div>
                <button
                  onClick={() => handleJoinLeave(community)}
                  className={community.isMember ? 'btn-secondary text-sm' : 'btn-primary text-sm'}
                >
                  {community.isMember ? 'Leave' : 'Join'}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
      <MobileNav />
    </div>
  );
}
