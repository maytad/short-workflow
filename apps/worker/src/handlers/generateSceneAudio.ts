import { generateSpeech } from "@short-workflow/ai";
import {
  createPendingAsset,
  getScene,
  insertPromptVersion,
  markAssetFailed,
  markAssetReady,
  markJobSucceeded,
  type AssetRow,
  type DbClient,
  type JobRow,
} from "@short-workflow/db";

import { sceneAudioPath, writeAssetFile } from "../assets";
import { resolveHandlerEnv, type HandlerEnv } from "./types";

export async function handleGenerateSceneAudio(db: DbClient, job: JobRow, env?: HandlerEnv) {
  if (!job.sceneId) {
    throw new Error("scene_id_required");
  }

  const handlerEnv = resolveHandlerEnv(env);
  const scene = await getScene(db, job.sceneId);

  if (!scene) {
    throw new Error("scene_not_found");
  }

  let asset: AssetRow | null = null;
  let assetReady = false;

  try {
    asset = await createPendingAsset(db, {
      projectId: scene.projectId,
      sceneId: scene.id,
      kind: "audio",
      path: sceneAudioPath(scene.projectId, scene.id, "pending"),
      provider: "google_gemini",
    });

    const generated = await generateSpeech({ ssml: scene.ssml });
    const finalPath = sceneAudioPath(scene.projectId, scene.id, asset.id);
    const file = await writeAssetFile(handlerEnv.LOCAL_ASSET_ROOT, finalPath, generated.bytes);

    await markAssetReady(db, asset.id, {
      path: finalPath,
      mimeType: generated.mimeType,
      sizeBytes: file.sizeBytes,
      checksum: file.checksum,
      provider: "google_gemini",
      model: generated.model,
    });
    assetReady = true;

    const promptVersion = await insertPromptVersion(db, {
      projectId: scene.projectId,
      sceneId: scene.id,
      purpose: "ssml",
      provider: "google_gemini",
      model: generated.model,
      promptPayload: { ssml: scene.ssml },
      responseMetadata: generated.responseMetadata,
    });

    await markJobSucceeded(db, job.id, {
      assetId: asset.id,
      promptVersionId: promptVersion.id,
    });
  } catch (error) {
    if (asset && !assetReady) {
      await markAssetFailed(db, asset.id, errorMessage(error));
    }

    throw error;
  }
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
