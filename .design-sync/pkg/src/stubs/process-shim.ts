// Next.js normally replaces `process.env.NEXT_PUBLIC_*` at build time; a
// plain esbuild bundle has no `process` global, so any component reading it
// directly (e.g. CommandPalette's `process.env['NEXT_PUBLIC_API_URL']`)
// throws at module-eval time in the browser. Inject a minimal stand-in.
(globalThis as any).process ??= { env: {} };
export {};
