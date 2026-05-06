import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { users } from './auth';

const router = Router();

/**
 * Identity module — Phase 5
 *
 * Universal Digital Identity layer:
 *   - Multi-persona switching (personal / professional / anonymous)
 *   - Optional Web3 / DID linking (W3C did:* method-prefixed identifiers)
 *   - Reputation score derived from profile completeness and engagement
 *
 * No private keys are stored. The DID is a public identifier — users prove
 * ownership off-chain (e.g., via a signed challenge) before linking.
 */

const VALID_PERSONAS = ['personal', 'professional', 'anonymous'] as const;
type Persona = (typeof VALID_PERSONAS)[number];

interface IdentityRecord {
  userId: string;
  activePersona: Persona;
  did?: string;
  didMethod?: string;
  didLinkedAt?: string;
  /** A score in [0, 100] computed lazily from profile data. */
  reputationScore: number;
}

const identities: Record<string, IdentityRecord> = Object.create(null);

function getOrCreate(userId: string): IdentityRecord {
  if (!identities[userId]) {
    identities[userId] = {
      userId,
      activePersona: 'personal',
      reputationScore: 0,
    };
  }
  identities[userId].reputationScore = computeReputation(userId);
  return identities[userId];
}

function computeReputation(userId: string): number {
  const u = users[userId];
  if (!u) return 0;
  let score = 0;
  if (u.displayName) score += 10;
  if (u.bio) score += 10;
  if (u.avatarUrl) score += 10;
  if (u.emailVerified) score += 15;
  // followers/posts contribute up to 55 points combined (logarithmic).
  const followers = u.followersCount || 0;
  const posts = u.postsCount || 0;
  score += Math.min(35, Math.round(Math.log10(followers + 1) * 14));
  score += Math.min(20, Math.round(Math.log10(posts + 1) * 10));
  return Math.min(100, score);
}

// DID validation per W3C: did:<method>:<method-specific-id>
// method = 1+ lowercase letters/digits, msi = 1+ allowed chars.
const DID_RE = /^did:([a-z0-9]+):([A-Za-z0-9._:%-]+)$/;

// ── GET /api/identity ────────────────────────────────────────────────────────
router.get('/', authenticate, (req: AuthRequest, res: Response) => {
  res.json({ success: true, data: getOrCreate(req.userId!) });
});

// ── POST /api/identity/persona ───────────────────────────────────────────────
router.post(
  '/persona',
  authenticate,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const { persona } = req.body as { persona?: string };
    if (!persona || !VALID_PERSONAS.includes(persona as Persona)) {
      return next(createError(`persona must be one of: ${VALID_PERSONAS.join(', ')}`, 400));
    }
    const id = getOrCreate(req.userId!);
    id.activePersona = persona as Persona;
    res.json({ success: true, data: id });
  },
);

// ── POST /api/identity/did ───────────────────────────────────────────────────
// Link an external DID (e.g. did:ethr:0x..., did:key:..., did:web:...).
router.post('/did', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  const { did } = req.body as { did?: string };
  if (!did || typeof did !== 'string') return next(createError('did is required', 400));
  if (did.length > 256) return next(createError('did too long', 400));

  const m = DID_RE.exec(did);
  if (!m) return next(createError('Invalid DID format. Expected did:<method>:<id>', 400));

  // Reject duplicate links across users.
  for (const rec of Object.values(identities)) {
    if (rec.userId !== req.userId && rec.did === did) {
      return next(createError('DID is already linked to another account', 409));
    }
  }

  const rec = getOrCreate(req.userId!);
  rec.did = did;
  rec.didMethod = m[1];
  rec.didLinkedAt = new Date().toISOString();
  res.json({ success: true, data: rec });
});

// ── DELETE /api/identity/did ─────────────────────────────────────────────────
router.delete('/did', authenticate, (req: AuthRequest, res: Response) => {
  const rec = getOrCreate(req.userId!);
  delete rec.did;
  delete rec.didMethod;
  delete rec.didLinkedAt;
  res.json({ success: true, data: rec });
});

// ── GET /api/identity/reputation/:userId ─────────────────────────────────────
router.get('/reputation/:userId', authenticate, (req, res: Response, next: NextFunction) => {
  if (!users[req.params.userId]) return next(createError('User not found', 404));
  res.json({
    success: true,
    data: { userId: req.params.userId, score: computeReputation(req.params.userId) },
  });
});

export default router;
