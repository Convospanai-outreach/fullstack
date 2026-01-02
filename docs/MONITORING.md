# Monitoring Setup Guide

## Sentry Integration (Error Tracking)

### 1. Install Sentry

```bash
npm install @sentry/nextjs
```

### 2. Configure Sentry

The Sentry configuration files are already created:
- `sentry.client.config.ts` - Client-side error tracking
- `sentry.server.config.ts` - Server-side error tracking

### 3. Add Environment Variable

Add to `.env.local`:
```bash
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
```

Get your DSN from [Sentry Dashboard](https://sentry.io) → Settings → Projects → Client Keys (DSN)

### 4. Vercel Integration

In Vercel Dashboard:
1. Go to Settings → Integrations
2. Add Sentry integration
3. Connect your Sentry project
4. Environment variables will be added automatically

### 5. Test Sentry

Add a test error to any page:
```typescript
throw new Error('Test Sentry error');
```

Check Sentry dashboard for the error.

---

## Posthog Integration (Product Analytics)

### 1. Install Posthog

```bash
npm install posthog-js
```

### 2. Create Posthog Provider

File: `src/providers/PosthogProvider.tsx`

```typescript
'use client';

import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { useEffect } from 'react';

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
        capture_pageviews: true,
        capture_pageleaves: true,
      });
    }
  }, []);

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
```

### 3. Add to Providers

Update `src/app/providers.tsx`:
```typescript
import { PHProvider } from '@/providers/PosthogProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PHProvider>
        {children}
      </PHProvider>
    </SessionProvider>
  );
}
```

### 4. Add Environment Variables

```bash
NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxxxxxxxxxx
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

### 5. Track Events

```typescript
import { usePostHog } from 'posthog-js/react';

function MyComponent() {
  const posthog = usePostHog();

  const handleClick = () => {
    posthog.capture('button_clicked', {
      button_name: 'signup',
      page: 'landing'
    });
  };
}
```

### 6. Key Events to Track

- User signup
- Email verification
- Campaign creation
- Lead import
- Credit purchase
- Message sent
- Subscription upgrade

---

## Performance Monitoring

### Web Vitals

Next.js automatically tracks Web Vitals. View them in Vercel Analytics.

### Custom Performance Tracking

```typescript
import { performance } from 'perf_hooks';

const start = performance.now();
// ... your code
const end = performance.now();
console.log(`Operation took ${end - start}ms`);
```

---

## Logging Best Practices

### Development
```typescript
console.log('Debug info:', data);
```

### Production
```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.captureMessage('Important event', {
  level: 'info',
  extra: { data }
});
```

### Error Logging
```typescript
try {
  // risky operation
} catch (error) {
  Sentry.captureException(error, {
    tags: { feature: 'billing' },
    extra: { userId, amount }
  });
}
```

---

## Monitoring Checklist

- [ ] Sentry installed and configured
- [ ] Sentry DSN added to environment variables
- [ ] Test error sent to Sentry
- [ ] Posthog installed (optional)
- [ ] Posthog key added to environment
- [ ] Key events tracked
- [ ] Error boundaries integrated with Sentry
- [ ] Performance monitoring enabled

---

## Vercel Analytics

Vercel provides built-in analytics:
1. Go to Vercel Dashboard → Analytics
2. View:
   - Page views
   - Unique visitors
   - Top pages
   - Web Vitals
   - Real User Monitoring

Enable in `next.config.js`:
```javascript
module.exports = {
  experimental: {
    webVitalsAttribution: ['CLS', 'LCP']
  }
}
```

---

## Cost Considerations

### Sentry
- **Free**: 5,000 errors/month
- **Team**: $26/month for 50,000 errors
- **Business**: $80/month for 150,000 errors

### Posthog
- **Free**: 1M events/month
- **Paid**: $0.00031/event after free tier

### Vercel Analytics
- **Free**: Included with Hobby plan
- **Pro**: Advanced analytics included

---

## Support

- Sentry Docs: https://docs.sentry.io/platforms/javascript/guides/nextjs/
- Posthog Docs: https://posthog.com/docs
- Vercel Analytics: https://vercel.com/docs/analytics
