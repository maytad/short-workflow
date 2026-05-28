import {
  claimNextJob,
  createDbClient,
  type DbClient,
  type JobRow,
  markJobFailedOrRetry,
  markJobTerminallyFailed,
  recoverStaleJobs,
  touchProcessingJob,
} from "@short-workflow/db";

import { parseEnv } from "./env";
import { isTerminalWorkflowError } from "./errors";
import { handleJob } from "./handlers";
import { logWorkerError, logWorkerInfo, type WorkerLogFields } from "./logger";

const emptyQueueSleepMs = 2_000;
const jobHeartbeatIntervalMs = 30_000;
const staleJobRecoveryIntervalMs = 30_000;

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

function startJobHeartbeat(db: DbClient, job: JobRow, workerIndex: number) {
  const timer = setInterval(() => {
    touchProcessingJob(db, job.id).catch((error: unknown) => {
      logWorkerError(
        "job_heartbeat_failed",
        jobLogFields(job, workerIndex, {
          errorMessage: errorMessage(error),
        }),
      );
    });
  }, jobHeartbeatIntervalMs);

  return () => clearInterval(timer);
}

async function recoverStaleJobsOnce(db: DbClient) {
  const recoveredJobs = await recoverStaleJobs(db);
  if (recoveredJobs.length > 0) {
    logWorkerInfo("stale_jobs_recovered", { count: recoveredJobs.length });
  }
}

async function staleJobRecoveryLoop(db: DbClient) {
  while (true) {
    await sleep(staleJobRecoveryIntervalMs);

    try {
      await recoverStaleJobsOnce(db);
    } catch (error) {
      logWorkerError("stale_jobs_recovery_failed", {
        errorMessage: errorMessage(error),
      });
    }
  }
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
    const stopHeartbeat = startJobHeartbeat(db, job, workerIndex);
    logWorkerInfo("job_claimed", jobLogFields(job, workerIndex));

    try {
      await handleJob(db, job);
      stopHeartbeat();
      logWorkerInfo(
        "job_succeeded",
        jobLogFields(job, workerIndex, {
          durationMs: Date.now() - startedAt,
        }),
      );
    } catch (error) {
      stopHeartbeat();
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

  await recoverStaleJobsOnce(db);

  await Promise.all([
    staleJobRecoveryLoop(db),
    ...Array.from({ length: env.WORKER_CONCURRENCY }, (_, workerIndex) =>
      workerLoop(db, workerIndex),
    ),
  ]);
}
