
const esbuild = require('esbuild');
const path = require('path');

async function compile() {
    console.log('🚀 Compiling Server and Worker...');

    try {
        // 1. Compile Custom Server
        await esbuild.build({
            entryPoints: ['server.ts'],
            bundle: true,
            platform: 'node',
            target: 'node20',
            outfile: '.next/standalone/server-custom.js',
            external: ['next', 'socket.io', '@prisma/client', 'fsevents'],
            format: 'cjs',
        });
        console.log('✅ server-custom.js compiled.');

        // 2. Compile Worker
        await esbuild.build({
            entryPoints: ['src/workers/index.ts'],
            bundle: true,
            platform: 'node',
            target: 'node20',
            outfile: '.next/standalone/worker.js',
            external: ['@prisma/client', 'fsevents'],
            format: 'cjs',
            alias: {
                '@': path.resolve(__dirname, '../src'),
            },
        });
        console.log('✅ worker.js compiled.');

    } catch (err) {
        console.error('❌ Compilation failed:', err);
        process.exit(1);
    }
}

compile();
