
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
        optimizePackageImports: isDevelopment || !usePackageImportOptimization ? [] : ['lucide-react', 'recharts', 'date-fns'],
    },
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
            { protocol: 'https', hostname: '*.google.com' },
            { protocol: 'https', hostname: 'media.licdn.com' },
        ],
    },
};

export default nextConfig;
