import type { ImageProvider } from "../types";

export type PromptPurpose = "script" | "image_prompt" | "ssml";
export type PromptProvider = ImageProvider | "google_tts";

export type PromptMessage = {
  role: "developer" | "user";
  content: string;
};

export type CompiledPrompt = {
  templateId: string;
  templateVersion: number;
  purpose: PromptPurpose;
  provider: PromptProvider;
  messages?: PromptMessage[];
  prompt?: string;
  schemaName?: string;
  schemaVersion?: number;
  modelParameters?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type PromptTemplate<TInput, TCompiled extends CompiledPrompt> = {
  id: string;
  version: number;
  purpose: PromptPurpose;
  provider: PromptProvider;
  compile(input: TInput): TCompiled;
};

export function promptPayload(compiled: CompiledPrompt, source: Record<string, unknown>) {
  return {
    source,
    templateId: compiled.templateId,
    templateVersion: compiled.templateVersion,
    purpose: compiled.purpose,
    provider: compiled.provider,
    messages: compiled.messages,
    prompt: compiled.prompt,
    schemaName: compiled.schemaName,
    schemaVersion: compiled.schemaVersion,
    modelParameters: compiled.modelParameters ?? {},
    metadata: compiled.metadata ?? {},
  };
}
