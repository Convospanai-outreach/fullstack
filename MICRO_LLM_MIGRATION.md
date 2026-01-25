# Micro-LLM Backend Replacement

## Change Summary

**Previous**: Mistral 7B Instruct v0.2 (Apache 2.0)  
**Current**: Phi-3-mini-4k Instruct (MIT License)

## Reason for Change

- Target platform: Raspberry Pi 4 (4GB RAM)
- RAM footprint reduced: 5GB → 2.8GB
- Stricter token limits for deterministic latency
- MIT license eliminates Apache 2.0 compliance overhead

## Configuration Changes

| Parameter | Before | After |
|-----------|--------|-------|
| Model | Mistral 7B Q4_K_M | Phi-3-mini Q4 |
| Model Size | ~4.4GB | ~2.3GB |
| RAM Usage | ~5GB | ~2.8GB |
| Context Window | 2048 tokens | 512 tokens |
| Max Output | Unlimited | 128 tokens |
| Timeout | 2000ms | 1000ms |
| License | Apache 2.0 | MIT |

## Files Modified

1. `MICRO_LLM_DEPLOYMENT.md` - Updated deployment guide
2. `scripts/deploy-micro-llm.ps1` - Windows deployment script
3. `scripts/deploy-micro-llm.sh` - Linux/Pi deployment script
4. `src/ai/MicroLLMClient.ts` - Reduced timeout to 1000ms

## Unchanged

- API contracts (`MicroLLMRequest`, `MicroLLMResponse`)
- Task taxonomy (4 task types)
- No cloud fallback
- No retries
- Stateless execution
- RAG, ranking, and verification logic

## Validation

Run existing verification:
```bash
npx tsx scripts/test-micro-llm.ts
```

Expected behavior: Same deterministic output, faster timeout enforcement.

## Deployment

```bash
cd /home/pi/convo
./scripts/deploy-micro-llm.sh
sudo systemctl enable micro-llm
sudo systemctl start micro-llm
```
