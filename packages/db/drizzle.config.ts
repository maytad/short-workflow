import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_DIRECT_URL) {
  throw new Error("DATABASE_DIRECT_URL is required for Drizzle Kit");
}

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_DIRECT_URL,
  },
});
