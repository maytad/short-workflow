import { and, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";

import type { DbClient } from "../client";
import type { JobRow } from "../schema";
import { jobs } from "../schema";

export type { JobRow };

const activeJobStatuses = ["pending", "processing"] as const;

export type CreateJobInput = {
  projectId: string;
  sceneId: string | null;
  type: JobRow["type"];
  input: Record<string, unknown>;
  maxAttempts?: number;
};

export function retryDelaySeconds(attempts: number) {
  return Math.min(300, 30 * 2 ** Math.max(0, attempts - 1));
}

export async function createJobIdempotent(db: DbClient, input: CreateJobInput) {
  const [inserted] = await db
    .insert(jobs)
    .values({
      projectId: input.projectId,
      sceneId: input.sceneId,
      type: input.type,
      input: input.input,
      maxAttempts: input.maxAttempts ?? 5,
    })
    .onConflictDoNothing()
    .returning();

  if (inserted) {
    return inserted;
  }

  const [existing] = await db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.projectId, input.projectId),
        input.sceneId === null ? isNull(jobs.sceneId) : eq(jobs.sceneId, input.sceneId),
        eq(jobs.type, input.type),
        inArray(jobs.status, activeJobStatuses),
      ),
    )
    .orderBy(desc(jobs.createdAt))
    .limit(1);

  if (!existing) {
    throw new Error("active_job_not_found");
  }

  return existing;
}

export async function getJob(db: DbClient, jobId: string) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  return job ?? null;
}

export async function claimNextJob(db: DbClient) {
  const rows = await db.execute(sql<JobRow>`
    select
      id,
      project_id as "projectId",
      scene_id as "sceneId",
      type,
      status,
      attempts,
      max_attempts as "maxAttempts",
      parent_job_id as "parentJobId",
      error_message as "errorMessage",
      input,
      output,
      next_retry_at as "nextRetryAt",
      created_at as "createdAt",
      started_at as "startedAt",
      finished_at as "finishedAt",
      updated_at as "updatedAt"
    from claim_next_job()
  `);
  const job = rows[0];

  if (!isClaimedJobRow(job)) {
    return null;
  }

  return job;
}

export function isClaimedJobRow(row: unknown): row is JobRow {
  return (
    typeof row === "object" &&
    row !== null &&
    "id" in row &&
    typeof row.id === "string" &&
    "type" in row &&
    typeof row.type === "string"
  );
}

export async function markJobSucceeded(
  db: DbClient,
  jobId: string,
  output: Record<string, unknown>,
) {
  const [job] = await db
    .update(jobs)
    .set({
      status: "succeeded",
      output,
      finishedAt: sql`now()`,
      updatedAt: sql`now()`,
      nextRetryAt: null,
    })
    .where(eq(jobs.id, jobId))
    .returning();

  return job ?? null;
}

export async function markJobTerminallyFailed(
  db: DbClient,
  jobId: string,
  input: {
    errorMessage: string;
    output?: Record<string, unknown>;
  },
) {
  const [job] = await db
    .update(jobs)
    .set({
      status: "failed",
      errorMessage: input.errorMessage,
      output: input.output ?? null,
      finishedAt: sql`now()`,
      nextRetryAt: null,
      updatedAt: sql`now()`,
    })
    .where(eq(jobs.id, jobId))
    .returning();

  return job ?? null;
}

export async function markJobFailedOrRetry(db: DbClient, job: JobRow, errorMessage: string) {
  if (job.attempts < job.maxAttempts) {
    const [retriedJob] = await db
      .update(jobs)
      .set({
        status: "pending",
        errorMessage,
        startedAt: null,
        finishedAt: null,
        nextRetryAt: sql`now() + (${retryDelaySeconds(job.attempts)} * interval '1 second')`,
        updatedAt: sql`now()`,
      })
      .where(eq(jobs.id, job.id))
      .returning();

    return retriedJob ?? null;
  }

  const [failedJob] = await db
    .update(jobs)
    .set({
      status: "failed",
      errorMessage,
      finishedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(eq(jobs.id, job.id))
    .returning();

  return failedJob ?? null;
}

export async function retryFailedJob(db: DbClient, jobId: string) {
  const failedJob = await getJob(db, jobId);

  if (!failedJob || failedJob.status !== "failed") {
    throw new Error("retry_requires_failed_job");
  }

  const [retryJob] = await db
    .insert(jobs)
    .values({
      projectId: failedJob.projectId,
      sceneId: failedJob.sceneId,
      type: failedJob.type,
      input: failedJob.input,
      attempts: 0,
      maxAttempts: failedJob.maxAttempts,
      parentJobId: failedJob.id,
    })
    .returning();

  if (!retryJob) {
    throw new Error("job_retry_insert_failed");
  }

  return retryJob;
}

export async function touchProcessingJob(db: DbClient, jobId: string) {
  const [job] = await db
    .update(jobs)
    .set({
      updatedAt: sql`now()`,
    })
    .where(and(eq(jobs.id, jobId), eq(jobs.status, "processing")))
    .returning();

  return job ?? null;
}

export async function recoverStaleJobs(db: DbClient, olderThanMinutes = 10) {
  const threshold = new Date(Date.now() - olderThanMinutes * 60 * 1000);

  return db
    .update(jobs)
    .set({
      status: "pending",
      startedAt: null,
      updatedAt: sql`now()`,
    })
    .where(and(eq(jobs.status, "processing"), lt(jobs.updatedAt, threshold)))
    .returning();
}

export async function listProjectJobs(db: DbClient, projectId: string, status?: "active") {
  return db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.projectId, projectId),
        status === "active" ? inArray(jobs.status, activeJobStatuses) : undefined,
      ),
    )
    .orderBy(desc(jobs.createdAt));
}
