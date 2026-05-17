import { rm } from "node:fs/promises";
import { join } from "node:path";

import {
  deleteProjectRows,
  getProject,
  listProjectAssets,
  listProjectRenders,
  listProjectScenes,
  type AssetRow,
  type DbClient,
  type SceneRow,
} from "@short-workflow/db";

import { parseEnv } from "../env";
import { listProjectJobs } from "./jobs";

export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof getProjectDetail>>>;

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
