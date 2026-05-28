# Infrastructure Architecture for Global Expansion

## Current Status: India-Focused Deployment

CraftMyFunnel is currently deployed with infrastructure optimized for the Indian market, but architected with global expansion capabilities.

## Database Architecture

### Current Setup (India)

**Primary Database**: Neon Postgres (Mumbai Region)
- Connection: Direct via DATABASE_URL
- Use case: All read/write operations
- Location: `ap-south-1` (Mumbai)

**Configuration**:
```env
DATABASE_URL="postgresql://user:pass@ep-xxx.ap-south-1.aws.neon.tech/craftmyfunnel"
DIRECT_URL="postgresql://user:pass@ep-xxx.ap-south-1.aws.neon.tech/craftmyfunnel" # For migrations
```

### Future Global Expansion Architecture

When expanding globally, the architecture is designed to support multi-region read replicas:

```
┌─────────────────────────────────────────────────────────┐
│                   Global Architecture                    │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌───────────────┐      ┌───────────────┐      ┌──────────────┐
│  │ India (Primary)│      │ EU (Replica)  │      │ US (Replica) │
│  │   Mumbai      │◄────►│   Frankfurt   │◄────►│  N.Virginia  │
│  │   (Write)     │      │   (Read-only) │      │  (Read-only) │
│  └───────────────┘      └───────────────┘      └──────────────┘
│        ▲                        ▲                      ▲
│        │                        │                      │
│        └────────────────────────┴──────────────────────┘
│                    Neon Database Replication
│
└─────────────────────────────────────────────────────────┘
```

#### Read Replica Configuration (Future)

**Europe (EU-West)**:
```env
DATABASE_REPLICA_EU="postgresql://user:pass@ep-xxx.eu-west-1.aws.neon.tech/craftmyfunnel"
```

**United States (US-East)**:
```env
DATABASE_REPLICA_US="postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/craftmyfunnel"
```

**Asia-Pacific (Singapore)** - Additional coverage:
```env
DATABASE_REPLICA_APAC="postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/craftmyfunnel"
```

## Application Deployment

### Current Setup

**Platform**: Vercel (Mumbai Region Preference)
- Automatic deployment from `main` branch
- Edge functions for API routes
- Static assets via Vercel CDN

**Environment Variables**:
```bash
# Database
DATABASE_URL=<Neon Mumbai>
DIRECT_URL=<Neon Mumbai>

# Redis (Upstash Mumbai)
REDIS_URL=<Upstash Mumbai>

# LLM Providers
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=AIza...
GROQ_API_KEY=gsk_...
ANTHROPIC_API_KEY=sk-ant-...
```

### Future Global Deployment

**Multi-Region Edge Functions**:
- Vercel Edge will automatically route to nearest region
- Database client will route reads to nearest replica
- Writes always go to primary (Mumbai)

**Geographic Routing Logic**:
```typescript
// Future implementation in db-replica.ts
const getOptimalReplica = (userIp: string) => {
  const region = detectRegion(userIp);
  
  switch(region) {
    case 'EU': return process.env.DATABASE_REPLICA_EU;
    case 'US': return process.env.DATABASE_REPLICA_US;
    case 'APAC': return process.env.DATABASE_REPLICA_APAC;
    default: return process.env.DATABASE_URL; // India primary
  }
};
```

## Redis Cache

### Current Setup

**Provider**: Upstash Redis (Mumbai)
```env
REDIS_URL=rediss://default:xxx@apac-mumbai-123.upstash.io:6379
```

**Usage**:
- LLM response caching
- Provider health status
- Session management
- Job queues

### Future Expansion

**Multi-Region Redis**:
- Upstash Global Database (auto-replicated)
- Or regional instances:
  - `REDIS_URL_EU` for Europe
  - `REDIS_URL_US` for US
  - Automatic routing based on user location

## CDN and Static Assets

### Current Setup

**Vercel CDN**: Global edge network
- Automatic caching of static assets
- Next.js image optimization
- Edge functions close to users

### Future Enhancements

**Cloudflare Integration** (Optional):
- DDoS protection
- Advanced caching rules
- Geographic load balancing
- Custom routing logic

## Failover Strategy

### Database Failover

**Current**: Single primary (no failover needed for MVP)

**Future**: Automatic promotion
```
If Mumbai primary fails:
1. Promote Frankfurt replica to primary
2. Update DNS/connection strings
3. Notify engineering team
4. Rebuild Mumbai as replica when recovered
```

**Implementation**: 
- Neon's built-in failover capabilities
- Or manual DNS failover via Cloudflare

### Application Failover

**Vercel Edge Functions**: Built-in redundancy
- Automatic retry on edge function failure
- Fallback to different edge location
- No manual intervention needed

## Monitoring

### Current Monitoring

**Vercel Analytics**:
- Request latency by region
- Error rates
- Function execution time

**Database Monitoring** (Neon Console):
- Query performance
- Connection pool usage
- Storage metrics

### Future Monitoring

**Multi-Region Dashboards**:
- Latency heatmaps by geography
- Replica lag monitoring
- Automatic alerts for >100ms lag
- Cost tracking per region

**Tools**:
- Sentry for error tracking
- Datadog/NewRelic for APM (optional)
- Custom dashboard in Next.js admin

## Cost Optimization

### Current Costs (India-Only)

| Service | Tier | Monthly Cost |
|---------|------|-------------|
| Neon DB | Free/Pro | $0-25 |
| Vercel | Hobby/Pro | $0-20 |
| Upstash Redis | Free | $0 |
| LLM APIs | Usage-based | ~$50-200 |
| **Total** | | **~$50-245/mo** |

### Future Global Costs (Est.)

| Service | Tier | Monthly Cost |
|---------|------|-------------|
| Neon DB Primary + 3 Replicas | Pro | $75-150 |
| Vercel Enterprise | Team | $80+ |
| Upstash Redis Global | Paid | $20-50 |
| LLM APIs | Usage-based | $200-1000+ |
| **Total** | | **~$375-1280/mo** |

## Migration Playbook (Future)

### Phase 1: Add EU Replica
1. Enable Neon read replica in `eu-west-1`
2. Update `db-replica.ts` to route EU traffic
3. Monitor replica lag (<50ms target)
4. Verify read performance improvement

### Phase 2: Add US Replica
1. Enable Neon read replica in `us-east-1`
2. Update routing logic for US users
3. Test failover scenarios
4. Monitor cross-region latency

### Phase 3: Optimize Routing
1. Implement smart geo-routing
2. Cache strategy per region
3. Optimize for data locality
4. A/B test performance gains

## Security Considerations

### Data Residency

**India (Current)**:
- All data stored in Mumbai
- Compliant with DPDP Act 2023
- No cross-border data transfer

**Global (Future)**:
- User data stays in home region (configurable)
- Replicas only for metadata and public data
- PII masked before cross-region sync
- Compliance with GDPR, CCPA, DPDP

### Network Security

**Current**:
- TLS/SSL for all connections
- Vercel Edge Network security
- Environment variable encryption

**Future**:
- VPN between regions (if needed)
- Private database endpoints
- IP whitelisting for admin access

## Implementation Checklist

### Ready Now ✅
- [x] Single-region (India) deployment
- [x] Neon Postgres with connection pooling
- [x] Redis caching layer
- [x] Vercel CDN global distribution

### Ready for Global Expansion 🚀
- [ ] Add `db-replica.ts` with geo-routing
- [ ] Configure read replicas in Neon
- [ ] Update connection strings
- [ ] Test failover scenarios
- [ ] Monitor replica lag
- [ ] Update documentation

### Future Optimizations 🔮
- [ ] Cloudflare enterprise integration
- [ ] Advanced caching strategies
- [ ] Multi-region Redis clusters
- [ ] Custom edge routing logic
- [ ] Real-time analytics dashboard

---

## Contact for Infrastructure Changes

**Owner**: DevOps/Platform Team  
**Escalation**: CTO  
**Documentation**: This file + Neon Console  

For global expansion, revisit this document and implement the "Migration Playbook" steps sequentially.
