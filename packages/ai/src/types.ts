export type ChannelPresetId = "tiny_mechanisms";

export type ProjectStyleContext = {
  visualStyle: string;
  tone: string;
  pacing: string;
  colorAndLighting: string;
  imageContinuity: string;
  voiceDirection: string;
};

export type ScriptEpisode = {
  seedId: string;
  workingTitle: string;
  centralQuestion: string;
  viewerCuriosity: string;
  mechanismSummary: string;
  payoff: string;
  riskFlags: string[];
};

export type ScriptFactPack = {
  coreMechanism: string;
  supportingFacts: string[];
  simpleAnalogy: string;
  commonMisconception: string;
  doNotSay: string[];
  needsHumanReview: boolean;
};

export type ScriptMetadataDraft = {
  youtubeTitle: string;
  description: string;
  hashtags: string[];
  disclosureHint: string;
};

export type ScriptScene = {
  position: number;
  role: "hook" | "context" | "point" | "payoff" | "cta";
  durationSeconds: number;
  narration: string;
  caption: string;
  imagePrompt: string;
  ssml: string;
  visualBrief: string;
  ttsDirection: string;
};

export type GenerateScriptInput = {
  channelPresetId: ChannelPresetId;
  seedId: string;
  targetDurationSeconds: 30 | 45 | 60;
};

export type GenerateScriptOutput = {
  title: string;
  channelPresetId: ChannelPresetId;
  episode: ScriptEpisode;
  styleContext: ProjectStyleContext;
  facts: ScriptFactPack;
  scenes: ScriptScene[];
  metadataDraft: ScriptMetadataDraft;
  promptPayload: Record<string, unknown>;
  responseText: string;
  responseMetadata: Record<string, unknown>;
};

export type ImageProvider = "openai" | "google_gemini";

export type GenerateImageInput = {
  prompt: string;
  model?: string;
  provider?: ImageProvider;
  promptMetadata?: Record<string, unknown>;
};

export type GenerateImageOutput = {
  bytes: Uint8Array;
  mimeType: "image/png";
  model: string;
  provider: ImageProvider;
  responseMetadata: Record<string, unknown>;
};

export type GenerateAudioInput = {
  ssml: string;
  prompt?: string;
  model?: string;
  voiceName?: string;
  promptMetadata?: Record<string, unknown>;
};

export type GenerateAudioOutput = {
  bytes: Uint8Array;
  mimeType: "audio/wav";
  model: string;
  responseMetadata: Record<string, unknown>;
};
