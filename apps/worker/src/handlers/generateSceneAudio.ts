import {
  generateSpeech,
  promptPayload,
  styleContextFromScriptResponseText,
  ttsPromptTemplate,
} from "@short-workflow/ai";
import {
  createPendingAsset,
  getLatestPromptVersion,
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

  const latestScriptPrompt = await getLatestPromptVersion(db, {
    projectId: scene.projectId,
    sceneId: null,
    purpose: "script",
  });
  const styleContext = styleContextFromScriptResponseText(latestScriptPrompt?.responseText);

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

    const voiceName = process.env.GEMINI_TTS_VOICE ?? "Kore";
    const compiledPrompt = ttsPromptTemplate.compile({
      scene,
      voiceName,
      ...(styleContext ? { styleContext } : {}),
    });
    const generated = await generateSpeech({
      ssml: scene.ssml,
      prompt: compiledPrompt.prompt,
      voiceName,
      promptMetadata: {
        templateId: compiledPrompt.templateId,
        templateVersion: compiledPrompt.templateVersion,
      },
    });
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
      promptPayload: promptPayload(compiledPrompt, {
        sceneId: scene.id,
        ssml: scene.ssml,
        narration: scene.narration,
      }),
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
