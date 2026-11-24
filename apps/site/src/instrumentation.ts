import * as Sentry from '@sentry/nextjs';
import { scrubBreadcrumb, scrubEvent } from './lib/sentryScrub';

export async function register() {
    if (process.env['NEXT_RUNTIME'] !== 'nodejs') return;
    const dsn = process.env['SENTRY_DSN'];
    Sentry.init({
        ...(dsn ? { dsn } : {}),
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        environment: process.env.NODE_ENV || 'development',
        sendDefaultPii: false,
        beforeSend: scrubEvent,
        beforeSendTransaction: scrubEvent,
        beforeBreadcrumb: scrubBreadcrumb,
    });
}

export const onRequestError = Sentry.captureRequestError;
