
export async function register() {
    if (process.env['NEXT_RUNTIME'] === 'nodejs') {
        const runtimeMode = process.env['CRAFTMYFUNNEL_RUNTIME_MODE'];
        const isVercelRuntime = process.env['VERCEL'] === '1' || Boolean(process.env['VERCEL_ENV']);
        const explicitlyEnabled = process.env['ENABLE_WEB_HARDWARE_VERIFY'] === 'true';
        const skipHardwareVerification = process.env['BETA_SKIP_HARDWARE_VERIFY'] === 'true'
            || runtimeMode === 'email_first_beta'
            || isVercelRuntime
            || !explicitlyEnabled;

        if (skipHardwareVerification) {
            console.log('Skipping hardware verification for web serverless runtime.');
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
