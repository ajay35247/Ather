# Security & Privacy

## Authentication

- **OAuth2 + PKCE** for first-party and third-party clients.
- Access tokens: **JWT, 5-minute TTL**, signed RS256, `kid` rotated quarterly.
- Refresh tokens: **opaque**, server-side (hashed in DB), **device-bound**, single-use (rotation), revocable.
- Password hashing: **Argon2id** (memory ≥ 64 MiB, t=3, p=1). Phase 0 scaffolding ships with bcryptjs as a placeholder; Phase 1 must switch to argon2 with native bindings before any production workload.
- 2FA: **TOTP** (RFC 6238) and **WebAuthn**. Required for staff. Optional for users; required for risky operations (password change, payout setup).
- Biometric unlock on mobile (platform keystore-backed).

## Service-to-service

- **mTLS** everywhere (SPIFFE/SPIRE-issued SVIDs).
- Workload identity, not IP allow-lists.
- Per-call authz claims minted by an internal policy service (OPA/Cedar).

## End-to-end encryption (chat)

- **Signal protocol** (X3DH + Double Ratchet) for 1:1 and small groups.
- Server stores ciphertext only; pre-keys uploaded by clients.
- **Key backup** is user-controlled (passphrase-encrypted bundle in object storage).
- Group key transcripts are auditable client-side.

## Data protection

- Per-tenant **encryption keys** for media at rest (KMS-managed).
- **Field-level encryption** for PII (email, phone) at the DB layer.
- Backups encrypted; restore procedures rehearsed quarterly.

## Privacy controls

- Granular post visibility: `public | followers | close_friends | custom_list | persona_scoped`.
- Per-feature consent toggles (AI features, contact sync, location, ads personalization).
- **Data export** (machine-readable bundle) and **account deletion** (soft → hard after 30 days).
- **Regional residency** for EU and India tenants.

## Threat model (must be addressed before GA)

- Account takeover (credential stuffing, SIM swap, session theft).
- Scraping & abuse (rate limit, bot detection, paid API tier for crawlers).
- Spam waves (velocity rules, ML classifiers, shadow-banning with appeal).
- Deepfake injection (provenance signing, C2PA, perceptual hashing).
- Prompt injection of the assistant (untrusted-content tagging, tool allow-lists, output filtering).
- Payment fraud (3DS, velocity rules, manual review for high-risk payouts).
- **CSAM detection** (PhotoDNA + hash matching) — non-negotiable, on every uploaded image/video before publish.

## Compliance

- GDPR / EU Digital Services Act.
- India DPDP Act 2023.
- COPPA-aligned controls; **age gating** at signup.
- SOC 2 Type II target within 12 months of GA.
- PCI: scope minimized via tokenization (Stripe / Razorpay).
