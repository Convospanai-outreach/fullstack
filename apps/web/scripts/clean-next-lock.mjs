import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";

const lockPath = path.join(process.cwd(), ".next", "lock");

if (existsSync(lockPath)) {
  try {
    await rm(lockPath, { force: true });
    console.log(`[clean-next-lock] Removed stale lock: ${lockPath}`);
  } catch (error) {
    console.warn(`[clean-next-lock] Failed to remove lock: ${lockPath}`, error);
  }
} else {
  console.log("[clean-next-lock] No lock file found");
}
