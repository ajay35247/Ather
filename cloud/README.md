# cloud/

Per-cloud-provider IaC and configuration. The portable layer (Helm, k8s,
Docker) lives in [`../infra/`](../infra/); cloud-specific glue lives here.

## Proposed sub-tree

```
cloud/
├── aws/
│   ├── eks/
│   ├── ec2/
│   ├── lambda/
│   ├── rds/
│   ├── s3/
│   ├── cloudfront/
│   ├── route53/
│   ├── msk-kafka/
│   ├── elasticache/
│   ├── cognito/
│   ├── waf/
│   └── cloudwatch/
│
├── gcp/
└── azure/
```

## Status

Reserved. The deploy workflow ([`../.github/workflows/deploy.yml`](../.github/workflows/deploy.yml))
currently targets a generic Kubernetes cluster via Helm; cloud-specific
Terraform stacks land here when each cloud is brought online.
