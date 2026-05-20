import {
  buildCaptionTimingDoc,
  generateSpeechWithTimestamps,
  styleContextFromScriptResponseText,
  validateAlignment,
  validateCaptionTimingDoc,
  ELEVENLABS_MAX_VOICE_SPEED,
  ELEVENLABS_MIN_VOICE_SPEED,
  ELEVENLABS_VOICE_SETTINGS,
} from "@short-workflow/ai";
import {
  createPendingAsset,
  getCurrentReadySceneAsset,
  getLatestPromptVersion,
  getScene,
  insertPromptVersion,
  listProjectScenes,
  markAssetFailed,
  markAssetReady,
  markJobSucceeded,
  type AssetRow,
  type DbClient,
  type JobRow,
} from "@short-workflow/db";

import { sceneAudioPath, sceneCaptionTimingPath, writeAssetFile } from "../assets";
import { resolveHandlerEnv, type HandlerEnv } from "./types";

const DEFAULT_ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
const AUDIO_OVERFLOW_TOLERANCE_SECONDS = 0.5;
const AUDIO_OVERFLOW_RETRY_HEADROOM = 1.03;

export type GenerateCurrentSceneAudioResult = {
  assetId: string;
  captionTimingAssetId: string | null;
  promptVersionId: string | null;
  reused: boolean;
};

type GenerateCurrentSceneAudioOptions = {
  env?: HandlerEnv | undefined;
  reuseCurrent?: boolean;
};

export async function generateCurrentSceneAudio(
  db: DbClient,
  sceneId: string,
  options: GenerateCurrentSceneAudioOptions = {},
): Promise<GenerateCurrentSceneAudioResult> {
  if (options.reuseCurrent === true) {
    const currentAsset = await getCurrentReadySceneAsset(db, { sceneId, kind: "audio" });
    if (currentAsset) {
      return {
        assetId: currentAsset.id,
        captionTimingAssetId: null,
        promptVersionId: null,
        reused: true,
      };
    }
  }

  const handlerEnv = resolveHandlerEnv(options.env);
  const scene = await getScene(db, sceneId);
  if (!scene) {
    throw new Error("scene_not_found");
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!voiceId) {
    throw new Error("ELEVENLABS_VOICE_ID_missing");
  }
  const modelId = process.env.ELEVENLABS_MODEL_ID ?? DEFAULT_ELEVENLABS_MODEL_ID;
  const configuredVoiceSpeed = parseElevenLabsVoiceSpeed(process.env.ELEVENLABS_VOICE_SPEED);

  const projectScenes = await listProjectScenes(db, scene.projectId);
  const ordered = [...projectScenes].sort((a, b) => a.position - b.position);
  const myIndex = ordered.findIndex((s) => s.id === scene.id);
  const previousText = myIndex > 0 ? ordered[myIndex - 1]?.narration : undefined;
  const nextText =
    myIndex >= 0 && myIndex < ordered.length - 1 ? ordered[myIndex + 1]?.narration : undefined;

  const latestScriptPrompt = await getLatestPromptVersion(db, {
    projectId: scene.projectId,
    sceneId: null,
    purpose: "script",
  });
  const styleContext = styleContextFromScriptResponseText(latestScriptPrompt?.responseText);

  let audioAsset: AssetRow | null = null;
  let audioReady = false;

  try {
    audioAsset = await createPendingAsset(db, {
      projectId: scene.projectId,
      sceneId: scene.id,
      kind: "audio",
      path: sceneAudioPath(scene.projectId, scene.id, "pending", "mp3"),
      provider: "elevenlabs",
    });

    const generation = await generateSceneSpeechWithOverflowRetry({
      narration: scene.narration,
      previousText,
      nextText,
      voiceId,
      modelId,
      sceneDurationSeconds: scene.durationSeconds,
      voiceSpeed: configuredVoiceSpeed,
    });
    const { generated, audioDurationSeconds, voiceSpeed, speedAttempts } = generation;
    if (audioDurationSeconds > scene.durationSeconds + AUDIO_OVERFLOW_TOLERANCE_SECONDS) {
      throw new Error(
        `audio_exceeds_scene_duration:${audioDurationSeconds.toFixed(3)}s>${scene.durationSeconds}s`,
      );
    }

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
    audioReady = true;

    const captionTimingAssetId = await saveCaptionTiming({
      db,
      handlerEnv,
      scene,
      audioAssetId: audioAsset.id,
      generatedAlignment: generated.alignment,
    });

    const promptVersion = await insertPromptVersion(db, {
      projectId: scene.projectId,
      sceneId: scene.id,
      purpose: "ssml",
      provider: "elevenlabs",
      model: generated.model,
      promptPayload: {
        narration: scene.narration,
        previousText: previousText ?? null,
        nextText: nextText ?? null,
        voiceId,
        modelId,
        voiceSpeed,
        voiceSpeedAttempts: speedAttempts,
        voiceSettings: {
          ...ELEVENLABS_VOICE_SETTINGS,
          speed: voiceSpeed,
        },
        audioAssetId: audioAsset.id,
        styleContext: styleContext ?? null,
      },
      responseMetadata: generated.responseMetadata,
    });

    return {
      assetId: audioAsset.id,
      captionTimingAssetId,
      promptVersionId: promptVersion.id,
      reused: false,
    };
  } catch (error) {
    if (audioAsset && !audioReady) {
      await markAssetFailed(db, audioAsset.id, errorMessage(error));
    }
    throw error;
  }
}

export async function handleGenerateSceneAudio(db: DbClient, job: JobRow, env?: HandlerEnv) {
  if (!job.sceneId) {
    throw new Error("scene_id_required");
  }

  const result = await generateCurrentSceneAudio(db, job.sceneId, { env });

  await markJobSucceeded(db, job.id, {
    assetId: result.assetId,
    captionTimingAssetId: result.captionTimingAssetId,
    promptVersionId: result.promptVersionId,
    reused: result.reused,
  });
}

type GeneratedSpeech = Awaited<ReturnType<typeof generateSpeechWithTimestamps>>;
type ValidGeneratedSpeech = GeneratedSpeech & {
  alignment: NonNullable<GeneratedSpeech["alignment"]>;
};

type SpeechAttempt = {
  generated: ValidGeneratedSpeech;
  audioDurationSeconds: number;
  voiceSpeed: number;
};

type SpeechSpeedAttempt = {
  voiceSpeed: number;
  audioDurationSeconds: number;
};

async function generateSceneSpeechWithOverflowRetry(input: {
  narration: string;
  previousText?: string | undefined;
  nextText?: string | undefined;
  voiceId: string;
  modelId: string;
  sceneDurationSeconds: number;
  voiceSpeed: number;
}): Promise<SpeechAttempt & { speedAttempts: SpeechSpeedAttempt[] }> {
  const firstAttempt = await generateSpeechAttempt(input);
  const speedAttempts: SpeechSpeedAttempt[] = [
    {
      voiceSpeed: firstAttempt.voiceSpeed,
      audioDurationSeconds: firstAttempt.audioDurationSeconds,
    },
  ];

  const maxAudioDurationSeconds = input.sceneDurationSeconds + AUDIO_OVERFLOW_TOLERANCE_SECONDS;
  if (firstAttempt.audioDurationSeconds <= maxAudioDurationSeconds) {
    return { ...firstAttempt, speedAttempts };
  }

  const retryVoiceSpeed = overflowRetryVoiceSpeed({
    currentVoiceSpeed: firstAttempt.voiceSpeed,
    audioDurationSeconds: firstAttempt.audioDurationSeconds,
    maxAudioDurationSeconds,
  });
  if (retryVoiceSpeed === null) {
    return { ...firstAttempt, speedAttempts };
  }

  const retryAttempt = await generateSpeechAttempt({
    ...input,
    voiceSpeed: retryVoiceSpeed,
  });
  speedAttempts.push({
    voiceSpeed: retryAttempt.voiceSpeed,
    audioDurationSeconds: retryAttempt.audioDurationSeconds,
  });

  return { ...retryAttempt, speedAttempts };
}

async function generateSpeechAttempt(input: {
  narration: string;
  previousText?: string | undefined;
  nextText?: string | undefined;
  voiceId: string;
  modelId: string;
  voiceSpeed: number;
}): Promise<SpeechAttempt> {
  const generated = await generateSpeechWithTimestamps({
    narration: input.narration,
    ...(input.previousText !== undefined ? { previousText: input.previousText } : {}),
    ...(input.nextText !== undefined ? { nextText: input.nextText } : {}),
    voiceId: input.voiceId,
    modelId: input.modelId,
    voiceSpeed: input.voiceSpeed,
  });

  const alignment = generated.alignment;
  if (!alignment) {
    throw new Error("elevenlabs_alignment_missing");
  }

  const alignmentCheck = validateAlignment(alignment);
  if (!alignmentCheck.ok) {
    throw new Error(`elevenlabs_alignment_invalid:${alignmentCheck.reason}`);
  }

  return {
    generated: { ...generated, alignment },
    audioDurationSeconds: Math.max(...alignment.characterEndTimesSeconds),
    voiceSpeed: input.voiceSpeed,
  };
}

function overflowRetryVoiceSpeed(input: {
  currentVoiceSpeed: number;
  audioDurationSeconds: number;
  maxAudioDurationSeconds: number;
}): number | null {
  if (input.currentVoiceSpeed >= ELEVENLABS_MAX_VOICE_SPEED) {
    return null;
  }

  const requiredSpeed =
    input.currentVoiceSpeed *
    (input.audioDurationSeconds / input.maxAudioDurationSeconds) *
    AUDIO_OVERFLOW_RETRY_HEADROOM;
  const retrySpeed = Math.min(ELEVENLABS_MAX_VOICE_SPEED, roundSpeedUp(requiredSpeed));

  return retrySpeed > input.currentVoiceSpeed ? retrySpeed : null;
}

function parseElevenLabsVoiceSpeed(value: string | undefined): number {
  if (value === undefined || value.trim() === "") {
    return ELEVENLABS_VOICE_SETTINGS.speed;
  }

  const parsed = Number(value);
  if (
    !Number.isFinite(parsed) ||
    parsed < ELEVENLABS_MIN_VOICE_SPEED ||
    parsed > ELEVENLABS_MAX_VOICE_SPEED
  ) {
    throw new Error("ELEVENLABS_VOICE_SPEED_invalid");
  }

  return roundSpeedUp(parsed);
}

function roundSpeedUp(value: number): number {
  return Math.ceil(value * 100) / 100;
}

async function saveCaptionTiming(input: {
  db: DbClient;
  handlerEnv: ReturnType<typeof resolveHandlerEnv>;
  scene: { projectId: string; id: string; durationSeconds: number };
  audioAssetId: string;
  generatedAlignment: NonNullable<
    Awaited<ReturnType<typeof generateSpeechWithTimestamps>>["alignment"]
  >;
}): Promise<string | null> {
  const { db, handlerEnv, scene, audioAssetId, generatedAlignment } = input;

  const doc = buildCaptionTimingDoc({
    alignment: generatedAlignment,
    sourceAudioAssetId: audioAssetId,
  });
  const docCheck = validateCaptionTimingDoc(doc, { sceneDurationSeconds: scene.durationSeconds });
  if (!docCheck.ok) {
    console.warn(`caption_timing_invalid:${docCheck.reason}`);
    return null;
  }

  const captionPath = sceneCaptionTimingPath(scene.projectId, scene.id, audioAssetId);

  let captionAsset: AssetRow;
  try {
    captionAsset = await createPendingAsset(db, {
      projectId: scene.projectId,
      sceneId: scene.id,
      kind: "caption_timing",
      path: captionPath,
      provider: "elevenlabs",
    });
  } catch (createError) {
    console.warn("caption_create_failed", { reason: errorMessage(createError) });
    return null;
  }

  try {
    const bytes = new TextEncoder().encode(`${JSON.stringify(doc, null, 2)}\n`);
    const file = await writeAssetFile(handlerEnv.LOCAL_ASSET_ROOT, captionPath, bytes);
    await markAssetReady(db, captionAsset.id, {
      path: captionPath,
      mimeType: "application/json",
      sizeBytes: file.sizeBytes,
      checksum: file.checksum,
      provider: "elevenlabs",
      model: null,
    });
    return captionAsset.id;
  } catch (writeError) {
    const message = errorMessage(writeError);
    try {
      await markAssetFailed(db, captionAsset.id, message);
    } catch (markError) {
      console.error("caption_mark_failed_twice", { write: message, mark: errorMessage(markError) });
    }
    return null;
  }
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
