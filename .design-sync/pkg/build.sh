#!/usr/bin/env bash
# Rebuilds the virtual @craftmyfunnel/ui-sync package: bundles the real
# component source (apps/web/src/components/**) with esbuild, aliasing
# next/link, next/image, next/navigation, and @clerk/nextjs to local stubs
# so the components render standalone; emits .d.ts via tsc; compiles the
# app's Tailwind v4 stylesheet to a static CSS file for the converter.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

node_modules/.bin/esbuild .design-sync/pkg/src/index.ts \
  --bundle --format=esm --platform=browser --jsx=automatic \
  --outfile=.design-sync/pkg/dist/index.js \
  --inject:.design-sync/pkg/src/stubs/process-shim.ts \
  --alias:next/link=./.design-sync/pkg/src/stubs/next-link.tsx \
  --alias:next/image=./.design-sync/pkg/src/stubs/next-image.tsx \
  --alias:next/navigation=./.design-sync/pkg/src/stubs/next-navigation.ts \
  --alias:@clerk/nextjs=./.design-sync/pkg/src/stubs/clerk-nextjs.ts \
  --external:react --external:react-dom --external:react/jsx-runtime \
  --external:lucide-react --external:class-variance-authority --external:clsx \
  --external:tailwind-merge --external:framer-motion \
  --external:@radix-ui/* \
  --log-level=info

node_modules/.bin/tsc -p .design-sync/pkg/tsconfig.json

# Flat re-export shim: package.json "types" must point here so the converter's
# ts-morph project root (dirname of "types") covers the whole dist/ tree —
# pointing "types" at the deeply-nested tsc output instead scopes ts-morph's
# glob to that one subdirectory and silently degrades every extracted prop
# type to `[key: string]: unknown`.
echo "export * from './.design-sync/pkg/src/index';" > .design-sync/pkg/dist/index.d.ts

node .design-sync/pkg/compile-tw.mjs
