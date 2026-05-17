import { GoogleGenAI, Modality } from "@google/genai";

import type { GenerateAudioInput, GenerateAudioOutput } from "./types";

type GoogleTtsClient = {
  models: {
    generateContent(input: {
      model: string;
      contents: Array<{
        parts: Array<{
          text: string;
        }>;
      }>;
      config: {
        responseModalities: Modality[];
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: string;
            };
          };
        };
      };
    }): Promise<GoogleTtsResponse>;
  };
};

type GoogleTtsResponse = {
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: Array<{
        inlineData?: {
          mimeType?: string;
          data?: string;
        };
      }>;
    };
  }>;
};

export async function generateSpeech(input: GenerateAudioInput): Promise<GenerateAudioOutput> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY_missing");
  }

  const client = new GoogleGenAI({ apiKey });
  return generateSpeechWithClient(client, input);
}

export async function generateSpeechWithClient(
  client: GoogleTtsClient,
  input: GenerateAudioInput,
): Promise<GenerateAudioOutput> {
  const model = input.model ?? process.env.GEMINI_TTS_MODEL ?? "gemini-3.1-flash-tts-preview";
  const voiceName = input.voiceName ?? process.env.GEMINI_TTS_VOICE ?? "Kore";
  const narrationText = speechTextFromSsml(input.ssml);
  const prompt =
    input.prompt ??
    `Synthesize speech for this short-form video narration.\n\n### TRANSCRIPT\n${narrationText}`;

  const data = await client.models.generateContent({
    model,
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName,
          },
        },
      },
    },
  });
  const audioPart = findInlineAudioPart(data);
  if (!audioPart) {
    throw new Error("google_tts_response_invalid");
  }

  const sampleRateHz = sampleRateFromMimeType(audioPart.mimeType) ?? 24_000;
  const pcmBytes = decodeBase64(audioPart.data);

  return {
    bytes: pcm16ToWav(pcmBytes, { sampleRateHz }),
    mimeType: "audio/wav",
    model,
    responseMetadata: {
      model_id: model,
      voice_name: voiceName,
      mime_type: audioPart.mimeType,
      audio_encoding: "LINEAR16",
      sample_rate_hz: sampleRateHz,
      finish_reason: data.candidates?.[0]?.finishReason,
      candidate_count: data.candidates?.length ?? 0,
      prompt_metadata: input.promptMetadata,
    },
  };
}

export function speechTextFromSsml(ssml: string): string {
  return decodeXmlEntities(ssml.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function findInlineAudioPart(
  data: GoogleTtsResponse,
): { data: string; mimeType: string } | undefined {
  for (const candidate of data.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      const inlineData = part.inlineData;
      if (inlineData?.data && inlineData.mimeType?.startsWith("audio/")) {
        return { data: inlineData.data, mimeType: inlineData.mimeType };
      }
    }
  }

  return undefined;
}

function sampleRateFromMimeType(mimeType: string): number | undefined {
  const match = /(?:^|;)rate=(\d+)(?:;|$)/.exec(mimeType);
  if (!match) {
    return undefined;
  }

  const rate = match[1];
  if (!rate) {
    return undefined;
  }

  return Number.parseInt(rate, 10);
}

function pcm16ToWav(
  pcmBytes: Uint8Array,
  options: { sampleRateHz: number; channels?: number; bitsPerSample?: number },
): Uint8Array {
  const channels = options.channels ?? 1;
  const bitsPerSample = options.bitsPerSample ?? 16;
  const byteRate = (options.sampleRateHz * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const wavBytes = new Uint8Array(44 + pcmBytes.byteLength);
  const view = new DataView(wavBytes.buffer);

  writeAscii(wavBytes, 0, "RIFF");
  view.setUint32(4, 36 + pcmBytes.byteLength, true);
  writeAscii(wavBytes, 8, "WAVE");
  writeAscii(wavBytes, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, options.sampleRateHz, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(wavBytes, 36, "data");
  view.setUint32(40, pcmBytes.byteLength, true);
  wavBytes.set(pcmBytes, 44);

  return wavBytes;
}

function writeAscii(target: Uint8Array, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    target[offset + index] = value.charCodeAt(index);
  }
}

function decodeBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function decodeXmlEntities(value: string): string {
  return value.replace(/&(?:#(\d+)|#x([\da-fA-F]+)|amp|lt|gt|quot|apos);/g, (entity, dec, hex) => {
    if (dec) {
      return String.fromCodePoint(Number.parseInt(dec, 10));
    }

    if (hex) {
      return String.fromCodePoint(Number.parseInt(hex, 16));
    }

    switch (entity) {
      case "&amp;":
        return "&";
      case "&lt;":
        return "<";
      case "&gt;":
        return ">";
      case "&quot;":
        return '"';
      case "&apos;":
        return "'";
      default:
        return entity;
    }
  });
}
