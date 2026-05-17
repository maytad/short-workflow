export type ScriptScene = {
  position: number;
  role: "hook" | "context" | "point" | "payoff" | "cta";
  durationSeconds: number;
  narration: string;
  caption: string;
  imagePrompt: string;
  ssml: string;
};

export type GenerateScriptInput = {
  topic: string;
  targetDurationSeconds: 30 | 45 | 60;
};

export type GenerateScriptOutput = {
  title: string;
  scenes: ScriptScene[];
  responseText: string;
  responseMetadata: Record<string, unknown>;
};

export type ImageProvider = "openai" | "google_gemini";

export type GenerateImageInput = {
  prompt: string;
  model?: string;
  provider?: ImageProvider;
};

export type GenerateImageOutput = {
  bytes: Uint8Array;
  mimeType: "image/png";
  model: string;
  provider: ImageProvider;
  responseMetadata: Record<string, unknown>;
};

export type GenerateAudioOutput = {
  bytes: Uint8Array;
  mimeType: "audio/mpeg";
  model: string;
  responseMetadata: Record<string, unknown>;
};
