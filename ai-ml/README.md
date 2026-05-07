# ai-ml/

Training, inference, and MLOps for every model that powers the platform —
ranking, recommendations, moderation, voice/image/video generation.

## Proposed sub-tree

```
ai-ml/
├── training/
├── inference/
├── recommendation-models/
├── ranking-models/
├── moderation-models/
├── voice-models/
├── image-models/
├── video-models/
├── reinforcement-learning/
├── feature-store/
├── datasets/
├── pipelines/
├── notebooks/
└── mlops/
```

## Status

Today's online ranking is the LightGBM v1 model served via Triton; the
deterministic Node fallback lives in
[`services/feed-service/src/ranker.ts`](../services/feed-service/src/ranker.ts)
and is fully unit-tested. AI-adjacent runtime services already exist as
[`services/ai-assistant-service`](../services/ai-assistant-service),
[`services/recommendations-service`](../services/recommendations-service),
[`services/vector-search-service`](../services/vector-search-service),
[`services/translation-service`](../services/translation-service),
[`services/moderation-service`](../services/moderation-service),
[`services/agent-orchestrator-service`](../services/agent-orchestrator-service),
[`services/knowledge-graph-service`](../services/knowledge-graph-service).

This `ai-ml/` directory is reserved for offline training assets and ML
pipelines (separate from runtime services).
