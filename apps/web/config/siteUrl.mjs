export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || (
    process.env.NODE_ENV === 'production' ? 'https://craftmyfunnel.live' : 'http://localhost:3001'
)).replace(/\/$/, '');
