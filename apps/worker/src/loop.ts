import {
  claimNextJob,
  createDbClient,
  markJobFailedOrRetry,
  markJobTerminallyFailed,
  recoverStaleJobs,
  type DbClient,
  type JobRow,
} from "@short-workflow/db";

import { parseEnv } from "./env";
import { isTerminalWorkflowError } from "./errors";
import { handleJob } from "./handlers";
import { logWorkerError, logWorkerInfo, type WorkerLogFields } from "./logger";

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

function jobLogFields(job: JobRow, workerIndex: number, extra?: WorkerLogFields): WorkerLogFields {
  return {
    workerIndex,
    jobId: job.id,
    projectId: job.projectId,
    sceneId: job.sceneId,
    type: job.type,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    ...extra,
  };
}

async function workerLoop(db: DbClient, workerIndex: number) {
  logWorkerInfo("worker_loop_started", { workerIndex });

  while (true) {
    const job = (await claimNextJob(db)) as JobRow | null;

    if (!job) {
      await sleep(emptyQueueSleepMs);
      continue;
    }

    const startedAt = Date.now();
    logWorkerInfo("job_claimed", jobLogFields(job, workerIndex));

    try {
      await handleJob(db, job);
      logWorkerInfo(
        "job_succeeded",
        jobLogFields(job, workerIndex, {
          durationMs: Date.now() - startedAt,
        }),
      );
    } catch (error) {
      const message = errorMessage(error);
      const updatedJob = isTerminalWorkflowError(error)
        ? await markJobTerminallyFailed(db, job.id, {
            errorMessage: message,
            output: error.output,
          })
        : await markJobFailedOrRetry(db, job, message);
      const status = updatedJob?.status ?? "failed";
      const event = status === "pending" ? "job_retry_scheduled" : "job_failed";

      logWorkerError(
        event,
        jobLogFields(job, workerIndex, {
          durationMs: Date.now() - startedAt,
          errorMessage: message,
          nextRetryAt: updatedJob?.nextRetryAt?.toISOString() ?? null,
          status,
        }),
      );
    }
  }
}

export async function runWorker() {
  const env = parseEnv();
  const { db } = createDbClient(env.DATABASE_URL);
  logWorkerInfo("worker_starting", { concurrency: env.WORKER_CONCURRENCY });

  const recoveredJobs = await recoverStaleJobs(db);
  if (recoveredJobs.length > 0) {
    logWorkerInfo("stale_jobs_recovered", { count: recoveredJobs.length });
  }

  await Promise.all(
    Array.from({ length: env.WORKER_CONCURRENCY }, (_, workerIndex) => workerLoop(db, workerIndex)),
  );
}
