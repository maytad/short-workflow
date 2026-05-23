import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

import type { DbClient } from "../client";
import {
  jobs,
  projects,
  promptVersions,
  scenes,
  youtubeAnalyticsSnapshots,
  youtubeVideoDiagnoses,
  youtubeVideoLinks,
  type YoutubeAnalyticsSnapshotRow,
  type YoutubeVideoDiagnosisRow,
  type YoutubeVideoLinkRow,
} from "../schema";

export type { YoutubeAnalyticsSnapshotRow, YoutubeVideoDiagnosisRow, YoutubeVideoLinkRow };

export type UpsertYoutubeVideoLinkInput = {
  youtubeVideoId: string;
  projectId: string | null;
  uploadJobId: string | null;
  source: "db_upload" | "channel_discovery";
  linkStatus: "linked" | "unlinked";
  title: string;
  description: string | null;
  publishedAt: Date | null;
  durationSeconds: number | null;
  privacyStatus: string | null;
  lastSyncedAt: Date;
};

export type CreateYoutubeAnalyticsSnapshotInput = {
  youtubeVideoLinkId: string;
  youtubeVideoId: string;
  windowDays: number;
  views: number | null;
  engagedViews: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  subscribersGained: number | null;
  averageViewDurationSeconds: number | null;
  averageViewPercentage: number | null;
  viewsPerHour: number | null;
  likeRate: number | null;
  rawDataApi: Record<string, unknown>;
  rawAnalyticsApi: Record<string, unknown>;
};

export type UpsertYoutubeVideoDiagnosisInput = {
  youtubeVideoLinkId: string;
  snapshotId: string;
  diagnosisType: "rule_based" | "ai";
  model: string | null;
  reasoningEffort: string | null;
  inputHash: string;
  summaryTh: string;
  suggestionsEn: Record<string, unknown>;
  rawOutput: Record<string, unknown>;
};

export type RecentYoutubeCreativePromptContext = {
  youtubeVideoId: string;
  title: string;
  views: number | null;
  engagedViews: number | null;
  averageViewPercentage: number | null;
  averageViewDurationSeconds: number | null;
  viewsPerHour: number | null;
  likeRate: number | null;
  hookNarration: string | null;
  hookCaption: string | null;
  hookImagePrompt: string | null;
};

export function normalizeYoutubeMetricNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function youtubeVideoUrl(youtubeVideoId: string) {
  return `https://www.youtube.com/watch?v=${youtubeVideoId}`;
}

export async function upsertYoutubeVideoLink(db: DbClient, input: UpsertYoutubeVideoLinkInput) {
  const [row] = await db
    .insert(youtubeVideoLinks)
    .values(input)
    .onConflictDoUpdate({
      target: youtubeVideoLinks.youtubeVideoId,
      set: {
        projectId: input.projectId,
        uploadJobId: input.uploadJobId,
        source: input.source,
        linkStatus: input.linkStatus,
        title: input.title,
        description: input.description,
        publishedAt: input.publishedAt,
        durationSeconds: input.durationSeconds,
        privacyStatus: input.privacyStatus,
        lastSyncedAt: input.lastSyncedAt,
        updatedAt: sql`now()`,
      },
    })
    .returning();

  if (!row) {
    throw new Error("youtube_video_link_upsert_failed");
  }

  return row;
}

export async function createYoutubeAnalyticsSnapshot(
  db: DbClient,
  input: CreateYoutubeAnalyticsSnapshotInput,
) {
  const [row] = await db.insert(youtubeAnalyticsSnapshots).values(input).returning();

  if (!row) {
    throw new Error("youtube_analytics_snapshot_insert_failed");
  }

  return row;
}

export async function upsertYoutubeVideoDiagnosis(
  db: DbClient,
  input: UpsertYoutubeVideoDiagnosisInput,
) {
  const [row] = await db
    .insert(youtubeVideoDiagnoses)
    .values(input)
    .onConflictDoUpdate({
      target: [
        youtubeVideoDiagnoses.youtubeVideoLinkId,
        youtubeVideoDiagnoses.diagnosisType,
        youtubeVideoDiagnoses.inputHash,
      ],
      set: {
        snapshotId: input.snapshotId,
        model: input.model,
        reasoningEffort: input.reasoningEffort,
        summaryTh: input.summaryTh,
        suggestionsEn: input.suggestionsEn,
        rawOutput: input.rawOutput,
        updatedAt: sql`now()`,
      },
    })
    .returning();

  if (!row) {
    throw new Error("youtube_video_diagnosis_upsert_failed");
  }

  return row;
}

export async function getYoutubeVideoLinkByVideoId(db: DbClient, youtubeVideoId: string) {
  const [row] = await db
    .select()
    .from(youtubeVideoLinks)
    .where(eq(youtubeVideoLinks.youtubeVideoId, youtubeVideoId))
    .limit(1);

  return row ?? null;
}

export async function listRecentYoutubeVideoLinks(db: DbClient, since: Date) {
  return db
    .select()
    .from(youtubeVideoLinks)
    .where(gte(youtubeVideoLinks.publishedAt, since))
    .orderBy(desc(youtubeVideoLinks.publishedAt));
}

export async function listRecentYoutubeCreativePromptContext(
  db: DbClient,
  input: { limit?: number; since?: Date } = {},
): Promise<RecentYoutubeCreativePromptContext[]> {
  const limit = input.limit ?? 12;
  const where = input.since ? gte(youtubeVideoLinks.publishedAt, input.since) : undefined;

  const baseQuery = db
    .select({
      youtubeVideoId: youtubeVideoLinks.youtubeVideoId,
      title: youtubeVideoLinks.title,
      projectId: youtubeVideoLinks.projectId,
      views: youtubeAnalyticsSnapshots.views,
      engagedViews: youtubeAnalyticsSnapshots.engagedViews,
      averageViewPercentage: youtubeAnalyticsSnapshots.averageViewPercentage,
      averageViewDurationSeconds: youtubeAnalyticsSnapshots.averageViewDurationSeconds,
      viewsPerHour: youtubeAnalyticsSnapshots.viewsPerHour,
      likeRate: youtubeAnalyticsSnapshots.likeRate,
    })
    .from(youtubeVideoLinks)
    .leftJoin(
      youtubeAnalyticsSnapshots,
      eq(youtubeAnalyticsSnapshots.youtubeVideoLinkId, youtubeVideoLinks.id),
    );

  const rows = await (where ? baseQuery.where(where) : baseQuery)
    .orderBy(desc(youtubeVideoLinks.publishedAt), desc(youtubeAnalyticsSnapshots.snapshotAt))
    .limit(limit * 3);

  const latestByVideoId = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latestByVideoId.has(row.youtubeVideoId)) {
      latestByVideoId.set(row.youtubeVideoId, row);
    }
  }

  const contexts: RecentYoutubeCreativePromptContext[] = [];
  for (const row of [...latestByVideoId.values()].slice(0, limit)) {
    const hook = row.projectId
      ? await db
          .select({
            narration: scenes.narration,
            caption: scenes.caption,
            imagePrompt: scenes.imagePrompt,
          })
          .from(scenes)
          .where(and(eq(scenes.projectId, row.projectId), eq(scenes.role, "hook")))
          .orderBy(scenes.position)
          .limit(1)
      : [];

    contexts.push({
      youtubeVideoId: row.youtubeVideoId,
      title: row.title,
      views: row.views,
      engagedViews: row.engagedViews,
      averageViewPercentage: row.averageViewPercentage,
      averageViewDurationSeconds: row.averageViewDurationSeconds,
      viewsPerHour: row.viewsPerHour,
      likeRate: row.likeRate,
      hookNarration: hook[0]?.narration ?? null,
      hookCaption: hook[0]?.caption ?? null,
      hookImagePrompt: hook[0]?.imagePrompt ?? null,
    });
  }

  return contexts;
}

export async function listLatestYoutubeAnalyticsSnapshots(
  db: DbClient,
  youtubeVideoLinkIds: string[],
  options: { windowDays?: number } = {},
) {
  if (youtubeVideoLinkIds.length === 0) {
    return [];
  }

  const where =
    options.windowDays === undefined
      ? inArray(youtubeAnalyticsSnapshots.youtubeVideoLinkId, youtubeVideoLinkIds)
      : and(
          inArray(youtubeAnalyticsSnapshots.youtubeVideoLinkId, youtubeVideoLinkIds),
          eq(youtubeAnalyticsSnapshots.windowDays, options.windowDays),
        );

  const rows = await db
    .select()
    .from(youtubeAnalyticsSnapshots)
    .where(where)
    .orderBy(desc(youtubeAnalyticsSnapshots.snapshotAt));

  return latestYoutubeAnalyticsSnapshots(rows);
}

export function latestYoutubeAnalyticsSnapshots<
  T extends Pick<YoutubeAnalyticsSnapshotRow, "youtubeVideoLinkId" | "snapshotAt">,
>(rows: T[]) {
  const latestByLinkId = new Map<string, T>();
  for (const row of [...rows].sort(
    (left, right) => right.snapshotAt.getTime() - left.snapshotAt.getTime(),
  )) {
    if (!latestByLinkId.has(row.youtubeVideoLinkId)) {
      latestByLinkId.set(row.youtubeVideoLinkId, row);
    }
  }

  return [...latestByLinkId.values()];
}

export async function listLatestYoutubeVideoDiagnoses(
  db: DbClient,
  input: {
    youtubeVideoLinkIds: string[];
    diagnosisType?: "rule_based" | "ai";
    windowDays?: number;
  },
) {
  if (input.youtubeVideoLinkIds.length === 0) {
    return [];
  }

  const where = input.diagnosisType
    ? and(
        inArray(youtubeVideoDiagnoses.youtubeVideoLinkId, input.youtubeVideoLinkIds),
        eq(youtubeVideoDiagnoses.diagnosisType, input.diagnosisType),
      )
    : inArray(youtubeVideoDiagnoses.youtubeVideoLinkId, input.youtubeVideoLinkIds);

  const rows =
    input.windowDays === undefined
      ? await db
          .select()
          .from(youtubeVideoDiagnoses)
          .where(where)
          .orderBy(desc(youtubeVideoDiagnoses.updatedAt))
      : (
          await db
            .select({ diagnosis: youtubeVideoDiagnoses })
            .from(youtubeVideoDiagnoses)
            .innerJoin(
              youtubeAnalyticsSnapshots,
              eq(youtubeVideoDiagnoses.snapshotId, youtubeAnalyticsSnapshots.id),
            )
            .where(and(where, eq(youtubeAnalyticsSnapshots.windowDays, input.windowDays)))
            .orderBy(desc(youtubeVideoDiagnoses.updatedAt))
        ).map((row) => row.diagnosis);

  return latestYoutubeVideoDiagnoses(rows);
}

export function latestYoutubeVideoDiagnoses<
  T extends Pick<
    YoutubeVideoDiagnosisRow,
    "youtubeVideoLinkId" | "diagnosisType" | "createdAt" | "updatedAt"
  >,
>(rows: T[]) {
  const latestByLinkAndType = new Map<string, T>();
  for (const row of [...rows].sort(compareYoutubeDiagnosisRecency)) {
    const key = `${row.youtubeVideoLinkId}:${row.diagnosisType}`;
    if (!latestByLinkAndType.has(key)) {
      latestByLinkAndType.set(key, row);
    }
  }

  return [...latestByLinkAndType.values()];
}

function compareYoutubeDiagnosisRecency<
  T extends Pick<YoutubeVideoDiagnosisRow, "createdAt" | "updatedAt">,
>(a: T, b: T) {
  return (
    b.updatedAt.getTime() - a.updatedAt.getTime() ||
    b.createdAt.getTime() - a.createdAt.getTime()
  );
}

export async function listYoutubeUploadVideoMappings(db: DbClient) {
  const youtubeVideoId = sql<string>`coalesce(${jobs.output}->>'youtubeVideoId', ${jobs.input}->>'youtubeVideoId')`;

  return db
    .select({
      youtubeVideoId,
      projectId: jobs.projectId,
      uploadJobId: jobs.id,
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.type, "upload_youtube"),
        eq(jobs.status, "succeeded"),
        sql`${youtubeVideoId} is not null`,
      ),
    );
}

export async function getYoutubeCreativeContext(db: DbClient, youtubeVideoId: string) {
  const [link] = await db
    .select()
    .from(youtubeVideoLinks)
    .where(eq(youtubeVideoLinks.youtubeVideoId, youtubeVideoId))
    .limit(1);

  if (!link?.projectId) {
    return null;
  }

  const [project] = await db.select().from(projects).where(eq(projects.id, link.projectId)).limit(1);
  const [hook] = await db
    .select()
    .from(scenes)
    .where(and(eq(scenes.projectId, link.projectId), eq(scenes.role, "hook")))
    .orderBy(scenes.position)
    .limit(1);
  const promptRows = await db
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.projectId, link.projectId))
    .orderBy(desc(promptVersions.createdAt));

  if (!project) {
    return null;
  }

  const scriptPrompt = promptRows.find((row) => row.purpose === "script");
  const imagePrompt = promptRows.find((row) => row.purpose === "image_prompt");
  const seedId = project.topic.startsWith("tiny_mechanisms:")
    ? project.topic.replace("tiny_mechanisms:", "")
    : null;

  return {
    projectId: project.id,
    projectTitle: project.title,
    topic: project.topic,
    seedId,
    appealTier: null,
    mechanismFamily: null,
    hookNarration: hook?.narration ?? null,
    hookCaption: hook?.caption ?? null,
    hookImagePrompt: hook?.imagePrompt ?? null,
    visualHookArchetype: null,
    scriptPromptVersion: scriptPrompt?.revision ?? null,
    imagePromptVersion: imagePrompt?.revision ?? null,
  };
}
