# testing/

Cross-service / cross-app test harnesses. Per-service unit tests stay in
`services/<name>-service/test/` and per-app tests stay in `apps/<name>/`.

## Proposed sub-tree

```
testing/
├── unit/                 # opt-in shared unit-test utilities
├── integration/          # spin up multiple services + db
├── e2e/                  # full-stack browser / device tests
├── load-testing/         # k6 / Locust scripts
├── chaos-engineering/    # litmus / chaos-mesh experiments
├── ai-testing/           # eval harnesses for ranker / LLM outputs
├── security-testing/     # ZAP, semgrep configs
└── performance-testing/  # service-level benchmarks
```

## Status

Today's coverage:
- Unit + route-level tests: `services/*-service/test/` (Jest + supertest).
- API e2e: `apps/api/src/__tests__/core-loop.e2e.test.ts`.

Integration / load / chaos suites land here as they're authored.
