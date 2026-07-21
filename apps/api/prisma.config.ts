import "dotenv/config";
import { defineConfig } from "@prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "",          // Neon pooled connection (runtime)
    directUrl: process.env.DIRECT_URL ?? "",      // Neon direct connection (migrations)
  },
});
