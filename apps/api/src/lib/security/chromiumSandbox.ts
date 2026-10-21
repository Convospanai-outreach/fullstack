/**
 * Chromium launch flags that switch its sandbox off.
 *
 * The sandbox is the barrier between a hostile page and the host, so ENABLE_BROWSER_SANDBOX=true
 * drops these flags. It stays opt-in because inside Docker the sandbox needs user namespaces,
 * which the default seccomp profile blocks (see docs/BROWSER_SANDBOX.md); with the flag on and no
 * usable sandbox Chromium fails to launch rather than silently running unsandboxed.
 */
export function chromiumSandboxArgs(): string[] {
    return process.env["ENABLE_BROWSER_SANDBOX"] === "true" ? [] : ["--no-sandbox", "--disable-setuid-sandbox"];
}
