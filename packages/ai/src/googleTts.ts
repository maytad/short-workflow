import { TextToSpeechClient, protos } from "@google-cloud/text-to-speech";

import type { GenerateAudioOutput } from "./types";

type GenerateSpeechInput = {
  ssml: string;
  voiceName?: string;
  speakingRate?: number;
};

export async function generateSpeech(input: GenerateSpeechInput): Promise<GenerateAudioOutput> {
  const voiceName = input.voiceName ?? process.env.GOOGLE_TTS_VOICE ?? "en-US-Neural2-D";
  const client = new TextToSpeechClient(
    process.env.GOOGLE_CLOUD_TEXT_TO_SPEECH_KEY_PATH
      ? { keyFilename: process.env.GOOGLE_CLOUD_TEXT_TO_SPEECH_KEY_PATH }
      : undefined,
  );

  const request: protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
    input: { ssml: input.ssml },
    voice: {
      languageCode: voiceName.split("-").slice(0, 2).join("-"),
      name: voiceName,
    },
    audioConfig: {
      audioEncoding: "MP3",
    },
  };

  if (input.speakingRate !== undefined) {
    request.audioConfig = {
      ...request.audioConfig,
      speakingRate: input.speakingRate,
    };
  }

  const [response] = await client.synthesizeSpeech(request);

  if (!response.audioContent) {
    throw new Error("google_tts_response_invalid");
  }

  return {
    bytes: toUint8Array(response.audioContent),
    mimeType: "audio/mpeg",
    model: voiceName,
    responseMetadata: {
      model_id: voiceName,
      audio_encoding: "MP3",
      speaking_rate: input.speakingRate,
    },
  };
}

function toUint8Array(audioContent: string | Uint8Array): Uint8Array {
  if (typeof audioContent === "string") {
    return Uint8Array.from(atob(audioContent), (char) => char.charCodeAt(0));
  }

  return new Uint8Array(audioContent);
}
