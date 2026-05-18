export const PROJECT_STATUSES = ["draft", "ready", "rendering", "done", "failed"] as const;

export const SCENE_STATUSES = ["draft", "ready"] as const;

export const SCENE_ROLES = ["hook", "context", "point", "payoff", "cta"] as const;

export const ASSET_KINDS = ["image", "audio", "render", "thumbnail", "render_input", "caption_timing"] as const;

export const ASSET_STATUSES = ["pending", "ready", "failed"] as const;

export const STORAGE_DRIVERS = ["local"] as const;

export const ASSET_PROVIDERS = [
  "openai",
  "google_gemini",
  "google_tts",
  "remotion",
  "local",
  "elevenlabs",
] as const;

export const JOB_TYPES = [
  "generate_script",
  "generate_scene_image",
  "generate_scene_audio",
  "render_video",
] as const;

export const JOB_STATUSES = ["pending", "processing", "succeeded", "failed"] as const;

export const RENDER_STATUSES = ["pending", "processing", "succeeded", "failed"] as const;

export const PROMPT_PURPOSES = ["script", "image_prompt", "ssml", "caption"] as const;

export const DURATION_PRESETS_SECONDS = [30, 45, 60] as const;

export const DEFAULT_TARGET_DURATION_SECONDS = 45;
export const DEFAULT_WORKER_CONCURRENCY = 2;
export const DEFAULT_MAX_ATTEMPTS = 5;

export const TINY_MECHANISMS_TOPIC_PREFIX = "tiny_mechanisms:";
export const TINY_MECHANISMS_PENDING_TOPIC = `${TINY_MECHANISMS_TOPIC_PREFIX}pending`;
export const TINY_MECHANISMS_PENDING_TITLE = "Tiny Mechanisms Episode";
export const TINY_MECHANISMS_PROJECT_DESCRIPTION = "Tiny Mechanisms episode";

export const RENDER_WIDTH = 1080;
export const RENDER_HEIGHT = 1920;
export const RENDER_FPS = 30;
