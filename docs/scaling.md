# Scaling & Deployment

## Cloud

- **AWS primary**, multi-region (`us-east-1`, `eu-west-1`, `ap-south-1` — India-first launch region).
- Multi-AZ within each region; multi-region active-active for **read paths** by Phase 2.

## Compute

- **EKS (Kubernetes)** per region.
- HPA on CPU **and** custom metrics (queue depth, p95 latency).
- Node groups segregated for: stateless API, websocket fleet, batch/AI workers.

## Data tier

| Concern        | Service                                    |
|----------------|--------------------------------------------|
| Relational     | Aurora Postgres (global database)          |
| Messages       | DynamoDB global tables (later) / Postgres  |
| Cache          | ElastiCache Redis (cluster mode)           |
| Events         | MSK (Kafka) with tiered storage            |
| Search         | OpenSearch                                 |
| Vectors        | pgvector (Phase 1) → Milvus (when needed)  |
| Time-series    | ClickHouse (analytics, ads metrics)        |
| Object         | S3 + CloudFront                            |

## Media pipeline

- Pre-signed S3 PUT → SNS notification → MediaConvert (HLS/DASH ladder) → S3 → CloudFront.
- Thumbnail service generates derivatives on-the-fly (Lambda@Edge or container).

## Real-time

- WebSocket fleet behind NLB with **sticky sessions**.
- Redis pub/sub for cross-node fan-out.
- Presence sharded by `hash(user_id) mod N`.

## CI/CD

- **GitHub Actions** for build + test + scan.
- Image registry: ECR.
- Delivery: **ArgoCD** with progressive rollout (canary → percentage rollout → full).
- Auto-rollback on **SLO burn** (error budget breach within window).

## Observability

- **OpenTelemetry** end-to-end.
- Tempo / Jaeger (traces), Prometheus (metrics), Loki (logs), Grafana (dashboards), PagerDuty (alerts).
- Per-service SLOs, error budgets gate release.

## Scaling milestones

| Users | Architecture stance |
|-------|---------------------|
| 1M    | Single region, "monolith-light per service", vertical scale where cheap. |
| 10M   | Read replicas; Kafka-driven fan-out feed; Redis cluster mode. |
| 100M  | Multi-region active-active reads; user-home-region for writes; sharded DBs by `user_id`. |
| 1B    | **Cell-based architecture** — each cell = full stack for ~50M users; edge AI inference; per-country regulatory enclaves. |

## Cost discipline

- FinOps tagging from day one (`service`, `env`, `team`, `cost_center`).
- Cache aggressively at the edge; egress from object storage is the biggest single line item at scale.
- Reserved + savings plans for steady-state; spot for batch and AI training.
