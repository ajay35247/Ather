# analytics/

Dashboards, BI, and human-facing analytics surfaces. The runtime data plane
lives in [`../services/analytics-service`](../services/analytics-service);
this directory is for the consumer side.

## Proposed sub-tree

```
analytics/
├── realtime-dashboards/
├── business-intelligence/
├── creator-analytics/
├── ai-analytics/
├── retention-analytics/
├── engagement-analytics/
├── monetization-analytics/
└── experimentation/
```

## Status

Reserved. `analytics.events` is already a TimescaleDB-style partitioned
table (see `infra/postgres/migrations/0003_monetization.sql`); BI tooling
(e.g. Metabase / Superset / Cube) configuration will land here.
