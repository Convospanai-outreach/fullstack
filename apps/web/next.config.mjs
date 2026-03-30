
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDevelopment = process.env.NODE_ENV !== 'production';
const useStandaloneOutput = process.env.NEXT_OUTPUT_MODE === 'standalone';

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: useStandaloneOutput ? 'standalone' : undefined,
    reactStrictMode: true,
    compress: true,
    turbopack: {
        root: __dirname,
    },
    serverExternalPackages: ['ssh2', 'docker-modem', '@genkit-ai/googleai', '@cfworker/json-schema'],
    experimental: {
        optimizePackageImports: isDevelopment ? [] : ['lucide-react', 'recharts', 'date-fns'],
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
        ],
    },
};

export default nextConfig;
