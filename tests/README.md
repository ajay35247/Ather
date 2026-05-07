# tests/

Cross-cutting test suites that span multiple services.

- `unit/` — shared unit-test utilities
- `integration/` — multi-service integration tests
- `e2e/` — end-to-end browser/API tests
- `load/` — load-test scenarios (k6, Artillery)
- `stress/` — stress / soak tests
- `security/` — security-focused tests (authz, rate-limit, fuzz)

Per-service unit tests still live alongside their service (e.g. `apps/api/src/__tests__`).
