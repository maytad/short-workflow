import {
  getCurrentReadySceneAsset,
  listProjectScenes,
  markJobSucceeded,
  type AssetRow,
  type DbClient,
  type JobRow,
  type SceneRow,
} from "@short-workflow/db";

import { generateCurrentSceneAudio } from "./generateSceneAudio";
import { generateCurrentSceneImage } from "./generateSceneImage";
import { generateProjectScript } from "./generateScript";
import { renderProjectVideo } from "./renderVideo";

type CurrentAssetInput = {
  sceneId: string;
  kind: AssetRow["kind"];
};

type RunProjectFlowDeps = {
  generateCurrentSceneAudio: typeof generateCurrentSceneAudio;
  generateCurrentSceneImage: typeof generateCurrentSceneImage;
  generateProjectScript: typeof generateProjectScript;
  getCurrentReadySceneAsset: (db: DbClient, input: CurrentAssetInput) => Promise<AssetRow | null>;
  listProjectScenes: typeof listProjectScenes;
  markJobSucceeded: typeof markJobSucceeded;
  renderProjectVideo: typeof renderProjectVideo;
};

const defaultDeps: RunProjectFlowDeps = {
  generateCurrentSceneAudio,
  generateCurrentSceneImage,
  generateProjectScript,
  getCurrentReadySceneAsset,
  listProjectScenes,
  markJobSucceeded,
  renderProjectVideo,
};

export async function runProjectFlow(
  db: DbClient,
  job: JobRow,
  deps: RunProjectFlowDeps = defaultDeps,
) {
  let scenes = await deps.listProjectScenes(db, job.projectId);
  let scriptResult: Awaited<ReturnType<typeof generateProjectScript>> | null = null;

  if (scenes.length === 0) {
    scriptResult = await deps.generateProjectScript(db, job.projectId);
    scenes = await deps.listProjectScenes(db, job.projectId);
  }

  if (scenes.length === 0) {
    throw new Error("project_flow_script_created_no_scenes");
  }

  const imageAssetIds: string[] = [];
  const audioAssetIds: string[] = [];

  for (const scene of scenes) {
    const image = await getOrGenerateSceneImage(db, scene, deps);
    imageAssetIds.push(image.assetId);

    const audio = await getOrGenerateSceneAudio(db, scene, deps);
    audioAssetIds.push(audio.assetId);
  }

  const render = await deps.renderProjectVideo(db, job.projectId);

  await deps.markJobSucceeded(db, job.id, {
    ...(scriptResult
      ? {
          scriptPromptVersionId: scriptResult.promptVersionId,
          seedId: scriptResult.seedId,
          channelPresetId: scriptResult.channelPresetId,
          metadataDraft: scriptResult.metadataDraft,
        }
      : {}),
    sceneIds: scenes.map((scene) => scene.id),
    imageAssetIds,
    audioAssetIds,
    renderId: render.renderId,
    inputAssetId: render.inputAssetId,
    outputAssetId: render.outputAssetId,
    durationSeconds: render.durationSeconds,
  });
}

async function getOrGenerateSceneImage(
  db: DbClient,
  scene: SceneRow,
  deps: RunProjectFlowDeps,
) {
  const current = await deps.getCurrentReadySceneAsset(db, {
    sceneId: scene.id,
    kind: "image",
  });

  if (current) {
    return {
      assetId: current.id,
      promptVersionId: null,
      reused: true,
    };
  }

  return deps.generateCurrentSceneImage(db, scene.id, { reuseCurrent: true });
}

async function getOrGenerateSceneAudio(
  db: DbClient,
  scene: SceneRow,
  deps: RunProjectFlowDeps,
) {
  const current = await deps.getCurrentReadySceneAsset(db, {
    sceneId: scene.id,
    kind: "audio",
  });

  if (current) {
    return {
      assetId: current.id,
      captionTimingAssetId: null,
      promptVersionId: null,
      reused: true,
    };
  }

  return deps.generateCurrentSceneAudio(db, scene.id, { reuseCurrent: true });
}

export async function handleRunProjectFlow(db: DbClient, job: JobRow) {
  await runProjectFlow(db, job);
}
