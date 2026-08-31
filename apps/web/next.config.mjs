
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const isDevelopment = process.env.NODE_ENV !== 'production';
// Default local/CI builds avoid standalone trace-copy flakiness on Windows.
// Deploy targets can opt in explicitly via NEXT_OUTPUT_MODE=standalone.
const useStandaloneOutput =
    process.env.NEXT_OUTPUT_MODE === 'standalone' ||
    process.env.NEXT_USE_STANDALONE === 'true';
const usePackageImportOptimization =
    process.env.NEXT_OPTIMIZE_PACKAGE_IMPORTS !== 'false' &&
    process.env.NEXT_DISABLE_OPTIMIZE_PACKAGE_IMPORTS !== 'true';

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: useStandaloneOutput ? 'standalone' : undefined,
    reactStrictMode: true,
    compress: true,
    // Three.js / R3F are ESM-only packages — Next.js webpack must transpile them
    // or the 3D canvas will silently fail to load in production.
    transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
    turbopack: {
        root: repoRoot,
    },
    serverExternalPackages: [
        'ssh2',
        'docker-modem',
        '@genkit-ai/googleai',
        '@cfworker/json-schema',
        '@prisma/client',
        '@prisma/adapter-pg',
        'pg',
    ],
    experimental: {
        optimizePackageImports: isDevelopment || !usePackageImportOptimization
            ? []
            : ['lucide-react', 'recharts', 'date-fns', 'three', '@react-three/fiber', '@react-three/drei'],
    },
    images: {
        formats: ['image/avif', 'image/webp'],
        remotePatterns: [
            { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
            { protocol: 'https', hostname: '*.google.com' },
            { protocol: 'https', hostname: 'media.licdn.com' },
        ],
    },
    async headers() {
        return [
            {
                source: '/',
                headers: [
                    {
                        key: 'Link',
                        value: '</.well-known/api-catalog>; rel="api-catalog", </api/openapi.json>; rel="service-desc"; type="application/json", </docs>; rel="service-doc"; type="text/html", </llms.txt>; rel="describedby"; type="text/plain"',
                    },
                ],
            },
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'X-DNS-Prefetch-Control',
                        value: 'on',
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'SAMEORIGIN',
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=(), payment=()',
                    },
                    {
                        key: 'Strict-Transport-Security',
                        value: 'max-age=31536000; includeSubDomains; preload',
                    },
                ],
            },
            {
                source: '/images/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=31536000, immutable',
                    },
                ],
            },
            {
                source: '/(craftmyfunnel-logo.png|favicon.svg|favicon.ico|apple-touch-icon.png|favicon-16x16.png|favicon-32x32.png)',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=31536000, immutable',
                    },
                ],
            },
        ];
    },
    webpack(config) {
        // Ensure three.js ESM builds resolve correctly in the webpack graph
        config.resolve.extensionAlias = {
            ...config.resolve.extensionAlias,
            '.js': ['.ts', '.tsx', '.js', '.jsx'],
        };
        return config;
    },
};

export default nextConfig;
