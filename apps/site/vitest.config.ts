import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
    test: {
        setupFiles: ['./tests/setup.ts'],
        testTimeout: 30_000,
        exclude: ['**/node_modules/**', '**/.next/**', '**/e2e/**'],
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
            '@craftmyfunnel/ui': path.resolve(__dirname, '../../packages/ui'),
        },
    },
});
