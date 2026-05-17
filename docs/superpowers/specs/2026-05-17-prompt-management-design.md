# Prompt Management Design

## Summary

Short Workflow should manage generation prompts as first-class, versioned application code. The MVP will use a local prompt registry in `packages/ai`, compile provider-specific prompts from typed inputs, and record the compiled request payload in `prompt_versions` for debugging and reproduction.

This design improves the current one-shot prompt flow without adding a prompt editing UI, new database tables, or provider-hosted prompt dependencies.

## Goals

- Make script, image, and audio generation prompts explicit, reusable, and versioned.
- Keep the generated video in English and aligned with the existing faceless 9:16 short-form format.
- Use structured outputs for machine-ingested text generation instead of relying on free-form JSON parsing.
- Keep scene image prompts visually consistent across a project.
- Make Gemini TTS prompts less likely to read instructions aloud by clearly separating performance direction from transcript text.
- Preserve reproducibility by storing compiled prompt payloads in `prompt_versions`.

## Non-Goals

- No prompt editor UI in the MVP.
- No database-managed prompt templates in the MVP.
- No provider dashboard prompt dependency as the source of truth.
- No new prompt database schema in the MVP.
- No background music, subtitle export, publishing automation, or cloud rendering.
- No automated test expansion unless the user explicitly asks for tests during the current MVP stage.

## Research Basis

The design follows current provider guidance:

- OpenAI recommends using message roles or `instructions` for higher-priority developer guidance, and keeping reusable prompt content stable for prompt caching.
- OpenAI recommends Structured Outputs over JSON mode when schema adherence matters.
- OpenAI image generation supports provider-side prompt revision and configurable size, quality, and format.
- Gemini prompt guidance emphasizes clear structure, delimiters, examples, explicit constraints, and structured outputs for complex JSON.
- Gemini image guidance favors descriptive prompts with subject, context, style, camera, lighting, and aspect ratio.
- Gemini TTS guidance recommends a clear preamble, director notes, and explicit transcript labeling so the model synthesizes speech instead of reading instructions.

Reference URLs:

- https://developers.openai.com/api/docs/guides/prompt-engineering
- https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses
- https://developers.openai.com/api/docs/guides/image-generation
- https://ai.google.dev/gemini-api/docs/prompting-strategies
- https://ai.google.dev/gemini-api/docs/structured-output
- https://ai.google.dev/gemini-api/docs/image-generation
- https://ai.google.dev/gemini-api/docs/imagen
- https://ai.google.dev/gemini-api/docs/speech-generation

## Architecture

Prompt templates live in `packages/ai/src/prompts`.

Expected structure:

```text
packages/ai/src/prompts/
  index.ts
  types.ts
  shared.ts
  scriptPlan.ts
  imagePrompt.ts
  ttsPrompt.ts
```

Each prompt template exports a stable object:

```ts
type PromptTemplate<TInput, TOutput> = {
  id: string;
  version: number;
  purpose: "script" | "image_prompt" | "ssml";
  provider: "openai" | "google_gemini" | "google_tts";
  compile(input: TInput): CompiledPrompt<TOutput>;
};
```

`CompiledPrompt` contains:

- `templateId`
- `templateVersion`
- `purpose`
- `provider`
- `messages` or provider-specific prompt content
- `schemaName`
- `schemaVersion`
- `modelParameters`
- `metadata`

The provider wrappers should stay thin. They receive compiled prompt content and provider settings, call the provider, normalize the response, and return provider-neutral output types.

## Prompt Pipeline

### 1. Script Plan

`generate_script` compiles a project-level script prompt from:

- topic
- target duration
- required scene roles and positions
- output format requirements
- default project style context

The output is a structured scene plan:

- project title
- project style context used for all scene image and audio prompts
- scenes with position, role, duration, narration, caption, image prompt seed, and SSML

The implementation will use OpenAI Structured Outputs through the Responses API. Application code still validates the returned object with Zod because structured output does not guarantee semantic correctness.

The prompt should separate stable developer instructions from per-project user input. Stable instructions define the product format, English-only rule, scene role semantics, caption constraints, and output schema. User input contains topic and duration.

### 2. Image Prompt Compile

`generate_scene_image` should not send the editable scene `imagePrompt` directly to the image provider. It first compiles a provider-ready prompt from:

- project title and topic
- project visual style context
- scene position and role
- scene narration
- scene caption
- editable scene image prompt seed
- target format: vertical 9:16 short-form frame

The compiled image prompt should be a descriptive paragraph with:

- subject
- context and background
- vertical composition
- camera angle or lens language
- lighting and color
- visual texture or medium
- faceless visual essay or mini-documentary style
- clear instruction to avoid embedded text, captions, watermarks, UI, logos, and typography unless explicitly requested

The MVP image prompt compiler is a pure deterministic TypeScript function, not an additional model call. It wraps the scene image prompt seed with project style context and provider-specific generation rules. The final provider call receives one clean provider prompt string.

### 3. Image Generate

The image provider wrapper sends the compiled provider prompt to OpenAI or Gemini.

OpenAI image generation should continue using a 9:16-compatible size. Gemini image generation should include 9:16 aspect guidance in the prompt. The MVP will not add model-specific Gemini image size or aspect ratio configuration beyond what the current SDK wrapper already supports.

Provider metadata should include model id, provider, image size or aspect ratio when available, and revised prompt if the provider returns one.

### 4. TTS Prompt Compile

`generate_scene_audio` should compile a Gemini TTS prompt from:

- narration text extracted from SSML
- scene role
- target duration
- project tone
- voice name

The compiled TTS prompt should use clear sections:

```text
Synthesize speech for this short-form video narration. Do not read headings or instructions aloud.

### AUDIO PROFILE
...

### DIRECTOR NOTES
...

### TRANSCRIPT
...
```

Director notes should be short and useful:

- tone: clear, warm, documentary-style, high-retention short-form narration
- pacing: energetic but intelligible
- pauses: respect natural sentence breaks and SSML-derived pauses where supported
- pronunciation: preserve proper nouns from transcript

The transcript section contains the exact spoken words. If inline audio tags are later introduced, they must be deliberate and stored as part of the compiled prompt payload.

### 5. Audio Generate

The Gemini TTS wrapper sends the compiled TTS prompt to `generateContent` with audio response modality and the configured voice. It should store compact metadata such as voice name, model id, mime type, sample rate, and finish reason.

## Prompt Version Storage

Existing `prompt_versions` remains the prompt history table.

For each generation:

- `purpose = "script"` for script planning.
- `purpose = "image_prompt"` for image prompt compilation and image generation request metadata.
- `purpose = "ssml"` for TTS prompt compilation and speech generation request metadata.

`prompt_payload` should store:

- template id and version
- compiled prompt text or messages
- schema name and version when structured output is used
- model parameters
- provider request settings needed for reproduction
- source inputs such as topic, target duration, scene id, and scene content

`prompt_payload` must not store:

- secrets
- API keys
- binary files
- base64 image or audio payloads
- large provider responses

`response_text` should store compact normalized text responses such as structured script JSON. Large or binary outputs stay in `assets`. `response_metadata` stores compact provider metadata.

Project style context is stored inside the script generation `prompt_versions.response_text` and reused by the worker while processing the current project detail. The MVP does not add a dedicated database column for style context.

## Data Flow

Script generation:

```text
project topic -> scriptPlan template -> OpenAI Structured Output -> Zod validation -> scenes -> prompt_versions(script)
```

Image generation:

```text
scene content -> imagePrompt template -> compiled image prompt -> image provider -> asset -> prompt_versions(image_prompt)
```

Audio generation:

```text
scene narration/SSML -> ttsPrompt template -> Gemini TTS prompt -> audio provider -> asset -> prompt_versions(ssml)
```

## Error Handling

Prompt compilation failures should fail the job before provider calls and mark the job as failed through existing worker retry behavior.

Provider responses that fail schema validation should throw existing provider-specific errors and rely on job retry policy.

If structured output returns a schema-valid but semantically invalid plan, app validation must reject it. Examples:

- wrong scene count
- scene role order does not match the selected duration preset
- empty narration, caption, image prompt, or transcript
- non-English content
- durations do not sum to the target duration within the chosen tolerance

## UI Impact

The existing scene editor remains the review surface. Users still edit narration, caption, image prompt seed, and SSML. The compiled provider prompt does not need to be exposed in the MVP UI.

A future prompt inspector can read `prompt_versions` and show compiled prompts, model settings, and response metadata, but that is out of scope for this design.

## Validation

During the current MVP stage, do not add new automated tests or run test suites by default. Implementation verification should use:

- TypeScript typecheck for touched packages.
- Manual review of compiled prompt examples.
- Manual generation smoke checks when provider keys and local asset root are configured.

If the user later asks for automated tests, focused unit coverage should target pure prompt compiler functions first because they do not require provider calls.

## Implementation Notes

- Keep prompt compilers pure and deterministic.
- Avoid adding dependencies. Use existing Zod where schema validation is needed.
- Keep provider model defaults configurable through env variables.
- Do not let `apps/web` import prompt registry code directly.
- Do not move provider API keys or prompt compilation into the frontend.
- Keep prompt payloads compact enough for the existing 64 KB guidance in the main design spec.
- Script planning continues to output final editable SSML for each scene in the MVP.
- Project style context is derived during script generation and stored in prompt history, not in a new database field.
