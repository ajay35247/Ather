/**
 * @ather/india — India-first utilities for the Ather platform.
 *
 * Pure functions, zero runtime dependencies. Safe to use in services,
 * web app, and worker scripts.
 *
 * Scope:
 *  - UPI (Unified Payments Interface) VPA validation
 *  - INR formatting in Indian numbering (lakh / crore / paise)
 *  - GST math (CGST + SGST for intra-state, IGST for inter-state)
 *  - IST (Asia/Kolkata) helpers
 *  - Aadhaar masking + PAN / PIN-code / mobile validation
 *  - Hindi numerals + Hindi number-words (लाख / करोड़)
 *  - PII redaction (Aadhaar / PAN) for posts — DPDP-aligned
 *  - Festival lookup (basic, fixed-date subset)
 *  - Bilingual (en / hi) greeting helper
 *
 * Philosophy: be conservative, match real-world UPI / RBI / UIDAI / NPCI
 * patterns, and never log or echo back raw PII.
 */

// ============================================================
// UPI — Unified Payments Interface
// ============================================================

/**
 * NPCI-compliant UPI Virtual Payment Address (VPA) validator.
 *
 * Format: `<handle>@<psp>` where:
 *  - handle: 2–256 chars, lowercase letters/digits/`. _ -`
 *  - psp:    starts with a letter, 2–64 chars, letters/digits/`. -`
 *
 * Real-world examples: `ajay@oksbi`, `9876543210@ybl`, `firm.gst@hdfcbank`.
 */
const UPI_VPA_REGEX = /^[a-z0-9._-]{2,256}@[a-z][a-z0-9.-]{1,64}$/;

export function isValidUpiVpa(vpa: string): boolean {
  if (typeof vpa !== 'string') return false;
  if (vpa.length > 320) return false;
  return UPI_VPA_REGEX.test(vpa.trim().toLowerCase());
}

/**
 * Normalize a VPA to the canonical lowercase, trimmed form. Returns `null`
 * if the input is not a valid VPA so callers can fail closed.
 */
export function normalizeUpiVpa(vpa: string): string | null {
  if (typeof vpa !== 'string') return null;
  const v = vpa.trim().toLowerCase();
  return UPI_VPA_REGEX.test(v) ? v : null;
}

/** Some major Indian PSP handles, useful for UI hints. Not exhaustive. */
export const KNOWN_UPI_PSPS: readonly string[] = Object.freeze([
  'oksbi',
  'okhdfcbank',
  'okicici',
  'okaxis',
  'ybl',
  'paytm',
  'apl',
  'ibl',
  'upi',
  'fbl'
]);

// ============================================================
// INR — Indian Rupee formatting
// ============================================================

/**
 * Format an integer paise amount as INR using Indian numbering
 * (1,00,000 = one lakh, 1,00,00,000 = one crore).
 *
 * @param paise Whole paise. 100 paise = ₹1.
 * @param opts.symbol  Include the ₹ prefix. Default true.
 * @param opts.decimals Show paise. Default true (₹1,234.56).
 */
export function formatINR(
  paise: number,
  opts: { symbol?: boolean; decimals?: boolean } = {}
): string {
  if (!Number.isFinite(paise)) {
    throw new RangeError('formatINR: paise must be a finite number');
  }
  const { symbol = true, decimals = true } = opts;
  const negative = paise < 0;
  const abs = Math.abs(Math.trunc(paise));
  const rupees = Math.trunc(abs / 100);
  const paisePart = abs % 100;

  // Indian grouping: last 3 digits, then groups of 2.
  const rupeesStr = rupees.toString();
  let grouped: string;
  if (rupeesStr.length <= 3) {
    grouped = rupeesStr;
  } else {
    const last3 = rupeesStr.slice(-3);
    const rest = rupeesStr.slice(0, -3);
    const restGrouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    grouped = `${restGrouped},${last3}`;
  }

  const decPart = decimals ? `.${paisePart.toString().padStart(2, '0')}` : '';
  const sign = negative ? '-' : '';
  const sym = symbol ? '₹' : '';
  return `${sign}${sym}${grouped}${decPart}`;
}

/**
 * Convert rupees (possibly fractional) to whole paise. Avoids float drift
 * by routing through Math.round on a 100x scale.
 */
export function rupeesToPaise(rupees: number): number {
  if (!Number.isFinite(rupees)) {
    throw new RangeError('rupeesToPaise: rupees must be a finite number');
  }
  return Math.round(rupees * 100);
}

/** Convert paise to rupees as a float (for display where exactness is not critical). */
export function paiseToRupees(paise: number): number {
  if (!Number.isFinite(paise)) {
    throw new RangeError('paiseToRupees: paise must be a finite number');
  }
  return Math.trunc(paise) / 100;
}

// ============================================================
// GST — Goods and Services Tax
// ============================================================

export type GstRate = 0 | 5 | 12 | 18 | 28;

export const GST_RATES: readonly GstRate[] = Object.freeze([0, 5, 12, 18, 28]);

export interface GstBreakdown {
  /** Pre-tax amount in paise. */
  basePaise: number;
  /** Total GST in paise. */
  gstPaise: number;
  /** Central GST (intra-state only). */
  cgstPaise: number;
  /** State GST (intra-state only). */
  sgstPaise: number;
  /** Integrated GST (inter-state only). */
  igstPaise: number;
  /** Final amount payable in paise. */
  totalPaise: number;
  rate: GstRate;
  interState: boolean;
}

/**
 * Compute GST on a base amount.
 *
 * For intra-state supply, GST is split equally between CGST and SGST.
 * For inter-state supply, full GST is IGST.
 * Half-paise are rounded using banker's-style half-to-even-free rounding
 * (Math.round on integer paise * rate).
 */
export function computeGst(
  basePaise: number,
  rate: GstRate,
  opts: { interState?: boolean } = {}
): GstBreakdown {
  if (!Number.isInteger(basePaise) || basePaise < 0) {
    throw new RangeError('computeGst: basePaise must be a non-negative integer');
  }
  if (!GST_RATES.includes(rate)) {
    throw new RangeError(`computeGst: rate must be one of ${GST_RATES.join(', ')}`);
  }
  const interState = !!opts.interState;
  const gstPaise = Math.round((basePaise * rate) / 100);
  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;
  if (interState) {
    igstPaise = gstPaise;
  } else {
    // Split with rounding: CGST gets the floor, SGST the rest, so
    // CGST + SGST always equals gstPaise exactly.
    cgstPaise = Math.floor(gstPaise / 2);
    sgstPaise = gstPaise - cgstPaise;
  }
  return {
    basePaise,
    gstPaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    totalPaise: basePaise + gstPaise,
    rate,
    interState
  };
}

// ============================================================
// IST — Asia/Kolkata time helpers
// ============================================================

/** UTC offset for Asia/Kolkata in minutes. India does not observe DST. */
export const IST_OFFSET_MINUTES = 5 * 60 + 30;

/**
 * Format a Date (or epoch ms) as an IST `YYYY-MM-DD HH:mm` string.
 * Avoids `toLocaleString` to keep behavior identical across Node versions
 * and runtimes that may lack full ICU.
 */
export function formatIST(input: Date | number = Date.now()): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) {
    throw new RangeError('formatIST: invalid Date');
  }
  const ist = new Date(d.getTime() + IST_OFFSET_MINUTES * 60_000);
  const yyyy = ist.getUTCFullYear();
  const mm = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(ist.getUTCDate()).padStart(2, '0');
  const hh = String(ist.getUTCHours()).padStart(2, '0');
  const mi = String(ist.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi} IST`;
}

/** True between 09:00 and 21:00 IST inclusive — used for IST-aware notifications. */
export function isIndiaBusinessHour(input: Date | number = Date.now()): boolean {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return false;
  const ist = new Date(d.getTime() + IST_OFFSET_MINUTES * 60_000);
  const h = ist.getUTCHours();
  return h >= 9 && h < 21;
}

// ============================================================
// Aadhaar / PAN / PIN / Mobile
// ============================================================

const AADHAAR_REGEX = /^[2-9]\d{11}$/;
const PAN_REGEX = /^[A-Z]{5}\d{4}[A-Z]$/;
const PIN_REGEX = /^[1-9]\d{5}$/;
const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

/**
 * UIDAI says an Aadhaar number is 12 digits and never starts with 0 or 1.
 * (Verhoeff checksum is intentionally NOT validated here — production code
 * should call UIDAI's eKYC, not depend on a client-side checksum.)
 */
export function isValidAadhaar(aadhaar: string): boolean {
  if (typeof aadhaar !== 'string') return false;
  return AADHAAR_REGEX.test(aadhaar.replace(/[\s-]/g, ''));
}

/** Mask Aadhaar to `XXXX-XXXX-1234` format. Returns `null` for invalid input. */
export function maskAadhaar(aadhaar: string): string | null {
  if (!isValidAadhaar(aadhaar)) return null;
  const digits = aadhaar.replace(/[\s-]/g, '');
  return `XXXX-XXXX-${digits.slice(-4)}`;
}

/** Validate a PAN in `AAAAA9999A` form. */
export function isValidPan(pan: string): boolean {
  if (typeof pan !== 'string') return false;
  return PAN_REGEX.test(pan.trim().toUpperCase());
}

/** Validate a 6-digit Indian postal PIN code. First digit 1–8. */
export function isValidPinCode(pin: string | number): boolean {
  const s = typeof pin === 'number' ? String(pin) : pin;
  if (typeof s !== 'string') return false;
  return PIN_REGEX.test(s.trim());
}

/**
 * Normalize an Indian mobile number to E.164 (`+91XXXXXXXXXX`).
 * Accepts inputs with `+91`, `91`, `0` prefix, or none.
 * Returns `null` if the resulting 10 digits are not a valid mobile.
 */
export function normalizeIndianMobile(input: string): string | null {
  if (typeof input !== 'string') return null;
  const stripped = input.replace(/[\s\-()]/g, '');
  let digits = stripped;
  if (digits.startsWith('+91')) digits = digits.slice(3);
  else if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  if (!INDIAN_MOBILE_REGEX.test(digits)) return null;
  return `+91${digits}`;
}

// ============================================================
// PII redaction — DPDP-aligned
// ============================================================

const AADHAAR_IN_TEXT = /\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/g;
const PAN_IN_TEXT = /\b[A-Z]{5}\d{4}[A-Z]\b/g;

/**
 * Redact obvious Aadhaar / PAN occurrences from user-generated text
 * before it hits the feed or moderation queue. This is an **assistive**
 * filter, not a security boundary — the moderation service is canonical.
 */
export function redactIndianPII(text: string): string {
  if (typeof text !== 'string') return '';
  return text
    .replace(AADHAAR_IN_TEXT, '[redacted-aadhaar]')
    .replace(PAN_IN_TEXT, '[redacted-pan]');
}

// ============================================================
// Hindi — numerals + number words
// ============================================================

const DEVANAGARI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'] as const;

/** Convert Western digits in a string to Devanagari (०–९). Non-digit chars pass through. */
export function toDevanagariDigits(input: string | number): string {
  const s = typeof input === 'number' ? String(input) : input;
  if (typeof s !== 'string') return '';
  let out = '';
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (code >= 48 && code <= 57) out += DEVANAGARI_DIGITS[code - 48];
    else out += ch;
  }
  return out;
}

/**
 * Render a non-negative integer (rupees) using Hindi short-scale words:
 *   1,00,000        → "1 लाख"
 *   12,50,000       → "12.5 लाख"
 *   1,00,00,000     → "1 करोड़"
 *   2_50_00_00_000  → "250 करोड़"
 *
 * Below 1 लाख falls back to the plain (Western-grouped) integer for clarity.
 */
export function toHindiAmountWord(rupees: number): string {
  if (!Number.isFinite(rupees) || rupees < 0) {
    throw new RangeError('toHindiAmountWord: rupees must be a non-negative finite number');
  }
  const r = Math.trunc(rupees);
  if (r >= 1_00_00_000) {
    const v = r / 1_00_00_000;
    return `${trimDecimals(v)} करोड़`;
  }
  if (r >= 1_00_000) {
    const v = r / 1_00_000;
    return `${trimDecimals(v)} लाख`;
  }
  return String(r);
}

function trimDecimals(v: number): string {
  // Up to 2 decimals, drop trailing zeros.
  const s = v.toFixed(2);
  return s.replace(/\.?0+$/, '');
}

// ============================================================
// Festival calendar (basic fixed-date subset)
// ============================================================

export interface IndianFestival {
  name: string;
  /** Hindi name in Devanagari. */
  nameHi: string;
  /** Month, 1–12. */
  month: number;
  /** Day, 1–31. Lunar festivals are intentionally excluded from this lightweight table. */
  day: number;
}

/**
 * Subset of Indian festivals on fixed Gregorian dates.
 * Lunar festivals (Diwali, Holi, Eid, etc.) shift each year and are not
 * encoded here — fetch those from a calendar service when needed.
 */
export const FIXED_DATE_FESTIVALS: readonly IndianFestival[] = Object.freeze([
  { name: 'Republic Day', nameHi: 'गणतंत्र दिवस', month: 1, day: 26 },
  { name: 'Independence Day', nameHi: 'स्वतंत्रता दिवस', month: 8, day: 15 },
  { name: "Gandhi Jayanti", nameHi: 'गांधी जयंती', month: 10, day: 2 },
  { name: 'Christmas', nameHi: 'क्रिसमस', month: 12, day: 25 },
  { name: 'New Year', nameHi: 'नया साल', month: 1, day: 1 }
]);

/** Returns the festival for the given IST date, if any matches a fixed date. */
export function festivalOn(input: Date | number = Date.now()): IndianFestival | null {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  const ist = new Date(d.getTime() + IST_OFFSET_MINUTES * 60_000);
  const m = ist.getUTCMonth() + 1;
  const day = ist.getUTCDate();
  return FIXED_DATE_FESTIVALS.find((f) => f.month === m && f.day === day) ?? null;
}

// ============================================================
// Bilingual greeting
// ============================================================

export type IstGreetingLocale = 'en' | 'hi';

/**
 * Time-of-day greeting in IST. Defaults to English; pass 'hi' for Hindi.
 *   05:00–11:59 → Good morning / सुप्रभात
 *   12:00–16:59 → Good afternoon / नमस्कार
 *   17:00–20:59 → Good evening / शुभ संध्या
 *   else        → Hello / नमस्ते
 */
export function istGreeting(
  locale: IstGreetingLocale = 'en',
  input: Date | number = Date.now()
): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) {
    return locale === 'hi' ? 'नमस्ते' : 'Hello';
  }
  const ist = new Date(d.getTime() + IST_OFFSET_MINUTES * 60_000);
  const h = ist.getUTCHours();
  if (h >= 5 && h < 12) return locale === 'hi' ? 'सुप्रभात' : 'Good morning';
  if (h >= 12 && h < 17) return locale === 'hi' ? 'नमस्कार' : 'Good afternoon';
  if (h >= 17 && h < 21) return locale === 'hi' ? 'शुभ संध्या' : 'Good evening';
  return locale === 'hi' ? 'नमस्ते' : 'Hello';
}
