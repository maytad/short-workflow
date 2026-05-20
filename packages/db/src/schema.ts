import { sql } from "drizzle-orm";
import {
  check,
  bigserial,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const projectStatusEnum = pgEnum("project_status", [
  "draft",
  "ready",
  "rendering",
  "done",
  "failed",
]);
export const sceneStatusEnum = pgEnum("scene_status", ["draft", "ready"]);
export const sceneRoleEnum = pgEnum("scene_role", ["hook", "context", "point", "payoff", "cta"]);
export const assetKindEnum = pgEnum("asset_kind", [
  "image",
  "audio",
  "render",
  "thumbnail",
  "render_input",
  "caption_timing",
]);
export const assetStatusEnum = pgEnum("asset_status", ["pending", "ready", "failed"]);
export const storageDriverEnum = pgEnum("storage_driver", ["local"]);
export const assetProviderEnum = pgEnum("asset_provider", [
  "openai",
  "google_gemini",
  "google_tts",
  "remotion",
  "local",
  "elevenlabs",
]);
export const jobTypeEnum = pgEnum("job_type", [
  "generate_script",
  "generate_scene_image",
  "generate_scene_audio",
  "render_video",
  "upload_youtube",
  "run_project_flow",
]);
export const jobStatusEnum = pgEnum("job_status", ["pending", "processing", "succeeded", "failed"]);
export const renderStatusEnum = pgEnum("render_status", [
  "pending",
  "processing",
  "succeeded",
  "failed",
]);
export const promptPurposeEnum = pgEnum("prompt_purpose", [
  "script",
  "image_prompt",
  "ssml",
  "caption",
]);

const now = sql`now()`;

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  topic: text("topic").notNull(),
  status: projectStatusEnum("status").notNull().default("draft"),
  targetDurationSeconds: integer("target_duration_seconds").notNull().default(45),
  language: text("language").notNull().default("en"),
  format: text("format").notNull().default("vertical_9_16"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(now),
});

export const scenes = pgTable(
  "scenes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    role: sceneRoleEnum("role").notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    narration: text("narration").notNull().default(""),
    caption: text("caption").notNull().default(""),
    imagePrompt: text("image_prompt").notNull().default(""),
    ssml: text("ssml").notNull().default(""),
    status: sceneStatusEnum("status").notNull().default("draft"),
    contentUpdatedAt: timestamp("content_updated_at", { withTimezone: true })
      .notNull()
      .default(now),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(now),
  },
  (table) => [uniqueIndex("scenes_one_position_per_project").on(table.projectId, table.position)],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sceneId: uuid("scene_id").references(() => scenes.id, {
      onDelete: "cascade",
    }),
    type: jobTypeEnum("type").notNull(),
    status: jobStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    parentJobId: uuid("parent_job_id"),
    errorMessage: text("error_message"),
    input: jsonb("input").notNull().default({}),
    output: jsonb("output"),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(now),
  },
  (table) => [
    index("jobs_project_status_created_at_idx").on(
      table.projectId,
      table.status,
      table.createdAt.desc(),
    ),
    index("jobs_retry_claim_idx").on(table.status, table.nextRetryAt, table.createdAt),
    index("jobs_processing_started_at_idx")
      .on(table.startedAt)
      .where(sql`${table.status} = 'processing'`),
    check(
      "jobs_scene_id_per_type",
      sql`
        case ${table.type}::text
          when 'generate_script' then ${table.sceneId} is null
          when 'render_video' then ${table.sceneId} is null
          when 'upload_youtube' then ${table.sceneId} is null
          when 'run_project_flow' then ${table.sceneId} is null
          when 'generate_scene_image' then ${table.sceneId} is not null
          when 'generate_scene_audio' then ${table.sceneId} is not null
          else false
        end
      `,
    ),
    uniqueIndex("jobs_one_active_project_job")
      .on(table.projectId, table.type)
      .where(sql`${table.sceneId} is null and ${table.status} in ('pending', 'processing')`),
    uniqueIndex("jobs_one_active_scene_job")
      .on(table.sceneId, table.type)
      .where(sql`${table.sceneId} is not null and ${table.status} in ('pending', 'processing')`),
  ],
);

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sceneId: uuid("scene_id").references(() => scenes.id, {
      onDelete: "cascade",
    }),
    kind: assetKindEnum("kind").notNull(),
    storageDriver: storageDriverEnum("storage_driver").notNull().default("local"),
    path: text("path").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    checksum: text("checksum"),
    status: assetStatusEnum("status").notNull().default("pending"),
    provider: assetProviderEnum("provider").notNull(),
    model: text("model"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(now),
  },
  (table) => [
    index("assets_scene_kind_created_ready_idx")
      .on(table.sceneId, table.kind, table.createdAt.desc())
      .where(sql`${table.status} = 'ready'`),
  ],
);

export const renders = pgTable("renders", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  status: renderStatusEnum("status").notNull().default("pending"),
  inputAssetId: uuid("input_asset_id").references(() => assets.id),
  outputAssetId: uuid("output_asset_id").references(() => assets.id),
  durationSeconds: integer("duration_seconds").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  fps: integer("fps").notNull(),
  aiDisclosureAcknowledgedAt: timestamp("ai_disclosure_acknowledged_at", {
    withTimezone: true,
  }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(now),
});

export const youtubeUploadSchedules = pgTable(
  "youtube_upload_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    renderId: uuid("render_id")
      .notNull()
      .references(() => renders.id, { onDelete: "cascade" }),
    outputAssetId: uuid("output_asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    scheduledPublishAt: timestamp("scheduled_publish_at", { withTimezone: true }).notNull(),
    timezone: text("timezone").notNull(),
    status: text("status").notNull().default("reserved"),
    youtubeVideoId: text("youtube_video_id"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(now),
  },
  (table) => [
    check(
      "youtube_upload_schedules_status_check",
      sql`${table.status} in ('reserved', 'uploading', 'scheduled', 'failed', 'cancelled')`,
    ),
    index("youtube_upload_schedules_project_created_at_idx").on(
      table.projectId,
      table.createdAt.desc(),
    ),
    index("youtube_upload_schedules_publish_at_idx").on(table.scheduledPublishAt),
    uniqueIndex("youtube_upload_schedules_one_active_publish_slot")
      .on(table.scheduledPublishAt)
      .where(sql`${table.status} in ('reserved', 'uploading', 'scheduled')`),
  ],
);

export const youtubeVideoLinks = pgTable(
  "youtube_video_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    youtubeVideoId: text("youtube_video_id").notNull(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    uploadJobId: uuid("upload_job_id").references(() => jobs.id, { onDelete: "set null" }),
    source: text("source").notNull(),
    linkStatus: text("link_status").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds"),
    privacyStatus: text("privacy_status"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(now),
  },
  (table) => [
    uniqueIndex("youtube_video_links_video_id_idx").on(table.youtubeVideoId),
    index("youtube_video_links_project_idx").on(table.projectId),
    index("youtube_video_links_published_at_idx").on(table.publishedAt.desc()),
    check(
      "youtube_video_links_source_check",
      sql`${table.source} in ('db_upload', 'channel_discovery')`,
    ),
    check("youtube_video_links_status_check", sql`${table.linkStatus} in ('linked', 'unlinked')`),
  ],
);

export const youtubeAnalyticsSnapshots = pgTable(
  "youtube_analytics_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    youtubeVideoLinkId: uuid("youtube_video_link_id")
      .notNull()
      .references(() => youtubeVideoLinks.id, { onDelete: "cascade" }),
    youtubeVideoId: text("youtube_video_id").notNull(),
    snapshotAt: timestamp("snapshot_at", { withTimezone: true }).notNull().default(now),
    windowDays: integer("window_days").notNull(),
    views: integer("views"),
    engagedViews: integer("engaged_views"),
    likes: integer("likes"),
    comments: integer("comments"),
    shares: integer("shares"),
    subscribersGained: integer("subscribers_gained"),
    averageViewDurationSeconds: integer("average_view_duration_seconds"),
    averageViewPercentage: numeric("average_view_percentage", { mode: "number" }),
    viewsPerHour: numeric("views_per_hour", { mode: "number" }),
    likeRate: numeric("like_rate", { mode: "number" }),
    rawDataApi: jsonb("raw_data_api").notNull().default({}),
    rawAnalyticsApi: jsonb("raw_analytics_api").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
  },
  (table) => [
    index("youtube_analytics_snapshots_link_time_idx").on(
      table.youtubeVideoLinkId,
      table.snapshotAt.desc(),
    ),
    index("youtube_analytics_snapshots_video_time_idx").on(
      table.youtubeVideoId,
      table.snapshotAt.desc(),
    ),
    check("youtube_analytics_snapshots_window_days_check", sql`${table.windowDays} > 0`),
  ],
);

export const youtubeVideoDiagnoses = pgTable(
  "youtube_video_diagnoses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    youtubeVideoLinkId: uuid("youtube_video_link_id")
      .notNull()
      .references(() => youtubeVideoLinks.id, { onDelete: "cascade" }),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => youtubeAnalyticsSnapshots.id, { onDelete: "cascade" }),
    diagnosisType: text("diagnosis_type").notNull(),
    model: text("model"),
    reasoningEffort: text("reasoning_effort"),
    inputHash: text("input_hash").notNull(),
    summaryTh: text("summary_th").notNull(),
    suggestionsEn: jsonb("suggestions_en").notNull().default({}),
    rawOutput: jsonb("raw_output").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(now),
  },
  (table) => [
    index("youtube_video_diagnoses_link_created_idx").on(
      table.youtubeVideoLinkId,
      table.createdAt.desc(),
    ),
    uniqueIndex("youtube_video_diagnoses_input_hash_idx").on(
      table.youtubeVideoLinkId,
      table.diagnosisType,
      table.inputHash,
    ),
    check("youtube_video_diagnoses_type_check", sql`${table.diagnosisType} in ('rule_based', 'ai')`),
  ],
);

export const promptVersions = pgTable(
  "prompt_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sceneId: uuid("scene_id").references(() => scenes.id, {
      onDelete: "cascade",
    }),
    purpose: promptPurposeEnum("purpose").notNull(),
    provider: assetProviderEnum("provider").notNull(),
    model: text("model"),
    revision: integer("revision").notNull(),
    promptPayload: jsonb("prompt_payload").notNull(),
    responseText: text("response_text"),
    responseMetadata: jsonb("response_metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
  },
  (table) => [
    index("prompt_versions_history_idx").on(
      table.projectId,
      table.sceneId,
      table.purpose,
      table.revision.desc(),
    ),
  ],
);

export const appMigrations = pgTable("app_migrations", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: text("name").notNull().unique(),
  checksum: text("checksum").notNull(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().default(now),
});

export type ProjectRow = typeof projects.$inferSelect;
export type SceneRow = typeof scenes.$inferSelect;
export type AssetRow = typeof assets.$inferSelect;
export type JobRow = typeof jobs.$inferSelect;
export type RenderRow = typeof renders.$inferSelect;
export type YoutubeUploadScheduleRow = typeof youtubeUploadSchedules.$inferSelect;
export type YoutubeVideoLinkRow = typeof youtubeVideoLinks.$inferSelect;
export type YoutubeAnalyticsSnapshotRow = typeof youtubeAnalyticsSnapshots.$inferSelect;
export type YoutubeVideoDiagnosisRow = typeof youtubeVideoDiagnoses.$inferSelect;
export type PromptVersionRow = typeof promptVersions.$inferSelect;
