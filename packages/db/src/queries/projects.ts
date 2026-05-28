import { desc, eq, sql } from "drizzle-orm";

import type { DbClient } from "../client";
import type { JobRow, ProjectRow } from "../schema";
import { projects } from "../schema";

export type CreateProjectInput = {
  title: string;
  topic: string;
  targetDurationSeconds: 30 | 45 | 60;
};

export type UpdateProjectInput = {
  title?: string;
  topic?: string;
};

export type ProjectStatus = ProjectRow["status"];

type GenerationJobType = Extract<JobRow["type"], "generate_script" | "run_project_flow">;

export type ProjectGenerationFailure = {
  jobId: string;
  jobType: GenerationJobType;
  errorMessage: string | null;
  stage: string | null;
  reason: string | null;
  failedRole: string | null;
  createdAt: Date;
  finishedAt: Date | null;
};

export type ProjectYoutubeUpload = {
  jobId: string;
  youtubeVideoId: string;
  uploadedAt: Date | null;
};

export type ProjectWithLatestFailure = ProjectRow & {
  latestFailure: ProjectGenerationFailure | null;
  youtubeUpload: ProjectYoutubeUpload | null;
};

export type RecentTinyMechanismsTopicHint = Pick<
  ProjectRow,
  "id" | "title" | "topic" | "createdAt"
>;

type ProjectWithLatestGenerationJobRow = ProjectRow & {
  latestGenerationJobId: string | null;
  latestGenerationJobType: GenerationJobType | null;
  latestGenerationJobStatus: JobRow["status"] | null;
  latestGenerationJobErrorMessage: string | null;
  latestGenerationJobStage: string | null;
  latestGenerationJobReason: string | null;
  latestGenerationJobFailedRole: string | null;
  latestGenerationJobCreatedAt: Date | null;
  latestGenerationJobFinishedAt: Date | null;
  latestYoutubeUploadJobId: string | null;
  latestYoutubeUploadJobStatus: JobRow["status"] | null;
  latestYoutubeVideoId: string | null;
  latestYoutubeUploadedAt: string | null;
};

export async function createProject(db: DbClient, input: CreateProjectInput) {
  const [project] = await db.insert(projects).values(input).returning();

  if (!project) {
    throw new Error("project_insert_failed");
  }

  return project;
}

export async function getProject(db: DbClient, projectId: string) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

  return project ?? null;
}

export async function listProjects(db: DbClient) {
  return db.select().from(projects).orderBy(desc(projects.updatedAt));
}

export async function listRecentTinyMechanismsTopicHints(
  db: DbClient,
  options: { excludeProjectId?: string; limit?: number } = {},
): Promise<RecentTinyMechanismsTopicHint[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 8, 12));
  const excludeProject = options.excludeProjectId
    ? sql`and id <> ${options.excludeProjectId}`
    : sql``;
  const rows = (await db.execute(sql<RecentTinyMechanismsTopicHint>`
    select
      id,
      title,
      topic,
      created_at as "createdAt"
    from projects
    where topic like 'tiny_mechanisms:%'
      and topic <> 'tiny_mechanisms:pending'
      and status in ('ready', 'rendering', 'done')
      ${excludeProject}
    order by created_at desc
    limit ${limit}
  `)) as RecentTinyMechanismsTopicHint[];

  return rows.map((row) => ({
    ...row,
    createdAt: coerceDate(row.createdAt),
  }));
}

export async function listProjectsWithLatestGenerationFailure(
  db: DbClient,
): Promise<ProjectWithLatestFailure[]> {
  const rows = (await db.execute(sql<ProjectWithLatestGenerationJobRow>`
    select
      p.id,
      p.title,
      p.topic,
      p.status,
      p.target_duration_seconds as "targetDurationSeconds",
      p.language,
      p.format,
      p.created_at as "createdAt",
      p.updated_at as "updatedAt",
      latest_generation_job.id as "latestGenerationJobId",
      latest_generation_job.type as "latestGenerationJobType",
      latest_generation_job.status as "latestGenerationJobStatus",
      latest_generation_job.error_message as "latestGenerationJobErrorMessage",
      latest_generation_job.output->>'stage' as "latestGenerationJobStage",
      latest_generation_job.output->>'reason' as "latestGenerationJobReason",
      latest_generation_job.output->>'failedRole' as "latestGenerationJobFailedRole",
      latest_generation_job.created_at as "latestGenerationJobCreatedAt",
      latest_generation_job.finished_at as "latestGenerationJobFinishedAt",
      latest_youtube_upload_job.id as "latestYoutubeUploadJobId",
      latest_youtube_upload_job.status as "latestYoutubeUploadJobStatus",
      coalesce(
        latest_youtube_upload_job.output->>'youtubeVideoId',
        latest_youtube_upload_schedule.youtube_video_id
      ) as "latestYoutubeVideoId",
      latest_youtube_upload_job.output->>'uploadedAt' as "latestYoutubeUploadedAt"
    from projects p
    left join lateral (
      select
        id,
        type,
        status,
        error_message,
        output,
        created_at,
        finished_at
      from jobs
      where project_id = p.id
        and type in ('generate_script', 'run_project_flow')
      order by created_at desc
      limit 1
    ) latest_generation_job on true
    left join lateral (
      select
        id,
        status,
        output,
        created_at
      from jobs
      where project_id = p.id
        and type = 'upload_youtube'
      order by created_at desc
      limit 1
    ) latest_youtube_upload_job on true
    left join youtube_upload_schedules latest_youtube_upload_schedule
      on latest_youtube_upload_schedule.job_id = latest_youtube_upload_job.id
    order by p.updated_at desc
  `)) as ProjectWithLatestGenerationJobRow[];

  return rows.map(projectWithLatestGenerationFailure);
}

export async function updateProject(db: DbClient, projectId: string, input: UpdateProjectInput) {
  const values: Partial<Pick<ProjectRow, "title" | "topic">> = {};

  if (input.title !== undefined) {
    values.title = input.title;
  }

  if (input.topic !== undefined) {
    values.topic = input.topic;
  }

  const [project] = await db
    .update(projects)
    .set({ ...values, updatedAt: sql`now()` })
    .where(eq(projects.id, projectId))
    .returning();

  return project ?? null;
}

function projectWithLatestGenerationFailure(
  row: ProjectWithLatestGenerationJobRow,
): ProjectWithLatestFailure {
  const {
    latestGenerationJobId,
    latestGenerationJobType,
    latestGenerationJobStatus,
    latestGenerationJobErrorMessage,
    latestGenerationJobStage,
    latestGenerationJobReason,
    latestGenerationJobFailedRole,
    latestGenerationJobCreatedAt,
    latestGenerationJobFinishedAt,
    latestYoutubeUploadJobId,
    latestYoutubeUploadJobStatus,
    latestYoutubeVideoId,
    latestYoutubeUploadedAt,
    ...project
  } = row;
  const serializedProject = {
    ...project,
    createdAt: coerceDate(project.createdAt),
    updatedAt: coerceDate(project.updatedAt),
  };
  const youtubeUpload =
    latestYoutubeUploadJobId && latestYoutubeUploadJobStatus === "succeeded" && latestYoutubeVideoId
      ? {
          jobId: latestYoutubeUploadJobId,
          youtubeVideoId: latestYoutubeVideoId,
          uploadedAt: latestYoutubeUploadedAt ? coerceDate(latestYoutubeUploadedAt) : null,
        }
      : null;

  if (
    !latestGenerationJobId ||
    !latestGenerationJobType ||
    latestGenerationJobStatus !== "failed" ||
    !latestGenerationJobCreatedAt
  ) {
    return {
      ...serializedProject,
      latestFailure: null,
      youtubeUpload,
    };
  }

  return {
    ...serializedProject,
    latestFailure: {
      jobId: latestGenerationJobId,
      jobType: latestGenerationJobType,
      errorMessage: latestGenerationJobErrorMessage,
      stage: latestGenerationJobStage,
      reason: latestGenerationJobReason,
      failedRole: latestGenerationJobFailedRole,
      createdAt: coerceDate(latestGenerationJobCreatedAt),
      finishedAt: latestGenerationJobFinishedAt ? coerceDate(latestGenerationJobFinishedAt) : null,
    },
    youtubeUpload,
  };
}

function coerceDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

export async function deleteProjectRows(db: DbClient, projectId: string) {
  const [project] = await db.delete(projects).where(eq(projects.id, projectId)).returning();

  return project ?? null;
}

export async function setProjectStatus(db: DbClient, projectId: string, status: ProjectStatus) {
  const [project] = await db
    .update(projects)
    .set({ status, updatedAt: sql`now()` })
    .where(eq(projects.id, projectId))
    .returning();

  return project ?? null;
}
