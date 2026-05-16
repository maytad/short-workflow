import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export function createDbClient(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const client = postgres(connectionString, {
    max: 4,
    prepare: connectionString.includes("pooler.supabase.com:6543")
      ? false
      : true,
  });

  return {
    db: drizzle(client, { schema }),
    client,
  };
}

export type DbClient = ReturnType<typeof createDbClient>["db"];
