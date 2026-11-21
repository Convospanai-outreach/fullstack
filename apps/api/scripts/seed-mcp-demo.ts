/**
 * Seeds the fictional "CraftMyFunnel Demo" workspace used for MCP directory review. It is the built-in demo
 * spec run through the same builder and writer as per-prospect tear-downs (src/scripts/teardown).
 *
 *   DEMO_OWNER_EMAIL=you@example.com tsx scripts/seed-mcp-demo.ts                    # dry run, writes nothing
 *   DEMO_OWNER_EMAIL=you@example.com tsx scripts/seed-mcp-demo.ts --apply            # writes
 *   DEMO_OWNER_EMAIL=you@example.com tsx scripts/seed-mcp-demo.ts --remove --apply   # deletes the demo rows
 */
import { main } from '../src/scripts/teardown/cli';
import { DEMO_SPEC } from '../src/scripts/teardown/demoSpec';

void main(() => DEMO_SPEC);
