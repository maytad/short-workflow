import {
  claimNextJob,
  createDbClient,
  markJobFailedOrRetry,
  recoverStaleJobs,
  type DbClient,
  type JobRow,
} from "@short-workflow/db";

import { parseEnv } from "./env";
import { handleJob } from "./handlers";

const emptyQueueSleepMs = 2_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function workerLoop(db: DbClient) {
  while (true) {
    const job = (await claimNextJob(db)) as JobRow | null;

    if (!job) {
      await sleep(emptyQueueSleepMs);
      continue;
    }

    try {
      await handleJob(db, job);
    } catch (error) {
      await markJobFailedOrRetry(db, job, errorMessage(error));
    }
  }
}

export async function runWorker() {
  const env = parseEnv();
  const { db } = createDbClient(env.DATABASE_URL);

  await recoverStaleJobs(db);

  await Promise.all(
    Array.from({ length: env.WORKER_CONCURRENCY }, () => workerLoop(db)),
  );
}
