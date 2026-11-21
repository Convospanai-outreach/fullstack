/**
 * Builds one isolated, fictional sample-funnel workspace per prospect (a "tear-down") from a JSON spec.
 *
 *   OWNER_EMAIL=you@example.com npx tsx src/scripts/teardown.ts --spec <spec.json>            # dry run, writes nothing
 *   OWNER_EMAIL=you@example.com npx tsx src/scripts/teardown.ts --spec <spec.json> --apply    # writes
 *   OWNER_EMAIL=you@example.com npx tsx src/scripts/teardown.ts --spec <spec.json> --remove --apply
 *
 * Specs name real prospects, so keep them OUT of this public repo (e.g. D:\cmf-private\teardowns\). Only the
 * fictional starters in ./teardown/specs are committed. See docs/TEARDOWN_RUNBOOK.md.
 */
import { main, readSpec } from './teardown/cli';

const i = process.argv.indexOf('--spec');
const path = i >= 0 ? process.argv[i + 1] : undefined;
void main(() => {
  if (!path) throw new Error('Pass --spec <path to a JSON spec>.');
  return readSpec(path);
});
