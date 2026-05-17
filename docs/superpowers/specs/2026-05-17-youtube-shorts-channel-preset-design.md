# YouTube Shorts Channel Preset Design

## Summary

Short Workflow should start with one fixed YouTube Shorts channel concept instead of asking the user for a custom title or topic on the frontend. The first channel preset is a faceless English micro-documentary channel about hidden mechanisms in everyday things.

Working channel concept:

- Name: `Tiny Mechanisms`
- Promise: one everyday mystery explained in under 45 seconds.
- Format: faceless 9:16 mini-documentary with generated images, clear narration, large captions, and a loopable ending.
- Default duration: 45 seconds.

The preset gives the prompt system a stable creative identity, reduces MVP UI scope, and avoids generic topic input that can produce unfocused or low-quality videos.

## Goals

- Use one focused channel idea for the first working production flow.
- Remove custom topic and title entry from the first MVP frontend path.
- Generate English Shorts that explain one surprising everyday mechanism per video.
- Make each video distinct enough to avoid mass-produced or repetitive output.
- Keep factual claims stable, evergreen, and low-risk.
- Keep prompt behavior compatible with the existing prompt management design.
- Define the prompt contract for episode selection, script planning, image prompts, TTS, captions, and metadata.

## Non-Goals

- No public channel publishing automation.
- No YouTube upload integration.
- No custom topic, custom title, or custom niche UI in this stage.
- No trend scraping, YouTube API integration, or competitor analysis automation.
- No news, finance, health, politics, celebrity, legal, or sensitive current-event content.
- No background music in the MVP.
- No automated test expansion for this content preset unless explicitly requested.
- No database schema changes for channel presets in this stage.

## Research Basis

YouTube's Shorts discovery guidance says the system does not favor a specific format. It ranks Shorts based on viewer personalization and performance signals, including whether viewers choose to watch or ignore a Short, average view duration, average percentage viewed, and satisfaction signals such as likes, dislikes, and surveys.

YouTube's Shorts view count changed on March 31, 2025: a view counts when a Short starts to play or replay. YouTube keeps the previous view behavior as `Engaged views`, which is better for comparing whether viewers chose to continue watching.

YouTube monetization guidance warns against inauthentic content: mass-produced or repetitive videos with little variation or low educational/commentary value. This matters for AI-generated faceless video. The preset must create varied substance, not only a repeated template.

YouTube's altered or synthetic content policy requires disclosure when realistic altered or synthetic content could mislead viewers. The preset avoids realistic depictions of real events that did not occur, real people appearing to say or do things they did not do, and sensitive topics that create higher disclosure and trust risk.

Provider prompt guidance supports the prompt architecture:

- OpenAI recommends keeping stable repeated prompt content early in the request to benefit prompt caching.
- OpenAI recommends Structured Outputs over JSON mode when schema adherence matters.
- Gemini image guidance recommends describing the scene in narrative detail rather than listing disconnected keywords.
- Gemini TTS guidance supports natural-language control over style, accent, pace, and tone through audio profile and director notes.

Reference URLs:

- https://support.google.com/youtube/answer/11914225?hl=en&co=YOUTUBE._YTVideoType%3Dshorts
- https://support.google.com/youtube/answer/10059070?hl=en
- https://support.google.com/youtube/answer/1311392?hl=en
- https://support.google.com/youtube/answer/14328491
- https://developers.openai.com/api/docs/guides/prompt-engineering
- https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses
- https://ai.google.dev/gemini-api/docs/image-generation
- https://ai.google.dev/gemini-api/docs/speech-generation

## Channel Preset

The first preset is `tiny_mechanisms`.

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

## Prompt Pipeline

The existing prompt management design remains the base architecture. This spec adds the channel-specific prompt contract.

### 1. Channel Bible

`channel_bible` is stable prompt content shared across all generation steps.

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

Script generation uses Structured Outputs.

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

### 5. Image Prompt Compilation

The editable scene image prompt is a seed, not the final provider prompt.

Each image prompt compiler should combine:

- channel visual identity
- episode topic
- scene role
- narration
- caption
- scene visual brief
- 9:16 vertical framing

Provider-ready image prompt shape:

```text
Create a vertical 9:16 editorial documentary image for a short-form science explainer. The scene shows [specific subject and action], with [background/context]. Use [camera/lens/composition], [lighting], and [texture/style]. The image should feel like [channel visual identity]. Do not include text, captions, watermarks, logos, UI, public figures, or misleading depictions of real events.
```

For abstract concepts, use concrete visual metaphors:

- sound through skull bone as subtle vibration lines through a translucent profile silhouette
- QR code error correction as torn paper squares still forming a readable pattern
- cold battery chemistry as a macro battery cross-section in frosted air

### 6. TTS Prompt Compilation

TTS should sound like a high-retention educational narrator, not a generic AI voice.

TTS prompt sections:

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

The transcript is the source of spoken words. Director notes must never be mixed into the transcript.

### 7. Metadata Draft

Even though upload automation is out of scope, generation should produce metadata drafts for later manual upload.

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

## Structured Output Contract

The script plan output should include:

- `channelPresetId`
- `episode`
  - `seedId`
  - `workingTitle`
  - `centralQuestion`
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
  - `needsHumanReview`
- `scenes`
  - `position`
  - `role`
  - `durationSeconds`
  - `narration`
  - `caption`
  - `visualBrief`
  - `imagePromptSeed`
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
- empty visual briefs
- claims in disallowed categories
- long subscribe CTAs
- repeated caption text across scenes
- provider prompt text that asks for embedded typography

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

## UI Impact

The first frontend flow must hide custom topic/title entry for this preset.

Instead, project creation can use a single command:

- `Create Tiny Mechanisms episode`

The project title shown in the UI comes from the generated episode `workingTitle`.

For this stage, `Tiny Mechanisms` is the final preset name. The channel can be renamed in a later design without changing this prompt contract.

Scene editing remains available:

- narration
- caption
- image prompt seed
- SSML or spoken transcript when exposed

This keeps the app reviewable while reducing the first-run decision burden.

## Data And Storage Impact

No schema change is required.

The preset id and compiled prompt payload can be stored in existing `prompt_versions.prompt_payload`.

`metadataDraft` is stored in the script generation response and prompt payload. It is not shown in the UI during this stage.

Generated assets remain under `LOCAL_ASSET_ROOT`.

If the implementation needs a seed bank, it should live in application code under the prompt registry rather than in a new database table for this stage.

## Safety And Policy Notes

The preset should avoid realistic synthetic depictions of real events, disasters, public figures, or sensitive domains.

If an episode requires realistic generated scenes that could be mistaken for real footage, `metadataDraft.disclosureHint` should say disclosure may be required during manual upload.

The channel should not imply that AI-generated visuals are real footage. Metadata can describe the format as an illustrated explainer when useful.

## Validation

No automated tests are required for this design stage.

Implementation validation should use:

- TypeScript typecheck for touched packages.
- Manual review of 3 compiled script prompt payloads.
- Manual review of 3 compiled image prompts.
- Manual review of 1 generated TTS prompt.
- Manual check that output stays within the allowed topic boundary.
- Manual check that the generated project can still be edited before asset generation.

## Implementation Planning Notes

The implementation plan should decide exact file placement and function names, but the product behavior in this spec is fixed:

- Use the `Tiny Mechanisms` preset.
- Auto-select the next unused seed.
- Keep custom topic and title UI hidden for this stage.
- Store metadata drafts without displaying them in the UI.
