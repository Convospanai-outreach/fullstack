import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";

const nextDir = path.join(process.cwd(), ".next");
const lockPath = path.join(nextDir, "lock");

if (existsSync(nextDir)) {
  try {
    // Windows can briefly hold handles to trace files after interrupted builds.
    // A clean .next directory removes stale nft references that can trigger ENOENT.
    await rm(nextDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
    console.log(`[clean-next-lock] Removed stale Next build artifacts: ${nextDir}`);
  } catch (error) {
    console.warn(`[clean-next-lock] Failed to remove Next build artifacts: ${nextDir}`, error);

    if (existsSync(lockPath)) {
      try {
        await rm(lockPath, { force: true, maxRetries: 3, retryDelay: 150 });
        console.log(`[clean-next-lock] Removed fallback lock file: ${lockPath}`);
      } catch (lockError) {
        console.warn(`[clean-next-lock] Failed to remove fallback lock file: ${lockPath}`, lockError);
      }
    }
  }
} else {
  console.log("[clean-next-lock] No existing .next artifacts found");
}
