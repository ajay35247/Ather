'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import Sidebar from '@/components/navigation/Sidebar';
import MobileNav from '@/components/navigation/MobileNav';
import api from '@/lib/api';
import { BadgeCheck, MapPin, Link as LinkIcon, Edit3, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import PostCard from '@/components/feed/PostCard';

export default function ProfilePage() {
  const { user, fetchMe } = useAuthStore();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ bio: '', website: '', location: '' });

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    if (!user) return;
    setForm({ bio: user.bio || '', website: (user as any).website || '', location: (user as any).location || '' });
    api
      .get('/api/posts', { params: { authorId: user.id } })
      .then(({ data }) => setPosts(data.data || []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.patch('/api/users/me', form);
      await fetchMe();
      setEditing(false);
      toast.success('Profile updated!');
    } catch {
      toast.error('Failed to update profile');
    }
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-6">
        {/* Profile header */}
        <div className="card p-6 mb-4">
          <div className="flex items-start justify-between mb-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center text-white text-3xl font-bold">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <button onClick={() => setEditing(!editing)} className="btn-secondary flex items-center gap-2 text-sm">
              <Edit3 className="w-4 h-4" />
              Edit profile
            </button>
          </div>

          {/* Name & username */}
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold">{user.displayName}</h1>
            {user.isVerified && <BadgeCheck className="w-5 h-5 text-brand-500" />}
          </div>
          <p className="text-gray-500 text-sm mb-3">@{user.username}</p>

          {/* Bio */}
          {(user as any).bio && <p className="text-sm mb-3 leading-relaxed">{(user as any).bio}</p>}

          {/* Meta */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-4">
            {(user as any).location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {(user as any).location}
              </span>
            )}
            {(user as any).website && (
              <a
                href={(user as any).website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-brand-600 hover:underline"
              >
                <LinkIcon className="w-4 h-4" />
                {(user as any).website.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>

          {/* Stats */}
          <div className="flex gap-6 text-sm">
            <div>
              <span className="font-bold text-gray-900 dark:text-gray-100">{user.postsCount}</span>
              <span className="text-gray-500 ml-1">Posts</span>
            </div>
            <div>
              <span className="font-bold text-gray-900 dark:text-gray-100">{user.followersCount}</span>
              <span className="text-gray-500 ml-1">Followers</span>
            </div>
            <div>
              <span className="font-bold text-gray-900 dark:text-gray-100">{user.followingCount}</span>
              <span className="text-gray-500 ml-1">Following</span>
            </div>
          </div>
        </div>

        {/* Edit form */}
        {editing && (
          <div className="card p-5 mb-4 animate-slide-up">
            <h2 className="font-semibold mb-4">Edit Profile</h2>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1.5">Bio</label>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                  className="input resize-none"
                  rows={3}
                  placeholder="Tell the world about yourself"
                  maxLength={160}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1.5">Website</label>
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                  className="input"
                  placeholder="https://yoursite.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1.5">Location</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  className="input"
                  placeholder="City, Country"
                />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn-primary text-sm">Save changes</button>
                <button type="button" onClick={() => setEditing(false)} className="btn-secondary text-sm">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Posts */}
        <h2 className="font-semibold mb-3 text-gray-700 dark:text-gray-300">Posts</h2>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-10 text-gray-400">No posts yet</div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </main>
      <MobileNav />
    </div>
  );
}
