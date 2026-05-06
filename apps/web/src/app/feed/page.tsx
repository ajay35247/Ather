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

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef<HTMLDivElement | null>(null);

  async function fetchPosts(nextCursor?: string) {
    try {
      const params: Record<string, string> = { limit: '20' };
      if (nextCursor) params.cursor = nextCursor;
      const { data } = await api.get('/api/feed', { params });
      return data;
    } catch {
      return { data: [], nextCursor: null, hasMore: false };
    }
  }

  useEffect(() => {
    setLoading(true);
    fetchPosts().then((result) => {
      setPosts(result.data || []);
      setCursor(result.nextCursor);
      setHasMore(result.hasMore);
      setLoading(false);
    });
  }, []);

  // Infinite scroll
  useEffect(() => {
    if (!hasMore || !loaderRef.current) return;
    const currentLoader = loaderRef.current;
    const observer = new IntersectionObserver(async (entries) => {
      if (entries[0].isIntersecting && !loadingMore && hasMore) {
        setLoadingMore(true);
        const result = await fetchPosts(cursor ?? undefined);
        setPosts((prev) => [...prev, ...(result.data || [])]);
        setCursor(result.nextCursor);
        setHasMore(result.hasMore);
        setLoadingMore(false);
      }
    });
    observer.observe(currentLoader);
    return () => observer.disconnect();
  }, [cursor, hasMore, loadingMore]);

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

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500">No posts yet. Be the first to share something!</p>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
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
