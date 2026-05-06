'use client';

import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import PostCard from '@/components/feed/PostCard';
import CreatePostBox from '@/components/feed/CreatePostBox';
import Sidebar from '@/components/navigation/Sidebar';
import MobileNav from '@/components/navigation/MobileNav';
import { Loader2 } from 'lucide-react';

interface Post {
  id: string;
  author: { id: string; username: string; displayName: string; avatar?: string; isVerified: boolean };
  type: string;
  content: string;
  mediaUrls: string[];
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  isLiked: boolean;
  isBookmarked: boolean;
  tags: string[];
  createdAt: string;
}

type FeedMode = 'ranked' | 'chronological';
const MODE_LABELS: Record<FeedMode, string> = {
  ranked: 'For You',
  chronological: 'Latest'
};

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [mode, setMode] = useState<FeedMode>('ranked');
  const loaderRef = useRef<HTMLDivElement | null>(null);

  async function fetchPosts(currentMode: FeedMode, nextCursor?: string) {
    try {
      const params: Record<string, string> = { limit: '20', mode: currentMode };
      if (nextCursor) params.cursor = nextCursor;
      const { data } = await api.get('/api/feed', { params });
      return data;
    } catch {
      return { data: [], nextCursor: null, hasMore: false };
    }
  }

  // Reload whenever the mode changes (or on mount).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPosts([]);
    setCursor(null);
    setHasMore(true);
    fetchPosts(mode).then((result) => {
      if (cancelled) return;
      setPosts(result.data || []);
      setCursor(result.nextCursor);
      setHasMore(result.hasMore);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  // Infinite scroll
  useEffect(() => {
    if (!hasMore || !loaderRef.current) return;
    const currentLoader = loaderRef.current;
    const observer = new IntersectionObserver(async (entries) => {
      if (entries[0].isIntersecting && !loadingMore && hasMore) {
        setLoadingMore(true);
        const result = await fetchPosts(mode, cursor ?? undefined);
        setPosts((prev) => [...prev, ...(result.data || [])]);
        setCursor(result.nextCursor);
        setHasMore(result.hasMore);
        setLoadingMore(false);
      }
    });
    observer.observe(currentLoader);
    return () => observer.disconnect();
  }, [cursor, hasMore, loadingMore, mode]);

  function handleNewPost(post: Post) {
    setPosts((prev) => [post, ...prev]);
  }

  function handleLikeChange(postId: string, liked: boolean, count: number) {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, isLiked: liked, likesCount: count } : p)),
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-6">
        <CreatePostBox onPost={handleNewPost} />

        {/* Feed mode tabs — sticky on mobile so users can flip without scrolling up. */}
        <div
          role="tablist"
          aria-label="Feed mode"
          className="sticky top-0 z-10 flex gap-1 mt-4 mb-2 p-1 rounded-full bg-white/80 backdrop-blur border border-gray-200 w-fit"
        >
          {(Object.keys(MODE_LABELS) as FeedMode[]).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                role="tab"
                aria-selected={active}
                onClick={() => setMode(m)}
                className={
                  'px-4 py-1.5 text-sm rounded-full transition-colors ' +
                  (active
                    ? 'bg-brand-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100')
                }
              >
                {MODE_LABELS[m]}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500">No posts yet. Be the first to share something!</p>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onLikeChange={handleLikeChange} />
            ))}
          </div>
        )}

        <div ref={loaderRef} className="flex justify-center py-6">
          {loadingMore && <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
