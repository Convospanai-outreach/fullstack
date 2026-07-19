import "dotenv/config";
import { defineConfig } from "@prisma/config";

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL ?? "",          // Neon pooled connection (runtime)
    directUrl: process.env.DIRECT_URL ?? "",      // Neon direct connection (migrations)
  },
});
