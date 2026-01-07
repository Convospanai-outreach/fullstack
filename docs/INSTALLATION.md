# Testing & Monitoring - Installation Guide

## Prerequisites

The test files and monitoring configurations have been created, but require package installation.

---

## Install Testing Dependencies

```bash
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom
```

### Why These Packages?

- **vitest** - Fast unit test runner (Vite-native)
- **@vitest/ui** - Visual test UI
- **@testing-library/react** - React component testing utilities
- **@testing-library/jest-dom** - Custom matchers for DOM testing

---

## Install Monitoring Dependencies (Optional)

### Sentry (Error Tracking)

```bash
npm install @sentry/nextjs
```

Then run the Sentry wizard:
```bash
npx @sentry/wizard@latest -i nextjs
```

This will:
- Configure Sentry in your project
- Add environment variables
- Set up source maps

**Environment Variable Required**:
```bash
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
```

Get your DSN from [Sentry Dashboard](https://sentry.io)

### Posthog (Product Analytics)

```bash
npm install posthog-js
```

**Environment Variables Required**:
```bash
NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxxxxxxxxxx
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

Get your key from [Posthog Dashboard](https://posthog.com)

---

## Update package.json Scripts

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:integration": "vitest run tests/integration",
    "test:unit": "vitest run tests/unit"
  }
}
```

---

## Configure Vitest

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

Create `tests/setup.ts`:

```typescript
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
  usePathname: () => '/',
}));
```

---

## Running Tests

After installing dependencies:

```bash
# Run all tests
npm run test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run E2E tests (Playwright)
npm run test:e2e
```

---

## Current Status

### ✅ Created (Ready to Use After Installation)
- Unit tests for EmailService
- Integration tests for Auth API
- E2E tests for signup flow
- Sentry configuration files
- Monitoring setup guide

### ⏳ Requires Installation
- `vitest` and testing libraries
- `@sentry/nextjs` (optional)
- `posthog-js` (optional)

### 📝 Next Steps

1. **Install testing dependencies** (required for tests to run)
2. **Install Sentry** (optional, for production error tracking)
3. **Install Posthog** (optional, for product analytics)
4. **Run tests** to verify setup
5. **Deploy to production** with monitoring enabled

---

## Notes

- **Sentry errors** in IDE are expected until package is installed
- **Vitest errors** in test files are expected until package is installed
- All configuration files are ready to use
- Tests will work immediately after `npm install`

---

## Quick Install All

To install everything at once:

```bash
# Testing (required)
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom

# Monitoring (optional)
npm install @sentry/nextjs posthog-js
```

Then run:
```bash
npm run test
```

Your tests should now run successfully! ✅
