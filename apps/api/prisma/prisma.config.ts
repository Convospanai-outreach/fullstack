import "dotenv/config";
import { defineConfig } from "@prisma/config";

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL ?? "",       // Supabase Transaction Pooler (runtime)
    directUrl: process.env.DIRECT_URL ?? "",  // Supabase Direct Connection (migrations)
  },
});
