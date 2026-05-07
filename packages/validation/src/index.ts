// @ather/validation — shared input validators (scaffold)
//
// EMAIL_RE is intentionally written so each segment is unambiguous:
// the local part forbids `@` and whitespace; the domain label between
// `@` and `.` additionally forbids `.`; the TLD/rest may include further
// dots but cannot overlap with the preceding label. This eliminates the
// polynomial-time backtracking that affected the previous variant
// (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) on inputs like `a.a.a.a.a.a`.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

export function isEmail(value: unknown): value is string {
  return typeof value === "string" && EMAIL_RE.test(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isHttpOrHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
