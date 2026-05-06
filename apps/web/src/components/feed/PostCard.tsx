'use client';

import { useState } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, BadgeCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface Post {
  id: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
    isVerified: boolean;
  };
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

interface PostCardProps {
  post: Post;
  onLikeChange?: (postId: string, liked: boolean, count: number) => void;
}

export default function PostCard({ post, onLikeChange }: PostCardProps) {
  const [liked, setLiked] = useState(post.isLiked);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [bookmarked, setBookmarked] = useState(post.isBookmarked);
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [comment, setComment] = useState('');

  async function handleLike() {
    const newLiked = !liked;
    setLiked(newLiked);
    const newCount = newLiked ? likesCount + 1 : likesCount - 1;
    setLikesCount(newCount);
    onLikeChange?.(post.id, newLiked, newCount);
    try {
      if (newLiked) {
        await api.post(`/api/posts/${post.id}/like`);
      } else {
        await api.delete(`/api/posts/${post.id}/like`);
      }
    } catch {
      // Revert on failure
      setLiked(!newLiked);
      setLikesCount(liked ? likesCount + 1 : likesCount - 1);
    }
  }

  async function handleBookmark() {
    setBookmarked(!bookmarked);
    try {
      await api.post(`/api/posts/${post.id}/bookmark`);
    } catch {
      setBookmarked(!bookmarked);
    }
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    try {
      await api.post(`/api/posts/${post.id}/comments`, { content: comment });
      toast.success('Comment added');
      setComment('');
      setShowCommentBox(false);
    } catch {
      toast.error('Failed to comment');
    }
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.origin + `/post/${post.id}`);
    toast.success('Link copied!');
  }

  const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true });

  return (
    <article className="card p-4 animate-fade-in">
      {/* Author header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {post.author.displayName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-sm truncate">{post.author.displayName}</span>
            {post.author.isVerified && <BadgeCheck className="w-4 h-4 text-brand-500 flex-shrink-0" />}
          </div>
          <p className="text-xs text-gray-400">@{post.author.username} · {timeAgo}</p>
        </div>
        <button className="btn-ghost p-2">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      {post.content && (
        <p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed mb-3 whitespace-pre-line">
          {post.content}
        </p>
      )}

      {/* Tags */}
      {post.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap mb-3">
          {post.tags.map((tag) => (
            <span key={tag} className="text-xs text-brand-600 dark:text-brand-400 font-medium">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Media */}
      {post.mediaUrls.length > 0 && (
        <div className={clsx('grid gap-1 mb-3', post.mediaUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
          {post.mediaUrls.slice(0, 4).map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              className="w-full object-cover rounded-xl max-h-80"
              onError={(e) => {
                (e.target as HTMLImageElement).parentElement?.removeChild(e.target as HTMLImageElement);
              }}
            />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 pt-2 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={handleLike}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors text-sm font-medium',
            liked
              ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
              : 'text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20',
          )}
        >
          <Heart className={clsx('w-4 h-4', liked && 'fill-current')} />
          {likesCount > 0 && <span>{likesCount}</span>}
        </button>

        <button
          onClick={() => setShowCommentBox(!showCommentBox)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-gray-500 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors text-sm font-medium"
        >
          <MessageCircle className="w-4 h-4" />
          {post.commentsCount > 0 && <span>{post.commentsCount}</span>}
        </button>

        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-gray-500 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-sm font-medium"
        >
          <Share2 className="w-4 h-4" />
        </button>

        <div className="flex-1" />

        <button
          onClick={handleBookmark}
          className={clsx(
            'p-2 rounded-xl transition-colors',
            bookmarked
              ? 'text-brand-500 bg-brand-50 dark:bg-brand-900/20'
              : 'text-gray-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20',
          )}
        >
          <Bookmark className={clsx('w-4 h-4', bookmarked && 'fill-current')} />
        </button>
      </div>

      {/* Comment box */}
      {showCommentBox && (
        <form onSubmit={handleComment} className="flex gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <input
            autoFocus
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Write a comment…"
            className="input text-sm flex-1"
          />
          <button type="submit" className="btn-primary text-sm px-4">
            Post
          </button>
        </form>
      )}
    </article>
  );
}
