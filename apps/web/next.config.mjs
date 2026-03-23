
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    reactStrictMode: true,
    compress: true,
    turbopack: {
        root: __dirname,
    },
    serverExternalPackages: ['ssh2', 'docker-modem', '@genkit-ai/googleai', '@cfworker/json-schema'],
    experimental: {
        optimizePackageImports: ['lucide-react', 'recharts', 'date-fns'],
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
