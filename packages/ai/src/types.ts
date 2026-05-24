import type { CandidateJudgeResult, RefinedEpisodeBrief } from "./prompts/episodeJudge";
import type { EpisodeCandidate, RoleEpisodeCandidateResponse } from "./prompts/episodeResearch";
import type { VisualHookArchetype } from "./prompts/visualHooks";

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

export type SceneVisualPlan = {
  firstFrameJob: string;
  familiarObject: string;
  visibleAction: string;
  visibleConsequence: string;
  viewerQuestion: string;
  motionOrTension: string;
  cameraFraming: string;
  captionSafeZone: string;
  avoidVisuals: string[];
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
  visualHookArchetype: VisualHookArchetype;
  visualPlan: SceneVisualPlan;
  ttsDirection: string;
};

export type GenerateScriptInput = {
  channelPresetId: ChannelPresetId;
  seedId: string;
  targetDurationSeconds: 30 | 45 | 60;
  episodeCandidate?: EpisodeCandidate;
  refinedEpisodeBrief?: RefinedEpisodeBrief;
  episodeResearch?: { candidates: RoleEpisodeCandidateResponse[]; judge: CandidateJudgeResult };
  episodeResearchPromptPayload?: Record<string, unknown>;
  episodeResearchResponseMetadata?: Record<string, unknown>;
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
