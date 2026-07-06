
export async function register() {
    if (process.env['NEXT_RUNTIME'] === 'nodejs') {
        const runtimeMode = process.env['CRAFTMYFUNNEL_RUNTIME_MODE'];
        const isVercelRuntime = process.env['VERCEL'] === '1' || Boolean(process.env['VERCEL_ENV']);
        const explicitlyEnabled = process.env['ENABLE_WEB_HARDWARE_VERIFY'] === 'true';
        const betaSkipEnabled = process.env['BETA_SKIP_HARDWARE_VERIFY'] === 'true';
        const shouldSkipHardwareVerification =
            isVercelRuntime ||
            !explicitlyEnabled ||
            runtimeMode === 'email_first_beta' ||
            betaSkipEnabled;

        if (shouldSkipHardwareVerification) {
            const reason = isVercelRuntime
                ? 'Vercel/serverless runtime'
                : !explicitlyEnabled
                    ? 'ENABLE_WEB_HARDWARE_VERIFY not set'
                    : runtimeMode === 'email_first_beta'
                        ? 'email_first_beta mode'
                        : betaSkipEnabled
                            ? 'BETA_SKIP_HARDWARE_VERIFY flag'
                            : 'serverless runtime';
            console.log(`Skipping hardware verification: ${reason}.`);
            return;
        }
        try {
            const { HardwareService } = await import('./services/HardwareService');
            // Only run on the server side
            console.log('Starting Hardware Verification...');
            await HardwareService.verifyHardwareIdentity();
        } catch (error) {
            console.warn('Warning: Hardware Verification Failed (Running in Software-Only Mode)');
            // throw new Error('Hardware verification failed'); // Disabled for Beta
        }
    }
}
