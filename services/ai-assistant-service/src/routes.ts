import { Router, type Response } from 'express';
import { z } from 'zod';
import {
  defaultLimiters,
  requireBearerAuth,
  requireJwtSecret,
  type AuthedRequest,
  ForbiddenError
} from '@ather/service-kit';

/**
 * Per-user daily quota. In-memory; production uses Redis (atomic INCR with
 * day-bucketed key). Keeping the same interface so swapping is mechanical.
 */
export class QuotaStore {
  private day: string = new Date().toISOString().slice(0, 10);
  private counts = new Map<string, number>();

  consume(userId: string, dailyLimit: number): boolean {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.day) {
      this.counts.clear();
      this.day = today;
    }
    const cur = this.counts.get(userId) ?? 0;
    if (cur >= dailyLimit) return false;
    this.counts.set(userId, cur + 1);
    return true;
  }

  remaining(userId: string, dailyLimit: number): number {
    return Math.max(0, dailyLimit - (this.counts.get(userId) ?? 0));
  }
}

/**
 * Phase 1 AI provider stub. The contract matches the OpenAI-style streamed
 * chat completion. Production swaps `complete` for a real provider call,
 * keeping the rest of the pipeline (quota, prompt-injection scrubbing, audit)
 * unchanged.
 */
export interface AiProvider {
  complete(prompt: string, opts?: { maxTokens?: number }): Promise<string>;
  stream(prompt: string): AsyncGenerator<string, void, void>;
}

export class StubProvider implements AiProvider {
  async complete(prompt: string): Promise<string> {
    return `(stub) you said: ${prompt.slice(0, 200)}`;
  }
  async *stream(prompt: string): AsyncGenerator<string, void, void> {
    const reply = await this.complete(prompt);
    for (const ch of reply.split(' ')) {
      yield ch + ' ';
    }
  }
}

/**
 * Strip a small set of obviously-untrusted tokens from prompts before they hit
 * the model. This is *not* a complete prompt-injection defense (production
 * adds: model-side system prompt, output validators, tool allowlists).
 */
export function scrubPrompt(input: string): string {
  return input
    .replace(/(?:ignore|disregard) (?:all|previous|prior) instructions?/gi, '[redacted]')
    .replace(/system:\s*/gi, '')
    .slice(0, 4000);
}

const ChatSchema = z.object({ message: z.string().min(1).max(4000) });
const SummarizeSchema = z.object({ text: z.string().min(1).max(8000) });
const SuggestReplySchema = z.object({ context: z.string().min(1).max(2000) });
const CaptionSchema = z.object({
  imageDescription: z.string().min(1).max(1000)
});

export interface AssistantConfig {
  /** Per-user request quota per day. */
  dailyQuota: number;
}

export function buildAssistantRouter(
  cfg: AssistantConfig,
  provider: AiProvider,
  quotas: QuotaStore,
  jwtSecret: string,
  isTest: boolean
) {
  const limiters = defaultLimiters(isTest);
  const router = Router();
  const auth = requireBearerAuth(jwtSecret);

  function ensureQuota(userId: string): void {
    if (!quotas.consume(userId, cfg.dailyQuota)) {
      throw new ForbiddenError('daily AI quota exhausted');
    }
  }

  router.post('/chat', limiters.write, auth, async (req: AuthedRequest, res, next) => {
    try {
      const { message } = ChatSchema.parse(req.body);
      ensureQuota(req.claims!.sub);
      const prompt = scrubPrompt(message);

      // SSE stream.
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();
      writeSse(res, 'start', { ok: true });
      for await (const chunk of provider.stream(prompt)) {
        writeSse(res, 'token', { token: chunk });
      }
      writeSse(res, 'done', { ok: true });
      res.end();
    } catch (err) {
      next(err);
    }
  });

  router.post('/summarize', limiters.write, auth, async (req: AuthedRequest, res, next) => {
    try {
      const { text } = SummarizeSchema.parse(req.body);
      ensureQuota(req.claims!.sub);
      const out = await provider.complete(`Summarize:\n${scrubPrompt(text)}`);
      res.json({ summary: out });
    } catch (err) {
      next(err);
    }
  });

  router.post('/suggest-reply', limiters.write, auth, async (req: AuthedRequest, res, next) => {
    try {
      const { context } = SuggestReplySchema.parse(req.body);
      ensureQuota(req.claims!.sub);
      const out = await provider.complete(`Suggest a short reply to:\n${scrubPrompt(context)}`);
      res.json({ suggestion: out });
    } catch (err) {
      next(err);
    }
  });

  router.post('/generate-caption', limiters.write, auth, async (req: AuthedRequest, res, next) => {
    try {
      const { imageDescription } = CaptionSchema.parse(req.body);
      ensureQuota(req.claims!.sub);
      const out = await provider.complete(`Caption: ${scrubPrompt(imageDescription)}`);
      res.json({ caption: out, provenance: { aiGenerated: true, c2pa: 'placeholder' } });
    } catch (err) {
      next(err);
    }
  });

  router.get('/quota', limiters.read, auth, (req: AuthedRequest, res) => {
    res.json({
      remaining: quotas.remaining(req.claims!.sub, cfg.dailyQuota),
      dailyLimit: cfg.dailyQuota
    });
  });

  return router;
}

function writeSse(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}
