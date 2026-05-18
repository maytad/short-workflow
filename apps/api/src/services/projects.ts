import { execFile } from "node:child_process";
import { access, readFile, rm } from "node:fs/promises";
import path, { join } from "node:path";
import { promisify } from "node:util";

import {
  createJobIdempotent,
  deleteProjectRows,
  getProject,
  getYoutubeScheduleForJob,
  listProjectAssets,
  listProjectRenders,
  listProjectScenes,
  type AssetRow,
  type DbClient,
  type JobRow,
  type SceneRow,
  type YoutubeUploadScheduleRow,
} from "@short-workflow/db";
import {
  type BulkAssetQueueResponse,
  type YoutubeUploadMode,
  formatYoutubeDescriptionWithHashtags,
  youtubeMetadataSchema,
  youtubeUploadJobInputSchema,
  youtubeTagKeywords,
  youtubeUploadJobOutputSchema,
} from "@short-workflow/shared";

import { parseEnv } from "../env";
import { listProjectJobs } from "./jobs";

export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof getProjectDetail>>>;

export type AssetFile = {
  bytes: Uint8Array;
  mimeType: string;
};

export type RenderPreconditionReport = {
  projectHasNoScenes: boolean;
  scenesNotReady: string[];
  scenesMissingImage: string[];
  scenesMissingAudio: string[];
  scenesStaleImage: string[];
  scenesStaleAudio: string[];
};

type RenderPreconditionDeps = {
  listProjectScenes: typeof listProjectScenes;
  listProjectAssets: typeof listProjectAssets;
};

type QueueAssetKind = Extract<AssetRow["kind"], "image" | "audio">;
type QueueAssetJobType = Extract<JobRow["type"], "generate_scene_image" | "generate_scene_audio">;

type QueueMissingProjectAssetsDeps = {
  createJobIdempotent: typeof createJobIdempotent;
  listProjectAssets: typeof listProjectAssets;
  listProjectJobs: typeof listProjectJobs;
  listProjectScenes: typeof listProjectScenes;
};

const assetQueueKinds: QueueAssetKind[] = ["image", "audio"];

const assetJobTypeByKind: Record<QueueAssetKind, QueueAssetJobType> = {
  image: "generate_scene_image",
  audio: "generate_scene_audio",
};

const defaultRenderPreconditionDeps: RenderPreconditionDeps = {
  listProjectScenes,
  listProjectAssets,
};

const defaultQueueMissingProjectAssetsDeps: QueueMissingProjectAssetsDeps = {
  createJobIdempotent,
  listProjectAssets,
  listProjectJobs,
  listProjectScenes,
};

const execFileAsync = promisify(execFile);

export async function assertProjectCanDelete(db: DbClient, projectId: string) {
  const activeJobs = await listProjectJobs(db, projectId, "active");
  return activeJobs.length === 0;
}

export async function deleteProjectLocalFiles(projectId: string) {
  const assetRoot = parseEnv().LOCAL_ASSET_ROOT;
  await rm(join(assetRoot, "projects", projectId), {
    recursive: true,
    force: true,
  });
}

export async function readAssetFile(
  asset: Pick<AssetRow, "mimeType" | "path">,
): Promise<AssetFile> {
  if (!asset.mimeType) {
    throw new Error("asset_mime_type_missing");
  }

  const assetRoot = parseEnv().LOCAL_ASSET_ROOT;
  const bytes = await readFile(resolveLocalAssetPath(assetRoot, asset.path));

  return {
    bytes,
    mimeType: asset.mimeType,
  };
}

export async function revealAssetFile(asset: Pick<AssetRow, "path">) {
  if (process.platform !== "darwin") {
    throw new Error("asset_reveal_unsupported_platform");
  }

  const assetRoot = parseEnv().LOCAL_ASSET_ROOT;
  const absolutePath = resolveLocalAssetPath(assetRoot, asset.path);
  await access(absolutePath);
  await execFileAsync("open", ["-R", absolutePath]);
}

function resolveLocalAssetPath(root: string, relativePath: string) {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, relativePath);
  const relativeToRoot = path.relative(resolvedRoot, target);

  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error("asset_path_escapes_root");
  }

  return target;
}

export async function getProjectDetail(db: DbClient, projectId: string) {
  const project = await getProject(db, projectId);

  if (!project) {
    return null;
  }

  const [scenes, assets, renders, jobs] = await Promise.all([
    listProjectScenes(db, projectId),
    listProjectAssets(db, projectId),
    listProjectRenders(db, projectId),
    listProjectJobs(db, projectId),
  ]);
  const youtubeUploadJob = latestYoutubeUploadJob(jobs);
  const youtubeSchedule = youtubeUploadJob
    ? await getYoutubeScheduleForJob(db, youtubeUploadJob.id)
    : null;

  return {
    project,
    scenes,
    assets,
    renders,
    jobs,
    youtubeMetadata: latestYoutubeMetadata(jobs),
    youtubeUpload: latestYoutubeUpload(youtubeUploadJob, youtubeSchedule),
  };
}

function latestYoutubeMetadata(jobs: JobRow[]) {
  for (const job of jobs) {
    if (job.type !== "generate_script" || job.status !== "succeeded") {
      continue;
    }

    const output = job.output;
    if (!isJsonRecord(output) || !isJsonRecord(output.metadataDraft)) {
      continue;
    }

    const parsed = youtubeMetadataSchema.safeParse(output.metadataDraft);
    if (parsed.success) {
      return parsed.data;
    }
  }

  return null;
}

function latestYoutubeUploadJob(jobs: JobRow[]) {
  return jobs.find((candidate) => candidate.type === "upload_youtube") ?? null;
}

function latestYoutubeUpload(job: JobRow | null, schedule: YoutubeUploadScheduleRow | null) {
  if (!job) {
    return null;
  }

  const parsedOutput = youtubeUploadJobOutputSchema.safeParse(job.output);
  const parsedInput = youtubeUploadJobInputSchema.safeParse(job.input);

  return {
    jobId: job.id,
    status: job.status,
    mode: parsedOutput.success
      ? parsedOutput.data.mode
      : parsedInput.success
        ? parsedInput.data.mode
        : null,
    youtubeVideoId: parsedOutput.success
      ? parsedOutput.data.youtubeVideoId
      : (schedule?.youtubeVideoId ?? null),
    youtubeStudioUrl: parsedOutput.success ? parsedOutput.data.youtubeStudioUrl : null,
    privacyStatus: parsedOutput.success
      ? parsedOutput.data.privacyStatus
      : parsedInput.success
        ? parsedInput.data.privacyStatus
        : null,
    publishAt: parsedOutput.success
      ? parsedOutput.data.publishAt
      : parsedInput.success && parsedInput.data.mode === "scheduled_public"
        ? parsedInput.data.publishAt
        : null,
    scheduledPublishAt: schedule?.scheduledPublishAt.toISOString() ?? null,
    scheduleStatus: schedule?.status ?? null,
    timezone: schedule?.timezone ?? null,
    uploadedAt: parsedOutput.success ? parsedOutput.data.uploadedAt : null,
    errorMessage: job.errorMessage ?? schedule?.errorMessage ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function buildYoutubeUploadJobInput(
  db: DbClient,
  projectId: string,
  mode: YoutubeUploadMode = "private",
) {
  const [renders, assets, jobs] = await Promise.all([
    listProjectRenders(db, projectId),
    listProjectAssets(db, projectId),
    listProjectJobs(db, projectId),
  ]);

  const metadata = latestYoutubeMetadata(jobs);
  if (!metadata) {
    throw new Error("youtube_upload_preconditions_failed:metadata");
  }

  const latestSucceededRender = renders.find((render) => render.status === "succeeded");
  if (!latestSucceededRender?.outputAssetId) {
    throw new Error("youtube_upload_preconditions_failed:render");
  }

  const outputAsset = assets.find(
    (asset) =>
      asset.id === latestSucceededRender.outputAssetId &&
      asset.kind === "render" &&
      asset.status === "ready" &&
      asset.storageDriver === "local",
  );
  if (!outputAsset) {
    throw new Error("youtube_upload_preconditions_failed:render_asset");
  }

  return {
    mode,
    renderId: latestSucceededRender.id,
    outputAssetId: outputAsset.id,
    title: metadata.youtubeTitle,
    description: buildYoutubeUploadDescription(metadata),
    tags: youtubeTagKeywords(metadata.hashtags),
    privacyStatus: "private" as const,
    selfDeclaredMadeForKids: false as const,
    containsSyntheticMedia: true as const,
  };
}

export const buildYoutubeUploadDescription = formatYoutubeDescriptionWithHashtags;

export async function queueMissingProjectAssets(
  db: DbClient,
  projectId: string,
  deps: QueueMissingProjectAssetsDeps = defaultQueueMissingProjectAssetsDeps,
): Promise<BulkAssetQueueResponse> {
  const [scenes, assets, activeJobs] = await Promise.all([
    deps.listProjectScenes(db, projectId),
    deps.listProjectAssets(db, projectId),
    deps.listProjectJobs(db, projectId, "active"),
  ]);

  if (scenes.length === 0) {
    throw new Error("project_has_no_scenes");
  }

  const jobs: BulkAssetQueueResponse["jobs"] = [];
  let queuedCount = 0;
  let existingActiveCount = 0;
  let skippedCurrentCount = 0;

  for (const scene of scenes) {
    for (const kind of assetQueueKinds) {
      const type = assetJobTypeByKind[kind];

      if (hasCurrentSceneAsset(assets, scene, kind)) {
        skippedCurrentCount += 1;
        continue;
      }

      const activeJob = findActiveAssetJob(activeJobs, scene.id, type);
      if (activeJob) {
        jobs.push(serializeJob(activeJob));
        existingActiveCount += 1;
        continue;
      }

      const createdJob = await deps.createJobIdempotent(db, {
        projectId: scene.projectId,
        sceneId: scene.id,
        type,
        input: { projectId: scene.projectId, sceneId: scene.id },
      });
      jobs.push(serializeJob(createdJob));
      queuedCount += 1;
    }
  }

  return {
    jobs,
    queuedCount,
    existingActiveCount,
    skippedCurrentCount,
  };
}

function serializeJob(job: JobRow): BulkAssetQueueResponse["jobs"][number] {
  return {
    id: job.id,
    projectId: job.projectId,
    sceneId: job.sceneId,
    type: job.type,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    parentJobId: job.parentJobId,
    errorMessage: job.errorMessage,
    input: isJsonRecord(job.input) ? job.input : {},
    output: isJsonRecord(job.output) ? job.output : null,
    nextRetryAt: job.nextRetryAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    updatedAt: job.updatedAt.toISOString(),
  };
}

function hasCurrentSceneAsset(
  assets: Pick<AssetRow, "createdAt" | "kind" | "sceneId" | "status">[],
  scene: Pick<SceneRow, "contentUpdatedAt" | "id">,
  kind: QueueAssetKind,
) {
  return assets.some(
    (asset) =>
      asset.sceneId === scene.id &&
      asset.kind === kind &&
      asset.status === "ready" &&
      asset.createdAt >= scene.contentUpdatedAt,
  );
}

function findActiveAssetJob(
  activeJobs: JobRow[],
  sceneId: string,
  type: QueueAssetJobType,
) {
  return activeJobs.find(
    (job) =>
      job.sceneId === sceneId &&
      job.type === type &&
      (job.status === "pending" || job.status === "processing"),
  );
}

export async function buildRenderPreconditionReport(
  db: DbClient,
  projectId: string,
  deps: RenderPreconditionDeps = defaultRenderPreconditionDeps,
): Promise<RenderPreconditionReport> {
  const [scenes, assets] = await Promise.all([
    deps.listProjectScenes(db, projectId),
    deps.listProjectAssets(db, projectId),
  ]);

  return evaluateRenderPreconditions(scenes, assets);
}

function evaluateRenderPreconditions(
  scenes: Pick<SceneRow, "id" | "status" | "contentUpdatedAt">[],
  assets: Pick<AssetRow, "sceneId" | "kind" | "status" | "createdAt">[],
): RenderPreconditionReport {
  const report: RenderPreconditionReport = {
    projectHasNoScenes: scenes.length === 0,
    scenesNotReady: [],
    scenesMissingImage: [],
    scenesMissingAudio: [],
    scenesStaleImage: [],
    scenesStaleAudio: [],
  };

  for (const scene of scenes) {
    if (scene.status !== "ready") {
      report.scenesNotReady.push(scene.id);
    }

    addAssetPrecondition(report, scene, assets, "image", "scenesMissingImage", "scenesStaleImage");
    addAssetPrecondition(report, scene, assets, "audio", "scenesMissingAudio", "scenesStaleAudio");
  }

  return report;
}

function addAssetPrecondition(
  report: RenderPreconditionReport,
  scene: Pick<SceneRow, "id" | "contentUpdatedAt">,
  assets: Pick<AssetRow, "sceneId" | "kind" | "status" | "createdAt">[],
  kind: Extract<AssetRow["kind"], "image" | "audio">,
  missingKey: "scenesMissingImage" | "scenesMissingAudio",
  staleKey: "scenesStaleImage" | "scenesStaleAudio",
) {
  const readyAssets = assets.filter(
    (asset) => asset.sceneId === scene.id && asset.kind === kind && asset.status === "ready",
  );

  if (readyAssets.length === 0) {
    report[missingKey].push(scene.id);
    return;
  }

  const hasCurrentAsset = readyAssets.some((asset) => asset.createdAt >= scene.contentUpdatedAt);

  if (!hasCurrentAsset) {
    report[staleKey].push(scene.id);
  }
}

export { deleteProjectRows };
