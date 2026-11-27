const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

if (process.env.NODE_ENV === 'production' && !configuredAppUrl) {
    throw new Error('NEXT_PUBLIC_APP_URL is required for the production site build');
}

export const APP_URL = (configuredAppUrl || 'http://localhost:3000').replace(/\/$/, '');
