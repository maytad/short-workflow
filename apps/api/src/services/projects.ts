import { execFile } from "node:child_process";
import { access, readFile, rm } from "node:fs/promises";
import path, { join } from "node:path";
import { promisify } from "node:util";

import {
  deleteProjectRows,
  getProject,
  listProjectAssets,
  listProjectRenders,
  listProjectScenes,
  type AssetRow,
  type DbClient,
  type JobRow,
  type SceneRow,
} from "@short-workflow/db";
import { youtubeMetadataSchema, youtubeUploadJobOutputSchema } from "@short-workflow/shared";

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

const defaultRenderPreconditionDeps: RenderPreconditionDeps = {
  listProjectScenes,
  listProjectAssets,
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

  return {
    project,
    scenes,
    assets,
    renders,
    jobs,
    youtubeMetadata: latestYoutubeMetadata(jobs),
    youtubeUpload: latestYoutubeUpload(jobs),
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

function latestYoutubeUpload(jobs: JobRow[]) {
  const job = jobs.find((candidate) => candidate.type === "upload_youtube");
  if (!job) {
    return null;
  }

  const parsedOutput = youtubeUploadJobOutputSchema.safeParse(job.output);

  return {
    jobId: job.id,
    status: job.status,
    youtubeVideoId: parsedOutput.success ? parsedOutput.data.youtubeVideoId : null,
    youtubeStudioUrl: parsedOutput.success ? parsedOutput.data.youtubeStudioUrl : null,
    privacyStatus: parsedOutput.success ? parsedOutput.data.privacyStatus : null,
    uploadedAt: parsedOutput.success ? parsedOutput.data.uploadedAt : null,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function buildYoutubeUploadJobInput(db: DbClient, projectId: string) {
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
    renderId: latestSucceededRender.id,
    outputAssetId: outputAsset.id,
    title: metadata.youtubeTitle,
    description: metadata.description,
    tags: metadata.hashtags.map((tag) => tag.replace(/^#+/, "")),
    privacyStatus: "private" as const,
    selfDeclaredMadeForKids: false as const,
    containsSyntheticMedia: true as const,
  };
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
