# Phase 5 — Frontier: explicit deferral

Phase 5 in the [roadmap](./roadmap.md) covers **Web3 identity (opt-in), AR/VR
+ location, advanced agents, and digital legacy**. Per §"Hard Realities" of
the same roadmap, these are **gated by safety + regulatory readiness** and
must not ship until those gates are met.

This document records the deliberate decision to **not build Phase 5 in this
PR** and the criteria that gate each capability.

## Why deferred (not "skipped")

The Phase 5 capabilities each require something the current codebase cannot
yet provide:

| Capability | What it actually needs |
|------------|------------------------|
| **Web3 identity** (opt-in DID, signed posts) | Key custody story (HSM or threshold signing), recovery UX, regulatory clearance for any tokenized asset, and a clear policy on whether Ather is a custodian. Until then, an "opt-in DID" feature is a foot-gun: lost keys = lost identity, with no support recourse. |
| **AR / VR / location overlays** | Granular, *withdrawable* location consent at the OS level (iOS/Android background-location permission classes), on-device geofencing for sensitive zones (schools, hospitals, places of worship, protests), and a measurable harm model. Without these the "AR layer" becomes a stalking surface. |
| **Advanced agents** (long-lived, autonomous, tool-using) | A real sandbox with non-bypassable resource caps (CPU/memory/network egress), a complete tool allowlist with audit, and a kill-switch operationally tested. The current `agent-orchestrator` stub enforces an allowlist for the route surface but does **not** sandbox tool execution. Shipping autonomous agents on top of that today would be unsafe. |
| **Digital legacy** (post-mortem account control) | Identity verification of legal heirs (jurisdiction-dependent), takedown / freeze workflows that satisfy GDPR Art. 17 / DPDP Act 2023, and an explicit user-set policy on what "inheritance" of a social account even means. This is largely a *legal* product, not a code product. |

## Gating criteria (must all be true to lift the deferral)

Phase 5 may begin **per-capability**, only after:

1. **Safety review.** A documented threat model for the specific capability,
   reviewed by both engineering and a non-engineering safety stakeholder.
2. **Regulatory review.** Sign-off from legal counsel covering at minimum:
   GDPR (EU), DPDP Act 2023 (India), CCPA (US-CA), and any
   capability-specific regimes (e.g. money-transmission for tokenized assets,
   CSAM and minor-protection regimes for AR overlays).
3. **Reversibility.** Every Phase 5 feature must be opt-in and fully
   reversible without permanent data loss for the user.
4. **Operational readiness.** On-call rotation that owns the new attack
   surface, with documented incident-response runbooks and a kill-switch
   that has been tested in staging.
5. **User research.** Evidence that the feature solves a real user need
   (not just "it would be cool to have").

## What *is* in this PR for Phase 5

* The roadmap entry remains.
* No service folders, no code, no routes, no clients.
* This document, so the deferral is auditable.

## When the criteria above are satisfied

The expected scaffold path for each Phase 5 capability is the same as
Phases 1–4:

```
services/<capability>/
  src/{routes.ts, app.ts, index.ts}
  test/<capability>.test.ts
  package.json + tsconfig.json + jest.config.js
```

…using the shared `packages/service-kit`. There is no architectural
blocker — only the policy gate above.
