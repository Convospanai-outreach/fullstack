import "dotenv/config";
import { defineConfig } from "@prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "",          // Supabase pooled connection (runtime)
    directUrl: process.env.DIRECT_URL ?? "",      // Supabase direct connection (migrations)
  },
});
