import { Router } from 'express';
import { z } from 'zod';
import { defaultLimiters, requireJwtSecret } from '@ather/service-kit';

/**
 * Phase 4 translation. Production wires this to a managed MT API
 * (Google/AWS/Azure or self-hosted NLLB / mBART). Stub returns the input
 * with a wrapper to make the contract testable end-to-end.
 */
export interface Translator {
  translate(text: string, targetLang: string, sourceLang?: string): Promise<string>;
}

export class StubTranslator implements Translator {
  async translate(text: string, targetLang: string): Promise<string> {
    return `[${targetLang}] ${text}`;
  }
}

const Schema = z.object({
  text: z.string().min(1).max(5000),
  targetLang: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/),
  sourceLang: z
    .string()
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
    .optional()
});

export function buildTranslationRouter(t: Translator, _jwtSecret: string, isTest: boolean) {
  const limiters = defaultLimiters(isTest);
  const router = Router();

  router.post('/translate', limiters.write, async (req, res, next) => {
    try {
      const input = Schema.parse(req.body);
      const out = await t.translate(input.text, input.targetLang, input.sourceLang);
      res.json({ text: out, targetLang: input.targetLang });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}
