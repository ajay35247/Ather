import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { users } from './auth';

const router = Router();

/**
 * Wellbeing & Digital Legacy — Phase 5 / Layer 20
 *
 *   - Daily screen-time tracking and limits
 *   - Focus mode (suppresses non-essential notifications)
 *   - Digital legacy contacts: trusted contacts who may receive an archive
 *     of the user's data after a configurable period of inactivity.
 */

interface WellbeingRecord {
  userId: string;
  dailyLimitMinutes: number; // 0 = no limit
  focusMode: boolean;
  /** Today's accumulated active session minutes. */
  todayMinutes: number;
  todayDate: string; // YYYY-MM-DD
  legacyContactIds: string[];
  legacyInactivityDays: number;
}

const records: Record<string, WellbeingRecord> = Object.create(null);

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function getOrCreate(userId: string): WellbeingRecord {
  let rec = records[userId];
  if (!rec) {
    rec = records[userId] = {
      userId,
      dailyLimitMinutes: 0,
      focusMode: false,
      todayMinutes: 0,
      todayDate: today(),
      legacyContactIds: [],
      legacyInactivityDays: 180,
    };
  }
  // Roll over the daily counter at midnight UTC.
  const t = today();
  if (rec.todayDate !== t) {
    rec.todayDate = t;
    rec.todayMinutes = 0;
  }
  return rec;
}

// ── GET /api/wellbeing ───────────────────────────────────────────────────────
router.get('/', authenticate, (req: AuthRequest, res: Response) => {
  res.json({ success: true, data: getOrCreate(req.userId!) });
});

// ── PUT /api/wellbeing/limit ─────────────────────────────────────────────────
router.put('/limit', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  const minutes = Number(req.body?.minutes);
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 24 * 60) {
    return next(createError('minutes must be between 0 and 1440', 400));
  }
  const rec = getOrCreate(req.userId!);
  rec.dailyLimitMinutes = Math.floor(minutes);
  res.json({ success: true, data: rec });
});

// ── PUT /api/wellbeing/focus ─────────────────────────────────────────────────
router.put('/focus', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  const { enabled } = req.body as { enabled?: boolean };
  if (typeof enabled !== 'boolean') return next(createError('enabled must be boolean', 400));
  const rec = getOrCreate(req.userId!);
  rec.focusMode = enabled;
  res.json({ success: true, data: rec });
});

// ── POST /api/wellbeing/track ────────────────────────────────────────────────
// Reports a session of active time. Server caps any single report at 60 min.
router.post('/track', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  const minutes = Number(req.body?.minutes);
  if (!Number.isFinite(minutes) || minutes < 0) {
    return next(createError('minutes must be a non-negative number', 400));
  }
  const rec = getOrCreate(req.userId!);
  rec.todayMinutes = Math.min(24 * 60, rec.todayMinutes + Math.min(60, minutes));
  const overLimit = rec.dailyLimitMinutes > 0 && rec.todayMinutes >= rec.dailyLimitMinutes;
  res.json({ success: true, data: { ...rec, overLimit } });
});

// ── PUT /api/wellbeing/legacy ────────────────────────────────────────────────
router.put('/legacy', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  const { contactIds, inactivityDays } = req.body as {
    contactIds?: unknown;
    inactivityDays?: unknown;
  };
  if (!Array.isArray(contactIds)) return next(createError('contactIds must be an array', 400));
  if (contactIds.length > 5) return next(createError('At most 5 legacy contacts', 400));

  const seen = new Set<string>();
  const validated: string[] = [];
  for (const id of contactIds) {
    if (typeof id !== 'string') return next(createError('contactIds must be strings', 400));
    if (id === req.userId) return next(createError('Cannot add yourself as legacy contact', 400));
    if (!users[id]) return next(createError(`Contact ${id} not found`, 404));
    if (seen.has(id)) continue;
    seen.add(id);
    validated.push(id);
  }

  const rec = getOrCreate(req.userId!);
  rec.legacyContactIds = validated;
  if (inactivityDays !== undefined) {
    const d = Number(inactivityDays);
    if (!Number.isFinite(d) || d < 30 || d > 1825) {
      return next(createError('inactivityDays must be between 30 and 1825', 400));
    }
    rec.legacyInactivityDays = Math.floor(d);
  }
  res.json({ success: true, data: rec });
});

export default router;
