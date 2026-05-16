import { rm } from "node:fs/promises";
import { join } from "node:path";

import {
  deleteProjectRows,
  getProject,
  listProjectAssets,
  listProjectRenders,
  listProjectScenes,
  type DbClient,
} from "@short-workflow/db";

import { parseEnv } from "../env";
import { listProjectJobs } from "./jobs";

export type ProjectDetail = NonNullable<
  Awaited<ReturnType<typeof getProjectDetail>>
>;

export async function assertProjectCanDelete(
  db: DbClient,
  projectId: string,
) {
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

export { deleteProjectRows };
