import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withSentryConfig } from '@sentry/nextjs';
import { APP_URL } from './config/appUrl.mjs';
import { appRewriteSources } from './config/appRewrites.mjs';
import { appPaths } from './config/appPaths.mjs';
import { loadSiteRedirects, toNextRedirects } from './config/siteRedirects.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';
const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://www.googletagmanager.com https://www.google-analytics.com https://static.cloudflareinsights.com https://us-assets.i.posthog.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.google.com",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://*.google-analytics.com https://www.googletagmanager.com https://cloudflareinsights.com https://us.i.posthog.com https://us-assets.i.posthog.com" + (isProduction ? '' : ' localhost:* 127.0.0.1:* ws://localhost:*'),
    "frame-src 'self' https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isProduction ? ['upgrade-insecure-requests'] : []),
].join('; ');

/** @type {import('next').NextConfig} */
const config = {
    reactStrictMode: true,
    poweredByHeader: false,
    compress: true,
    turbopack: { root: path.resolve(directory, '../..') },
    experimental: { cpus: 2 },
    images: {
        formats: ['image/avif', 'image/webp'],
        remotePatterns: [
            { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
            { protocol: 'https', hostname: '*.google.com' },
            { protocol: 'https', hostname: 'media.licdn.com' },
        ],
    },
    async headers() {
        return [{
            source: '/',
            headers: [{
                key: 'Link',
                value: '</.well-known/api-catalog>; rel="api-catalog", </api/openapi.json>; rel="service-desc"; type="application/json", </docs>; rel="service-doc"; type="text/html", </llms.txt>; rel="describedby"; type="text/plain"',
            }],
        }, {
            source: '/:path*',
            headers: [
                { key: 'Content-Security-Policy', value: csp },
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'X-Frame-Options', value: 'DENY' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()' },
                { key: 'X-XSS-Protection', value: '0' },
                { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
            ],
        }];
    },
    async redirects() {
        const legacy = [
            ['/use-cases', '/industries'],
            ['/use-cases/cybersecurity', '/industries/cybersecurity'],
            ['/use-cases/security-services', '/industries/gcc-services'],
            ['/use-cases/facility-management', '/industries/gcc-services'],
            ['/use-cases/managed-it-cloud', '/industries/managed-it-cloud'],
            ['/use-cases/managed-services', '/industries/managed-it-cloud'],
            ['/use-cases/ai-data-erp', '/industries/sap-erp'],
            ['/use-cases/staffing', '/industries/staffing'],
            ['/use-cases/consulting', '/industries/dpdp-consulting'],
            ['/use-cases/training', '/industries'],
            ['/use-cases/regions/:region', '/regions/:region'],
            ['/funnel', '/'],
        ];
        return [
            {
                source: '/pricing',
                has: [{ type: 'query', key: 'checkout', value: 'cancelled' }],
                destination: `${APP_URL}/pricing/manage`,
                permanent: false,
            },
            ...legacy.map(([source, destination]) => ({ source, destination, permanent: false })),
            ...appPaths.map(source => ({ source, destination: `${APP_URL}${source}`, permanent: false })),
        ].concat(
            toNextRedirects(loadSiteRedirects()),
        );
    },
    async rewrites() {
        return appRewriteSources.map(source => ({ source, destination: `${APP_URL}${source}` }));
    },
};

export default withSentryConfig(config, { silent: !process.env.CI });
