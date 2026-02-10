# Build Instructions (Updated)

**Date:** February 9, 2026

## ✅ Memory Configuration Fix Applied

The build process has been permanently updated to prevent `JavaScript heap out of memory` errors.

You can now run the standard build command:
```bash
npm run build
```

This command automatically sets the memory limit to **8GB** using `cross-env`, ensuring reliability on all platforms (Windows, Linux, macOS).

**You do NOT need to set environment variables manually anymore.**

---

## Technical Details

The `package.json` build script was updated:
- **Before:** `"build": "prisma generate && next build"`
- **After:** `"build": "cross-env NODE_OPTIONS='--max-old-space-size=8192' prisma generate && cross-env NODE_OPTIONS='--max-old-space-size=8192' next build"`

This ensures TypeScript compilation has enough memory to complete successfully.
