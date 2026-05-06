import { Router, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

const router = Router();

/**
 * AI module — Phase 3/4
 *
 * Provides assistant chat, smart-reply generation, content moderation, and
 * post-summarization endpoints. The implementations below are deterministic,
 * rule-based heuristics so the API has stable, testable behavior without
 * needing an external LLM. In production, swap the helper functions with
 * real model calls.
 */

// Per-user chat history with the assistant.
const sessions: Record<string, Array<{ role: 'user' | 'assistant'; content: string; at: string }>> =
  Object.create(null);

// ── POST /api/ai/chat ────────────────────────────────────────────────────────
router.post('/chat', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  const { message } = req.body as { message?: string };
  if (!message?.trim()) return next(createError('message is required', 400));
  if (message.length > 4000) return next(createError('message too long', 400));

  const userId = req.userId!;
  const history = sessions[userId] || (sessions[userId] = []);
  history.push({ role: 'user', content: message, at: new Date().toISOString() });

  const reply = generateAssistantReply(message);
  history.push({ role: 'assistant', content: reply, at: new Date().toISOString() });

  // Cap history at 50 turns
  if (history.length > 100) history.splice(0, history.length - 100);

  res.json({ success: true, data: { reply, history } });
});

// ── GET /api/ai/chat/history ────────────────────────────────────────────────
router.get('/chat/history', authenticate, (req: AuthRequest, res: Response) => {
  res.json({ success: true, data: sessions[req.userId!] || [] });
});

// ── DELETE /api/ai/chat/history ─────────────────────────────────────────────
router.delete('/chat/history', authenticate, (req: AuthRequest, res: Response) => {
  delete sessions[req.userId!];
  res.json({ success: true });
});

// ── POST /api/ai/smart-replies ──────────────────────────────────────────────
// Returns 3 short suggested replies for a given inbound message.
router.post(
  '/smart-replies',
  authenticate,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const { message } = req.body as { message?: string };
    if (!message?.trim()) return next(createError('message is required', 400));
    res.json({ success: true, data: smartReplies(message) });
  },
);

// ── POST /api/ai/moderate ───────────────────────────────────────────────────
// Returns a safety verdict for content. Rule-based: flags banned terms,
// excessive shouting, and very long content. Replace with ML model in prod.
router.post('/moderate', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  const { content } = req.body as { content?: string };
  if (typeof content !== 'string') return next(createError('content is required', 400));
  res.json({ success: true, data: moderate(content) });
});

// ── POST /api/ai/summarize ──────────────────────────────────────────────────
router.post(
  '/summarize',
  authenticate,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const { text } = req.body as { text?: string };
    if (!text?.trim()) return next(createError('text is required', 400));
    res.json({ success: true, data: { summary: summarize(text), id: uuidv4() } });
  },
);

// ── POST /api/ai/caption ────────────────────────────────────────────────────
// Generates a short caption suggestion for a piece of content.
router.post(
  '/caption',
  authenticate,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const { topic } = req.body as { topic?: string };
    if (!topic?.trim()) return next(createError('topic is required', 400));
    const t = topic.trim();
    const captions = [
      `Thinking out loud about ${t} ✨`,
      `My take on ${t} — let me know yours below 👇`,
      `${capitalize(t)}, but make it interesting 🔥`,
    ];
    res.json({ success: true, data: { captions } });
  },
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateAssistantReply(message: string): string {
  const m = message.toLowerCase();
  if (/\b(hi|hello|hey|namaste)\b/.test(m)) {
    return "Hi! I'm your Ather AI assistant. I can help draft posts, summarize feeds, and suggest replies. What would you like to do?";
  }
  if (/summar(y|ize|ise)/.test(m)) {
    return "Sure — paste the text and I'll summarize it. You can also use POST /api/ai/summarize to do this programmatically.";
  }
  if (/draft|write|post|caption/.test(m)) {
    return 'Tell me the topic and tone (casual / professional / playful) and I will draft a post for you.';
  }
  if (/\b(help|what can you do|features)\b/.test(m)) {
    return 'I can: 1) Chat and answer questions, 2) Suggest smart replies, 3) Moderate content, 4) Summarize long posts, 5) Generate captions.';
  }
  return `Got it — you said: "${message.slice(0, 240)}". I will keep this in context for follow-up questions.`;
}

function smartReplies(message: string): string[] {
  const m = message.toLowerCase();
  if (m.includes('?')) return ['Yes!', 'Not sure 🤔', 'Let me check and get back to you.'];
  if (/\b(thanks|thank you)\b/.test(m)) return ['You got it 🙌', 'Anytime!', 'Happy to help.'];
  if (/\b(meet|call|catch up)\b/.test(m)) {
    return ['Sounds good 👍', 'Send me a time?', "Let's do it tomorrow."];
  }
  return ['👍', 'Got it!', 'Tell me more.'];
}

const BANNED_TERMS = ['hate', 'kill', 'attack', 'nsfw', 'spam', 'scam'];

function moderate(content: string): {
  safe: boolean;
  flags: string[];
  score: number;
  reason: string | null;
} {
  const flags: string[] = [];
  const lower = content.toLowerCase();

  for (const term of BANNED_TERMS) {
    if (new RegExp(`\\b${term}\\b`).test(lower)) flags.push(`banned-term:${term}`);
  }

  // Excessive shouting (>70% uppercase letters and length > 20)
  const letters = content.replace(/[^a-zA-Z]/g, '');
  if (letters.length > 20) {
    const upper = letters.replace(/[^A-Z]/g, '').length;
    if (upper / letters.length > 0.7) flags.push('shouting');
  }

  if (content.length > 5000) flags.push('too-long');

  const score = Math.min(1, flags.length * 0.34);
  return {
    safe: flags.length === 0,
    flags,
    score,
    reason: flags.length === 0 ? null : `Content flagged: ${flags.join(', ')}`,
  };
}

function summarize(text: string): string {
  // Naive but deterministic: first sentence + last sentence + length info.
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
  if (sentences.length <= 2) return sentences.join(' ');
  return `${sentences[0]} … ${sentences[sentences.length - 1]} (${sentences.length} sentences)`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default router;
