import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export type ElevenLabsAlignment = {
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
};

export type ElevenLabsTtsInput = {
  narration: string;
  previousText?: string;
  nextText?: string;
  voiceId: string;
  modelId: string;
  voiceSpeed?: number;
};

export type ElevenLabsTtsOutput = {
  bytes: Uint8Array;
  mimeType: "audio/mpeg";
  model: string;
  alignment: ElevenLabsAlignment | null;
  responseMetadata: Record<string, unknown>;
};

export const ELEVENLABS_VOICE_SETTINGS = {
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0.4,
  useSpeakerBoost: true,
  speed: 1,
} as const;

export const ELEVENLABS_MIN_VOICE_SPEED = 0.7;
export const ELEVENLABS_MAX_VOICE_SPEED = 1.2;
export const ELEVENLABS_OUTPUT_FORMAT = "mp3_44100_128" as const;

export async function generateSpeechWithTimestamps(
  input: ElevenLabsTtsInput,
): Promise<ElevenLabsTtsOutput> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY_missing");
  }

  const client = new ElevenLabsClient({ apiKey });

  const response = await client.textToSpeech.convertWithTimestamps(input.voiceId, {
    text: input.narration,
    modelId: input.modelId,
    voiceSettings: {
      ...ELEVENLABS_VOICE_SETTINGS,
      speed: input.voiceSpeed ?? ELEVENLABS_VOICE_SETTINGS.speed,
    },
    outputFormat: ELEVENLABS_OUTPUT_FORMAT,
    ...(input.previousText !== undefined && { previousText: input.previousText }),
    ...(input.nextText !== undefined && { nextText: input.nextText }),
  });

  const audioBase64 = (response as { audioBase64?: string }).audioBase64;
  if (!audioBase64) {
    throw new Error("elevenlabs_audio_base64_missing");
  }

  const bytes = new Uint8Array(Buffer.from(audioBase64, "base64"));

  const rawAlignment = (response as { alignment?: unknown }).alignment;
  const alignment = parseAlignment(rawAlignment);

  return {
    bytes,
    mimeType: "audio/mpeg",
    model: input.modelId,
    alignment,
    responseMetadata: {
      modelId: input.modelId,
      voiceId: input.voiceId,
      voiceSpeed: input.voiceSpeed ?? ELEVENLABS_VOICE_SETTINGS.speed,
      outputFormat: ELEVENLABS_OUTPUT_FORMAT,
    },
  };
}

function parseAlignment(value: unknown): ElevenLabsAlignment | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const a = value as Record<string, unknown>;
  if (
    !Array.isArray(a.characters) ||
    !Array.isArray(a.characterStartTimesSeconds) ||
    !Array.isArray(a.characterEndTimesSeconds)
  ) {
    return null;
  }

  return {
    characters: a.characters as string[],
    characterStartTimesSeconds: a.characterStartTimesSeconds as number[],
    characterEndTimesSeconds: a.characterEndTimesSeconds as number[],
  };
}
