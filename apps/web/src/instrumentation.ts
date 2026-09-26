import * as Sentry from '@sentry/nextjs';

export async function register() {
    if (process.env['NEXT_RUNTIME'] === 'nodejs') {
        // Initialise Sentry first, before the hardware-verify logic can early-return
        // (which it does whenever ENABLE_WEB_HARDWARE_VERIFY is unset, i.e. in prod).
        // No-op until SENTRY_DSN is provisioned.
        const sentryDsn = process.env['SENTRY_DSN'];
        Sentry.init({
            ...(sentryDsn ? { dsn: sentryDsn } : {}),
            tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
            debug: false,
            environment: process.env.NODE_ENV || 'development',
            beforeSend(event) {
                if (process.env.NODE_ENV === 'development') {
                    return null;
                }
                return event;
            },
        });

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

// Reports server/SSR errors to Sentry. Next 16 calls this hook automatically.
export const onRequestError = Sentry.captureRequestError;
