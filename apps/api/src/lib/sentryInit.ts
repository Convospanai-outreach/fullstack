// Side-effect import: must be the FIRST import of each entrypoint (server.ts,
// src/workers/start-workers.ts) so Sentry is initialised before anything else runs.
import { initSentry } from "./sentry";

initSentry();
