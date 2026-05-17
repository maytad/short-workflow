# Prompt Management Design

## Summary

Short Workflow should manage generation prompts as first-class, versioned application code. The first MVP prompt direction is no longer a generic user-entered topic flow. It is a fixed YouTube Shorts channel preset that generates English faceless micro-documentaries about hidden mechanisms in everyday things.

The first channel preset is:

- Preset id: `tiny_mechanisms`
- Channel name: `Tiny Mechanisms`
- Promise: one everyday mystery explained in under 45 seconds.
- Format: faceless 9:16 mini-documentary with generated images, clear narration, large captions, and a loopable ending.
- Default duration: 45 seconds.

The MVP will use a local prompt registry in `packages/ai`, compile provider-specific prompts from typed inputs, and record compiled request payloads in `prompt_versions` for debugging and reproduction.

This design replaces the generic custom topic/title prompt direction for the first MVP. Custom prompt editing, custom topic entry, and custom channel selection remain out of scope until the fixed preset produces a reliable local video flow.

## Goals

- Make script, image, and audio generation prompts explicit, reusable, and versioned.
- Use one focused channel preset for the first working production flow.
- Hide custom topic and title entry from the first MVP frontend path.
- Generate English Shorts that explain one surprising everyday mechanism per video.
- Use Structured Outputs for machine-ingested text generation instead of free-form JSON parsing.
- Keep factual claims stable, evergreen, and low-risk.
- Keep each episode distinct enough to avoid mass-produced or repetitive AI output.
- Keep scene image prompts visually consistent across a project while still varying each episode.
- Make Gemini TTS prompts less likely to read instructions aloud by clearly separating performance direction from transcript text.
- Preserve reproducibility by storing compiled prompt payloads in `prompt_versions`.

## Non-Goals

- No prompt editor UI in the MVP.
- No custom topic, custom title, or custom niche UI in this stage.
- No database-managed prompt templates in the MVP.
- No provider dashboard prompt dependency as the source of truth.
- No new prompt database schema in the MVP.
- No public channel publishing automation.
- No YouTube upload integration.
- No trend scraping, YouTube API integration, or competitor analysis automation.
- No news, finance, health, politics, celebrity, legal, or sensitive current-event content.
- No background music, subtitle export, publishing automation, or cloud rendering.
- No automated test expansion unless the user explicitly asks for tests during the current MVP stage.

## Research Basis

YouTube's Shorts discovery guidance says the system does not favor a specific format. It ranks Shorts based on viewer personalization and performance signals, including whether viewers choose to watch or ignore a Short, average view duration, average percentage viewed, and satisfaction signals such as likes, dislikes, and surveys.

YouTube's Shorts view count changed on March 31, 2025: a view counts when a Short starts to play or replay. YouTube keeps the previous view behavior as `Engaged views`, which is better for comparing whether viewers chose to continue watching.

YouTube monetization guidance warns against inauthentic content: mass-produced or repetitive videos with little variation or low educational/commentary value. This matters for AI-generated faceless video. The preset must create varied substance, not only a repeated template.

YouTube's altered or synthetic content policy requires disclosure when realistic altered or synthetic content could mislead viewers. The preset avoids realistic depictions of real events that did not occur, real people appearing to say or do things they did not do, and sensitive topics that create higher disclosure and trust risk.

Provider prompt guidance supports the prompt architecture:

- OpenAI recommends keeping stable repeated prompt content early in the request to benefit prompt caching.
- OpenAI recommends Structured Outputs over JSON mode when schema adherence matters.
- OpenAI image generation supports provider-side prompt revision and configurable size, quality, and format.
- Gemini prompt guidance emphasizes clear structure, delimiters, examples, explicit constraints, and structured outputs for complex JSON.
- Gemini image guidance recommends describing the scene in narrative detail rather than listing disconnected keywords.
- Gemini TTS guidance supports natural-language control over style, accent, pace, and tone through audio profile and director notes.

Reference URLs:

- https://support.google.com/youtube/answer/11914225?hl=en&co=YOUTUBE._YTVideoType%3Dshorts
- https://support.google.com/youtube/answer/10059070?hl=en
- https://support.google.com/youtube/answer/1311392?hl=en
- https://support.google.com/youtube/answer/14328491
- https://developers.openai.com/api/docs/guides/prompt-engineering
- https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses
- https://developers.openai.com/api/docs/guides/image-generation
- https://ai.google.dev/gemini-api/docs/prompting-strategies
- https://ai.google.dev/gemini-api/docs/structured-output
- https://ai.google.dev/gemini-api/docs/image-generation
- https://ai.google.dev/gemini-api/docs/imagen
- https://ai.google.dev/gemini-api/docs/speech-generation

## Channel Preset

The first prompt preset is `tiny_mechanisms`.

Audience:

- English-speaking curious general audience.
- Viewers who like short science, engineering, psychology-of-perception, design, and everyday-object explainers.
- Assumed knowledge: middle-school level. Avoid jargon unless immediately explained.

Content promise:

- Explain one everyday phenomenon, object, or design choice.
- Lead with a counterintuitive claim or question.
- Reveal a concrete mechanism.
- End with a satisfying payoff or loop line.

Tone:

- Clear, curious, precise, lightly dramatic.
- No hype phrases such as "you won't believe" unless the claim truly earns it.
- No motivational advice, generic life lessons, or fake urgency.
- No host greeting, channel intro, or long CTA.

Visual identity:

- Faceless documentary-style generated images.
- Realistic or semi-realistic editorial visuals, macro details, diagrams-as-scenes, object cutaways, and metaphorical compositions.
- Clean high-contrast compositions for vertical mobile viewing.
- No embedded text, watermarks, UI, logos, fake screenshots, real public figures, or deceptive realistic events.

## Topic Boundary

Allowed topic families:

- Everyday object design: airplane windows, elevator buttons, bottle shapes, zippers, traffic lights.
- Human perception: recorded voice, optical illusions, motion sickness, why mirrors flip left-right.
- Everyday physics: cold batteries, phone vibration, boiling water, microwave hot spots.
- Materials and chemistry: onion tears, soap bubbles, stainless steel smell removal, nonstick pans.
- Small systems: QR codes, barcodes, credit card chips, autofocus, noise cancellation.

Disallowed topic families:

- Medical advice, disease, diagnosis, supplements, mental-health treatment.
- Finance, investing, tax, insurance, legal advice.
- Politics, elections, war, disasters, crime, scandals, or breaking news.
- Celebrity, public figure, or real-person synthetic scenes.
- Dangerous experiments or instructions.
- Children's-character content.
- Conspiracy framing or unsupported claims.

If an idea falls near a disallowed boundary, the episode selector must reject it and choose another idea.

## Episode Source

Because the first UI will not accept custom topics, episodes come from an internal preset source.

MVP source:

- A code-defined episode bank or seed list attached to the `tiny_mechanisms` preset.
- Each entry includes `seedId`, `centralQuestion`, `everydayObjectOrPhenomenon`, `mechanismHint`, and `riskLevel`.
- The selector picks the next unused seed in stable list order.
- The first UI does not expose seed selection.

Future source, out of scope for this stage:

- Trend research.
- YouTube search term mining.
- Audience analytics feedback.
- User-submitted topic queue.

The first implementation should ship with this default seed bank. The user can later expand the bank without changing frontend workflow.

Default seed bank:

- Why your recorded voice sounds wrong.
- Why airplane windows are round.
- Why onions make your eyes water.
- Why batteries drain faster in the cold.
- Why microwave ovens leave cold spots.
- Why QR codes still work when scratched.
- Why zippers lock instead of sliding open.
- Why soap bubbles are round.
- Why mirrors appear to flip left and right.
- Why noise-cancelling headphones work better on steady sounds.
- Why barcode scanners can read black and white stripes.
- Why credit card chips are safer than magnetic stripes.
- Why autofocus can tell an image is sharp.
- Why popcorn kernels pop.
- Why nonstick pans stop food from grabbing the surface.
- Why stainless steel can reduce garlic smell on your hands.
- Why ice floats instead of sinking.
- Why soda fizzes when you open it.
- Why a compass points north.
- Why rubber bands snap back.
- Why phone screens rotate when you tilt them.
- Why escalator steps stay level.
- Why washing machines spin clothes almost dry.
- Why traffic lights use red, yellow, and green.
- Why stop signs are octagons.
- Why pencils leave marks on paper.
- Why sticky notes peel off without tearing paper.
- Why hook-and-loop fasteners stick.
- Why ice cubes crack in a warm drink.
- Why a thermos keeps drinks hot or cold.

## Architecture

Prompt templates and presets live in `packages/ai/src/prompts`.

Expected structure:

```text
packages/ai/src/prompts/
  index.ts
  types.ts
  shared.ts
  presets/
    tinyMechanisms.ts
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

The preset exports stable content used by prompt templates:

- `channelPresetId`
- `channelName`
- `channelBible`
- `allowedTopicFamilies`
- `disallowedTopicFamilies`
- `episodeSeeds`
- `defaultDurationSeconds`
- `sceneRolePlan`
- `retentionRules`
- `visualIdentity`
- `ttsIdentity`

The provider wrappers should stay thin. They receive compiled prompt content and provider settings, call the provider, normalize the response, and return provider-neutral output types.

## Prompt Pipeline

### 1. Channel Bible

`channel_bible` is stable prompt content shared across generation steps.

It defines:

- channel name and promise
- audience
- allowed and disallowed topics
- tone
- visual identity
- retention rules
- factuality rules
- caption style
- loop-ending style

The channel bible should be stable and placed early in text-generation requests so repeated content can benefit from prompt caching.

### 2. Episode Selection

The episode selector chooses one seed and creates an episode brief.

Input:

- channel preset id
- available seed entries
- optional excluded seed ids
- duration preset

Output:

- `seedId`
- `workingTitle`
- `centralQuestion`
- `viewerCuriosity`
- `mechanismSummary`
- `payoff`
- `factsToVerify`
- `riskFlags`

The selector must not invent a new topic when a seed bank is provided. If all seeds are exhausted, it should fail clearly instead of generating off-brand content.

### 3. Fact Pack

The fact pack is a concise factual scaffold for the script.

Input:

- episode brief
- channel bible

Output:

- `coreMechanism`
- `supportingFacts`
- `simpleAnalogy`
- `commonMisconception`
- `doNotSay`
- `needsHumanReview`

The MVP does not need live web research inside the app. The prompt should prefer stable common mechanisms and mark uncertainty. The editor remains the review surface for the user to catch factual issues before rendering.

### 4. Script Plan

`generate_script` compiles a project-level script prompt from:

- channel bible
- selected episode brief
- fact pack
- target duration
- required scene roles and positions
- output format requirements

The implementation will use OpenAI Structured Outputs through the Responses API. Application code still validates the returned object with Zod because structured output does not guarantee semantic correctness.

Default 45-second structure:

- Scene 1, `hook`, 0-3s: counterintuitive first line.
- Scene 2, `context`, 3-9s: what viewers experience.
- Scene 3, `point`, 9-20s: core mechanism.
- Scene 4, `point`, 20-31s: analogy, demonstration, or visual proof.
- Scene 5, `payoff`, 31-40s: satisfying explanation.
- Scene 6, `cta`, 40-45s: loop ending or very soft follow line.

The existing `cta` role should be treated as a loop-ending slot for this preset. It should not produce a long subscribe CTA.

Script constraints:

- English only.
- 85-115 spoken words for 45 seconds, unless voice speed settings differ.
- One idea per video.
- No greeting.
- No "in this video".
- No source citations spoken aloud.
- No more than one rhetorical question after the hook.
- Captions should be short, punchy, and readable on mobile.
- Every scene must have a visual brief that can become a strong image prompt.

Example hook style:

- "Your recorded voice is not lying to you. Your skull is."
- "Airplane windows are round because corners once helped tear planes apart."
- "A scratched QR code can still work because it was designed to lose pieces."

The output is a structured episode plan:

- project title
- channel preset id
- episode brief
- fact pack
- project style context used for image and audio prompts
- scenes with position, role, duration, narration, caption, visual brief, image prompt seed, and SSML or spoken transcript
- metadata draft for later manual upload

### 5. Image Prompt Compile

`generate_scene_image` should not send the editable scene `imagePrompt` directly to the image provider. It first compiles a provider-ready prompt from:

- channel visual identity
- project title
- selected episode brief
- project style context
- scene position and role
- scene narration
- scene caption
- scene visual brief
- editable scene image prompt seed
- target format: vertical 9:16 short-form frame

The compiled image prompt should be a descriptive paragraph with:

- subject
- context and background
- vertical composition
- camera angle or lens language
- lighting and color
- visual texture or medium
- faceless mini-documentary style
- clear instruction to avoid embedded text, captions, watermarks, UI, logos, public figures, and typography unless explicitly requested

Provider-ready image prompt shape:

```text
Create a vertical 9:16 editorial documentary image for a short-form science explainer. The scene shows [specific subject and action], with [background/context]. Use [camera/lens/composition], [lighting], and [texture/style]. The image should feel like [channel visual identity]. Do not include text, captions, watermarks, logos, UI, public figures, or misleading depictions of real events.
```

For abstract concepts, use concrete visual metaphors:

- sound through skull bone as subtle vibration lines through a translucent profile silhouette
- QR code error correction as torn paper squares still forming a readable pattern
- cold battery chemistry as a macro battery cross-section in frosted air

The MVP image prompt compiler is a pure deterministic TypeScript function, not an additional model call. It wraps the scene image prompt seed with project style context and provider-specific generation rules. The final provider call receives one clean provider prompt string.

### 6. Image Generate

The image provider wrapper sends the compiled provider prompt to OpenAI or Gemini.

OpenAI image generation should continue using a 9:16-compatible size. Gemini image generation should include 9:16 aspect guidance in the prompt. The MVP will not add model-specific Gemini image size or aspect ratio configuration beyond what the current SDK wrapper already supports.

Provider metadata should include model id, provider, image size or aspect ratio when available, and revised prompt if the provider returns one.

### 7. TTS Prompt Compile

`generate_scene_audio` should compile a Gemini TTS prompt from:

- narration text extracted from SSML or spoken transcript
- scene role
- target duration
- channel tone
- project tone
- voice name

TTS should sound like a high-retention educational narrator, not a generic AI voice.

Compiled TTS prompt shape:

```text
Synthesize speech for this short-form educational narration. Do not read headings or instructions aloud.

### AUDIO PROFILE
Name: Tiny Mechanisms Narrator
Role: curious documentary narrator for 9:16 short-form explainers

### DIRECTOR NOTES
Tone: clear, warm, precise, quietly dramatic
Pace: brisk but intelligible
Energy: start with urgency, settle into explanation, land the final line cleanly
Pauses: brief pauses after the hook and before the payoff

### TRANSCRIPT
[exact narration text]
```

The transcript is the source of spoken words. Director notes must never be mixed into the transcript. If inline audio tags are later introduced, they must be deliberate and stored as part of the compiled prompt payload.

### 8. Audio Generate

The Gemini TTS wrapper sends the compiled TTS prompt to `generateContent` with audio response modality and the configured voice. It should store compact metadata such as voice name, model id, mime type, sample rate, and finish reason.

### 9. Metadata Draft

Even though upload automation is out of scope, script generation should produce metadata drafts for later manual upload.

Output:

- `youtubeTitle`, max 100 characters.
- `description`, 2-4 short sentences.
- `hashtags`, 3-5 tags.
- `disclosureHint`, whether the video may need altered/synthetic disclosure.

Title style:

- Searchable and curiosity-led.
- No clickbait that overpromises.
- Front-load the object or phenomenon.

Examples:

- `Why Your Recorded Voice Sounds Wrong`
- `Why Airplane Windows Are Round`
- `Why QR Codes Survive Damage`

`metadataDraft` is stored in the script generation response and prompt payload. It is not shown in the UI during this stage.

## Structured Output Contract

The script plan output should include:

- `channelPresetId`
- `episode`
  - `seedId`
  - `workingTitle`
  - `centralQuestion`
  - `viewerCuriosity`
  - `mechanismSummary`
  - `payoff`
  - `riskFlags`
- `styleContext`
  - `tone`
  - `visualStyle`
  - `narrationStyle`
- `facts`
  - `coreMechanism`
  - `supportingFacts`
  - `simpleAnalogy`
  - `commonMisconception`
  - `doNotSay`
  - `needsHumanReview`
- `scenes`
  - `position`
  - `role`
  - `durationSeconds`
  - `narration`
  - `caption`
  - `visualBrief`
  - `imagePromptSeed`
  - `ssml` or `spokenTranscript`
  - `ttsDirection`
- `metadataDraft`
  - `youtubeTitle`
  - `description`
  - `hashtags`
  - `disclosureHint`

Application validation should reject:

- wrong scene count
- wrong role order
- total duration outside tolerance
- non-English narration or captions
- empty narration, captions, visual briefs, image prompt seeds, or transcript
- claims in disallowed categories
- long subscribe CTAs
- repeated caption text across scenes
- provider prompt text that asks for embedded typography
- realistic synthetic real-world event imagery that lacks a disclosure hint

## Retention Contract

The prompt should optimize for these creative signals:

- The first spoken sentence must be understandable without context.
- The first image must identify the object or phenomenon immediately.
- The hook should create a concrete curiosity gap, not generic mystery.
- Scene changes should happen every 6-12 seconds in the MVP scene model.
- Captions should change per scene and summarize the beat, not duplicate every narration word.
- The payoff must answer the hook directly.
- The final line should connect back to the opening idea so a replay feels natural.

The MVP renderer may not yet support sub-scene cuts every 1-2 seconds. The prompt should therefore make each generated scene image visually strong enough to carry its segment.

## Anti-Repetition Rules

To avoid inauthentic or mass-produced feel:

- Do not reuse the same hook formula more than twice in a 20-video batch.
- Do not start multiple videos with "This is why".
- Do not use the same final CTA across videos.
- Do not use generic image prompts such as "futuristic illustration" without scene-specific subject detail.
- Each episode must have a different mechanism, object, analogy, and payoff.
- The script must include at least one concrete object-level detail unique to the episode.

The prompt payload should store enough metadata to audit these differences later.

## Prompt Version Storage

Existing `prompt_versions` remains the prompt history table.

For each generation:

- `purpose = "script"` for episode selection, fact pack, script planning, and metadata draft.
- `purpose = "image_prompt"` for image prompt compilation and image generation request metadata.
- `purpose = "ssml"` for TTS prompt compilation and speech generation request metadata.

`prompt_payload` should store:

- template id and version
- channel preset id and version
- selected episode seed id
- compiled prompt text or messages
- schema name and version when Structured Outputs are used
- model parameters
- provider request settings needed for reproduction
- source inputs such as selected seed, target duration, scene id, and scene content

`prompt_payload` must not store:

- secrets
- API keys
- binary files
- base64 image or audio payloads
- large provider responses

`response_text` should store compact normalized text responses such as structured script JSON. Large or binary outputs stay in `assets`. `response_metadata` stores compact provider metadata.

Project style context, episode brief, fact pack, and metadata draft are stored inside the script generation `prompt_versions.response_text` and reused by the worker while processing the current project detail. The MVP does not add dedicated database columns for these fields.

## Data Flow

Script generation:

```text
tiny_mechanisms preset -> next unused episode seed -> episode brief -> fact pack -> scriptPlan template -> OpenAI Structured Output -> Zod validation -> scenes -> prompt_versions(script)
```

Image generation:

```text
scene content + channel visual identity -> imagePrompt template -> compiled image prompt -> image provider -> asset -> prompt_versions(image_prompt)
```

Audio generation:

```text
scene narration/SSML + channel voice identity -> ttsPrompt template -> Gemini TTS prompt -> audio provider -> asset -> prompt_versions(ssml)
```

## Error Handling

Prompt compilation failures should fail the job before provider calls and mark the job as failed through existing worker retry behavior.

If all episode seeds are exhausted, script generation should fail clearly with a product-level message that the preset needs more seeds. It must not invent an off-preset topic.

Provider responses that fail schema validation should throw existing provider-specific errors and rely on job retry policy.

If Structured Outputs returns a schema-valid but semantically invalid plan, app validation must reject it. Examples:

- wrong scene count
- scene role order does not match the selected duration preset
- empty narration, caption, image prompt, or transcript
- non-English content
- durations do not sum to the target duration within the chosen tolerance
- topic violates preset boundaries
- output includes a real public figure or realistic real-world event depiction

## UI Impact

The first frontend flow must hide custom topic/title entry for this preset.

Instead, project creation can use a single command:

- `Create Tiny Mechanisms episode`

The project title shown in the UI comes from the generated episode `workingTitle`.

Scene editing remains available:

- narration
- caption
- image prompt seed
- SSML or spoken transcript when exposed

The existing scene editor remains the review surface. The compiled provider prompt does not need to be exposed in the MVP UI.

A future prompt inspector can read `prompt_versions` and show compiled prompts, model settings, and response metadata, but that is out of scope for this design.

## Data And Storage Impact

No schema change is required.

The preset id and compiled prompt payload can be stored in existing `prompt_versions.prompt_payload`.

Generated assets remain under `LOCAL_ASSET_ROOT`.

The seed bank should live in application code under the prompt registry rather than in a new database table for this stage.

## Safety And Policy Notes

The preset should avoid realistic synthetic depictions of real events, disasters, public figures, or sensitive domains.

If an episode requires realistic generated scenes that could be mistaken for real footage, `metadataDraft.disclosureHint` should say disclosure may be required during manual upload.

The channel should not imply that AI-generated visuals are real footage. Metadata can describe the format as an illustrated explainer when useful.

## Validation

During the current MVP stage, do not add new automated tests or run test suites by default. Implementation verification should use:

- TypeScript typecheck for touched packages.
- Manual review of 3 compiled script prompt payloads.
- Manual review of 3 compiled image prompts.
- Manual review of 1 generated TTS prompt.
- Manual check that output stays within the allowed topic boundary.
- Manual check that the generated project can still be edited before asset generation.

If the user later asks for automated tests, focused unit coverage should target pure prompt compiler functions first because they do not require provider calls.

## Implementation Notes

- Keep prompt compilers pure and deterministic.
- Avoid adding dependencies. Use existing Zod where schema validation is needed.
- Keep provider model defaults configurable through env variables.
- Do not let `apps/web` import prompt registry code directly.
- Do not move provider API keys or prompt compilation into the frontend.
- Keep prompt payloads compact enough for the existing 64 KB guidance in the main design spec.
- Script planning continues to output final editable SSML or spoken transcript for each scene in the MVP.
- Project style context is derived during script generation and stored in prompt history, not in a new database field.
- The existing implementation plan must be updated after this merged design is approved because the prompt direction changed from generic topic input to fixed channel preset generation.
