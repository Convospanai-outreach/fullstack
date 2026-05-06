import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
    test: {
        environment: "node",
        globals: true,
        include: [
            "routes/**/*.test.ts",
            "routes/**/__tests__/**/*.test.ts",
            "src/**/*.test.ts",
            "src/**/__tests__/**/*.test.ts"
        ],
        exclude: [
            "**/node_modules/**",
            "**/dist/**",
            "src/modules/rag/__tests__/rag-integration.test.ts"
        ],
        testTimeout: 15000
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src")
        }
    }
});
