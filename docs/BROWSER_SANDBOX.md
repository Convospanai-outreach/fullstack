# Browser Sandbox Security

## Overview
The Browser Sandbox provides secure browser automation with resource limits and Chrome's native sandbox protection.

## Security Architecture

### Chrome Sandbox
Chrome's sandbox is a critical security feature that:
- Isolates browser processes from the system
- Prevents malicious code from accessing system resources
- Uses kernel-level security (user namespaces on Linux, integrity levels on Windows)

**⚠️ WARNING**: Running with `--no-sandbox` flag bypasses ALL these protections!

## Configuration

### Environment Variable
```bash
# .env
ENABLE_BROWSER_SANDBOX=true  # RECOMMENDED for production
ENABLE_BROWSER_SANDBOX=false # Development only
```

### Programmatic Configuration
```typescript
import { BrowserSandbox } from "@/lib/security/BrowserSandbox";

const browser = await BrowserSandbox.launch({
    maxMemory: 512,              // Max memory in MB
    sessionTimeout: 600000,      // 10 minutes
    enableSandbox: true,         // Enable Chrome sandbox
    blockedDomains: [            // Block trackers
        'doubleclick.net',
        'googleadservices.com'
    ],
    allowedDomains: [            // Optional: only allow specific domains
        'linkedin.com',
        'company.com'
    ]
});
```

## Platform-Specific Setup

### Linux (Production)

#### Check User Namespaces
```bash
# Verify user namespaces are enabled
sysctl kernel.unprivileged_userns_clone

# If disabled, enable it:
sudo sysctl -w kernel.unprivileged_userns_clone=1

# Make permanent:
echo 'kernel.unprivileged_userns_clone=1' | sudo tee -a /etc/sysctl.conf
```

#### Docker
```dockerfile
# Option 1: Add capability (less secure but works)
docker run --cap-add=SYS_ADMIN your-image

# Option 2: Disable seccomp (security trade-off)
docker run --security-opt seccomp=unconfined your-image

# Option 3: Use a full seccomp profile that also allows user namespaces (RECOMMENDED)
docker run --security-opt seccomp=chrome.json your-image
```

**Syscalls a profile must allow** (this entry alone is not a usable profile: with `defaultAction` set to `SCMP_ACT_ERRNO` every other syscall, including `execve`, is denied and the container cannot start). Add it to the `syscalls` list of Docker's default profile (`default.json` in the moby repository) or use a complete published Chrome profile:
```json
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "syscalls": [
    {
      "names": ["clone", "unshare", "setns"],
      "action": "SCMP_ACT_ALLOW"
    }
  ]
}
```

### Windows (Production)

Chrome sandbox works out-of-the-box on Windows with proper permissions:
- Requires administrator privileges OR
- Use containerization (Docker Desktop with Windows containers)

### macOS (Development)

Chrome sandbox works without additional configuration on macOS.

## Resource Limits

### Memory Limit
```typescript
BrowserSandbox.launch({ maxMemory: 512 }) // 512 MB limit
```

Enforced via Chrome args:
- `--max-old-space-size=512`
- `--disable-extensions`
- `--disable-plugins`

### Session Timeout
```typescript
BrowserSandbox.launch({ sessionTimeout: 300000 }) // 5 minutes
```

Automatically closes browser after timeout to prevent resource leaks.

### CPU Limit
Currently not enforced at browser level. Use container-level controls:
```bash
# Docker
docker run --cpus="0.5" your-image

# Kubernetes
resources:
  limits:
    cpu: "500m"
```

## URL Filtering

### Block Domains
```typescript
BrowserSandbox.launch({
    blockedDomains: [
        'ads.example.com',
        'tracker.com'
    ]
});

// Check if URL is allowed
const allowed = BrowserSandbox.isUrlAllowed(
    'https://ads.example.com', 
    config
); // false
```

### Allowlist Domains
```typescript
BrowserSandbox.launch({
    allowedDomains: [
        'linkedin.com',
        'company.com'
    ]
});
```

## Security Best Practices

### ✅ DO
- Enable sandbox in production (`ENABLE_BROWSER_SANDBOX=true`)
- Set resource limits appropriate to your workload
- Use domain allowlists for sensitive operations
- Monitor browser memory/CPU usage
- Use session timeouts to prevent leaks

### ❌ DON'T
- **Never** disable sandbox in production
- Don't trust user-supplied URLs without validation
- Don't run browser as root user
- Don't use `--no-sandbox` flag in production

## Troubleshooting

### Error: "Failed to move to new namespace"
**Cause**: User namespaces disabled on Linux  
**Fix**:
```bash
sudo sysctl -w kernel.unprivileged_userns_clone=1
```

### Error: "Failed to launch Chrome"
**Cause**: Missing Chrome dependencies  
**Fix** (Ubuntu/Debian):
```bash
sudo apt-get install -y \
  libnss3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libgbm1 \
  libasound2
```

### Docker Container Crashes
**Cause**: Insufficient shared memory  
**Fix**:
```bash
docker run --shm-size=2g your-image
```

## Enabling the sandbox in the Docker deployment

`ENABLE_BROWSER_SANDBOX` is read by every Chromium launch in `apps/api` (the scraper's `browserManager`, `services/browser/BrowserSandbox`, and the invoice PDF renderer) through `src/lib/security/chromiumSandbox.ts`. It defaults to off, which keeps `--no-sandbox`, because the API container cannot run Chromium's sandbox out of the box:

- Docker's default seccomp profile blocks the user-namespace syscalls the sandbox needs.
- Do **not** work around that with `--cap-add SYS_ADMIN`, `--privileged` or `seccomp=unconfined`; each removes more protection than the sandbox adds.

To turn it on for a container, in this order:

1. Confirm the host allows unprivileged user namespaces: `sysctl user.max_user_namespaces` must be above 0, `kernel.unprivileged_userns_clone` must be 1 where that sysctl exists (Debian/Ubuntu kernels), and `kernel.apparmor_restrict_unprivileged_userns` must be 0 where it exists (Ubuntu 23.10 and later), or an AppArmor profile must allow them.
2. Run the container with a seccomp profile that permits them, for example Docker's default profile with `clone`, `unshare` and `setns` added to its allow list (not the three-syscall example above on its own): `security_opt: ["seccomp=/path/to/profile.json"]` in the compose file.
3. Set `ENABLE_BROWSER_SANDBOX=true` in that VM's `.env` and recreate the container.
4. Check a scrape and an invoice PDF download both still work.

With the flag on and no usable sandbox, Chromium refuses to start ("No usable sandbox") instead of running unsandboxed, so a misconfiguration shows up as failed launches. To roll back, set the flag back to `false`.

Not yet verified on the Oracle VMs; test on one VM before the other.

## Migration Guide

### From Unsafe to Safe Configuration

**Before**:
```typescript
puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
});
```

**After**:
```typescript
import { BrowserSandbox } from "@/lib/security/BrowserSandbox";

BrowserSandbox.launch({
    enableSandbox: true,
    maxMemory: 512,
    sessionTimeout: 600000
});
```

## Performance Impact

Enabling Chrome sandbox has minimal performance impact:
- ~2-5% CPU overhead
- ~10-20 MB additional memory
- Startup time: +100-200ms

**Trade-off**: Security >>> Minimal performance cost

## Compliance

Secure browser automation is required for:
- SOC 2 compliance (access controls)
- PCI DSS (secure processing)
- GDPR (data protection)
- ISO 27001 (information security)

Running without sandbox may violate security audit requirements!

## Further Reading
- [Chrome Sandbox](https://chromium.googlesource.com/chromium/src/+/master/docs/design/sandbox.md)
- [Puppeteer Security](https://pptr.dev/guides/configuration#running-in-docker)
- [Docker Security](https://docs.docker.com/engine/security/)
