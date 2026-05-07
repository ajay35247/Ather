# infra/monitoring/

Observability stack configuration.

- `prometheus/` — scrape configs, recording rules
- `grafana/` — dashboards
- `loki/` — log pipeline
- `sentry/` — error-tracking config
- `alerts/` — alertmanager / on-call routing

Existing Prometheus/Grafana base lives in [`infra/observability/`](../observability/).
This directory holds higher-level org-wide configs going forward.
