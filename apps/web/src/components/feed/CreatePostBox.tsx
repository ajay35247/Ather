'use client';

import { useState } from 'react';
import { Image, Film, FileText, X, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

interface CreatePostBoxProps {
  onPost?: (post: any) => void;
}

export default function CreatePostBox({ onPost }: CreatePostBoxProps) {
  const { user } = useAuthStore();
  const [content, setContent] = useState('');
  const [type, setType] = useState<'text' | 'image' | 'video' | 'reel'>('text');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [mediaInput, setMediaInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() && mediaUrls.length === 0) {
      toast.error("Post can't be empty");
      return;
    }
    setIsSubmitting(true);
    try {
      const { data } = await api.post('/api/posts', {
        content,
        type,
        mediaUrls,
        visibility: 'public',
      });
      onPost?.(data.data);
      setContent('');
      setMediaUrls([]);
      setMediaInput('');
      toast.success('Post published!');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to post');
    } finally {
      setIsSubmitting(false);
    }
  }

  function addMedia() {
    if (!mediaInput.trim()) return;
    // Only allow http/https URLs to prevent javascript: XSS
    try {
      const parsed = new URL(mediaInput.trim());
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        toast.error('Only http and https URLs are allowed');
        return;
      }
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }
    setMediaUrls((prev) => [...prev, mediaInput.trim()]);
    setMediaInput('');
  }

  /** Sanitize a URL at render time — returns empty string for non-http(s) schemes. */
  function safeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : '';
    } catch {
      return '';
    }
  }

  return (
    <div className="card p-4">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold flex-shrink-0 text-sm">
          {user.displayName.charAt(0).toUpperCase()}
        </div>
        <form onSubmit={handleSubmit} className="flex-1 space-y-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind?"
            className="w-full bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 outline-none resize-none min-h-[80px]"
            maxLength={2000}
          />

          {/* Media URLs */}
          {mediaUrls.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {mediaUrls.map((url, i) => (
                <div key={i} className="relative">
                  <img
                    src={safeUrl(url)}
                    alt=""
                    className="w-20 h-20 object-cover rounded-lg"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setMediaUrls((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-gray-900 text-white rounded-full flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Media URL input */}
          <div className="flex gap-2">
            <input
              type="url"
              value={mediaInput}
              onChange={(e) => setMediaInput(e.target.value)}
              placeholder="Paste image/video URL…"
              className="input text-xs py-2 flex-1"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addMedia())}
            />
            <button type="button" onClick={addMedia} className="btn-secondary text-xs px-3">
              Add
            </button>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className="flex gap-1">
              {(['text', 'image', 'video', 'reel'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                    type === t
                      ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 font-medium'
                      : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary text-sm px-5 py-2 flex items-center gap-2"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Post
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
