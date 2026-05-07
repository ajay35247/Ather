# security/

Cross-cutting security policies, controls, and runbooks. Per-service
controls (rate limits, JWT, idempotency, URL allowlists) stay close to the
code they protect.

## Proposed sub-tree

```
security/
├── zero-trust/
├── encryption/
├── secrets-management/
├── penetration-testing/
├── waf/
├── anti-ddos/
├── ai-threat-detection/
├── compliance/
├── gdpr/
├── dpdp-india/
└── incident-response/
```

## Status

In-repo controls already shipped:
- JWT secret enforcement: `packages/service-kit/src/auth.ts` (throws in prod
  if `JWT_SECRET` is unset).
- Tiered rate limits: `packages/service-kit/src/rateLimits.ts`.
- Refresh-token rotation + reuse detection: `services/auth-service/src/routes/auth.ts`.
- Idempotency keys on monetization writes: `apps/api/src/middleware/idempotency.ts`.
- URL allowlist for user-supplied media URLs: `apps/api/src/middleware/urlValidator.ts`.
- Dependency review + `pnpm audit` in CI: `.github/workflows/security-scan.yml`.

DPDP-India + GDPR data-residency procedures are tracked in
[`../docs/`](../docs/) and will land here once formalised.
