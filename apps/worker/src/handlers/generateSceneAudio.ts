import {
  buildCaptionTimingDoc,
  generateSpeechWithTimestamps,
} from "@short-workflow/ai";
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

import { sceneAudioPath, sceneCaptionTimingPath, writeAssetFile } from "../assets";
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

  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL_ID;
  if (!voiceId) {
    throw new Error("ELEVENLABS_VOICE_ID_missing");
  }
  if (!modelId) {
    throw new Error("ELEVENLABS_MODEL_ID_missing");
  }

  let audioAsset: AssetRow | null = null;
  let captionAsset: AssetRow | null = null;
  let audioAssetReady = false;
  let captionAssetReady = false;

  try {
    audioAsset = await createPendingAsset(db, {
      projectId: scene.projectId,
      sceneId: scene.id,
      kind: "audio",
      path: sceneAudioPath(scene.projectId, scene.id, "pending", "mp3"),
      provider: "elevenlabs",
    });

    const generated = await generateSpeechWithTimestamps({
      narration: scene.narration,
      voiceId,
      modelId,
    });

    const finalAudioPath = sceneAudioPath(scene.projectId, scene.id, audioAsset.id, "mp3");
    const audioFile = await writeAssetFile(
      handlerEnv.LOCAL_ASSET_ROOT,
      finalAudioPath,
      generated.bytes,
    );

    await markAssetReady(db, audioAsset.id, {
      path: finalAudioPath,
      mimeType: generated.mimeType,
      sizeBytes: audioFile.sizeBytes,
      checksum: audioFile.checksum,
      provider: "elevenlabs",
      model: generated.model,
    });
    audioAssetReady = true;

    if (generated.alignment) {
      captionAsset = await createPendingAsset(db, {
        projectId: scene.projectId,
        sceneId: scene.id,
        kind: "caption_timing",
        path: sceneCaptionTimingPath(scene.projectId, scene.id, "pending"),
        provider: "elevenlabs",
        model: generated.model,
      });

      // at(-1) is always defined here: validateAlignment (called inside buildCaptionTimingDoc)
      // guarantees the array is non-empty.
      const audioDurationSeconds =
        generated.alignment.characterEndTimesSeconds.at(-1) ?? 1;

      const captionTimingDoc = buildCaptionTimingDoc({
        alignment: generated.alignment,
        narration: scene.narration,
        sourceAudioAssetId: audioAsset.id,
        audioDurationSeconds,
      });

      const finalCaptionPath = sceneCaptionTimingPath(
        scene.projectId,
        scene.id,
        captionAsset.id,
      );
      const captionBytes = new TextEncoder().encode(
        `${JSON.stringify(captionTimingDoc, null, 2)}\n`,
      );
      const captionFile = await writeAssetFile(
        handlerEnv.LOCAL_ASSET_ROOT,
        finalCaptionPath,
        captionBytes,
      );

      await markAssetReady(db, captionAsset.id, {
        path: finalCaptionPath,
        mimeType: "application/json",
        sizeBytes: captionFile.sizeBytes,
        checksum: captionFile.checksum,
        provider: "elevenlabs",
        model: generated.model,
      });
      captionAssetReady = true;
    }

    const promptVersion = await insertPromptVersion(db, {
      projectId: scene.projectId,
      sceneId: scene.id,
      purpose: "ssml",
      provider: "elevenlabs",
      model: generated.model,
      promptPayload: {
        narration: scene.narration,
        voiceId,
        modelId,
      },
      responseMetadata: generated.responseMetadata,
    });

    await markJobSucceeded(db, job.id, {
      assetId: audioAsset.id,
      ...(captionAsset ? { captionTimingAssetId: captionAsset.id } : {}),
      promptVersionId: promptVersion.id,
    });
  } catch (error) {
    if (captionAsset && !captionAssetReady) {
      await markAssetFailed(db, captionAsset.id, errorMessage(error));
    }

    if (audioAsset && !audioAssetReady) {
      await markAssetFailed(db, audioAsset.id, errorMessage(error));
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
