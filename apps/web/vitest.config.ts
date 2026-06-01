import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'node',
        globals: true,
        setupFiles: ['./tests/setup.ts'],
        exclude: ['**/node_modules/**', '**/e2e/**', '**/tests/verify-rate-limit.ts', '**/rag-integration.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            thresholds: {
                statements: 20,
                branches: 15,
                functions: 15,
                lines: 20,
            },
            exclude: [
                'node_modules/',
                'tests/',
                '**/*.d.ts',
                '**/*.config.*',
                '**/mockData',
                'dist/',
            ],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
