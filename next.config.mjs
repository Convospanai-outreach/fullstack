
/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',
    reactStrictMode: true,
    compress: true,
    serverExternalPackages: ['ssh2', 'docker-modem', '@genkit-ai/googleai', '@cfworker/json-schema'],
    experimental: {
        optimizePackageImports: ['lucide-react', 'recharts', 'date-fns'],
    },
    optimizeFonts: false,
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
