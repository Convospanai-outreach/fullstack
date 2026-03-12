
/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    reactStrictMode: true,
    compress: true,
    experimental: {
        optimizePackageImports: ['lucide-react', 'recharts', 'date-fns'],
        serverComponentsExternalPackages: ['ssh2', 'docker-modem', '@genkit-ai/googleai'],
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
