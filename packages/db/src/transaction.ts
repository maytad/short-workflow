import { sql } from "drizzle-orm";

import type { DbClient } from "./client";

type TransactionalDbClient = DbClient & {
  transaction?: <T>(callback: (tx: DbClient) => Promise<T>) => Promise<T>;
};

export async function withDbTransaction<T>(
  db: DbClient,
  callback: (tx: DbClient) => Promise<T>,
) {
  const transactional = db as TransactionalDbClient;

  if (typeof transactional.transaction === "function") {
    return transactional.transaction((tx) => callback(tx as unknown as DbClient));
  }

  return callback(db);
}

export async function acquireAdvisoryTransactionLock(db: DbClient, key: string) {
  await db.execute(sql`select pg_advisory_xact_lock(hashtext(${key})::bigint)`);
}

export async function withAdvisoryTransactionLock<T>(
  db: DbClient,
  key: string,
  callback: (tx: DbClient) => Promise<T>,
) {
  return withDbTransaction(db, async (tx) => {
    await acquireAdvisoryTransactionLock(tx, key);
    return callback(tx);
  });
}
