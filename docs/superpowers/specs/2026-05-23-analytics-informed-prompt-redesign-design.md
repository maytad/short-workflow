# Analytics-Informed Prompt Redesign Design

## Summary

Short Workflow should replace the exhausted static Tiny Mechanisms seed selection for new projects with an analytics-informed prompt pipeline. New Tiny Mechanisms projects should be created with one backend-owned default strategy, generate several episode candidates from recent performance context, score those candidates for Shorts feed behavior, select one episode brief, then generate a short hook-first script and image prompt plan.

The first implementation should also simplify the project creation UI. The user should not choose a generation method or duration from the frontend. The backend owns the Tiny Mechanisms default.

## Goals

- Remove the new-project dependency on `TINY_MECHANISMS_ACTIVE_SEEDS`.
- Prevent `tiny_mechanisms_seed_bank_exhausted` for new Tiny Mechanisms projects.
- Keep legacy/static seed regeneration working for existing projects.
- Generate Tiny Mechanisms episode candidates with `gpt-5.5` before writing the script.
- Use recent YouTube analytics and creative context as prompt input.
- Optimize for Shorts feed testing signals: stayed-to-watch, engaged views, average view duration, average percentage viewed, first-frame clarity, and swipe resistance.
- Default new Tiny Mechanisms projects to 30 seconds from the backend.
- Simplify the create-project UI to one action.
- Preserve karaoke subtitle timing correctness by keeping narration, captions, audio, and render timing responsibilities separate.
- Store enough prompt history to diagnose why an episode was selected.

## Non-Goals

- No live web trend scraping inside the generation flow.
- No YouTube search automation or competitor crawling.
- No automatic publishing decision changes.
- No automatic re-rendering or prompt mutation from analytics diagnosis.
- No background music.
- No standalone `.srt` or `.vtt` export in this change.
- No Supabase Auth, RLS, cloud queueing, cloud storage, or cloud rendering.
- No requirement to add a new database table in the first implementation.

## Current Problems

New Tiny Mechanisms projects currently start as `tiny_mechanisms:pending`. During `generate_script`, the worker reserves the next unused active seed from the static in-code seed bank. Once every active seed has appeared in another project topic, `pickNextTinyMechanismsSeed()` throws `tiny_mechanisms_seed_bank_exhausted`.

This is a product bottleneck, not an OpenAI provider failure. The OpenAI script call is never reached.

Analytics also show a creative bottleneck. Recent Shorts often stall around 800-1,200 views, with some available average viewed percentages around 40-50%. That pattern points to a first-feed-test issue: the video may be clear enough to get a small push, but not strong enough on first-frame choice, stayed-to-watch, retention, or engagement to expand further.

## Research Notes

YouTube's official help docs define Shorts metrics that matter for diagnosis:

- `Engaged views`: viewers who stayed past the initial seconds.
- `Stayed to watch`: percentage of viewers who viewed the Short versus swiped away.
- `Average view duration`: average time watched among engaged views.
- `Average percentage viewed`: percentage watched among engaged views.

YouTube's Shorts discovery guidance also emphasizes viewer choice at recommendation time, whether viewers stick around, average view duration, average percentage viewed, and enjoyment signals such as likes/dislikes and surveys.

Community research from creator discussion threads is anecdotal, not authoritative, but it is directionally consistent with the project's analytics:

- The 800-1,200 view plateau is commonly interpreted as a first test batch that does not expand.
- Creators repeatedly point to the first frame and first 1-2 seconds as the biggest lever.
- Hook mismatch can be more damaging than the topic itself.
- Faceless content prompt discussions favor a staged workflow: idea, hook variants, script, title/metadata, rather than one large script prompt.

References:

- YouTube content performance metrics: `https://support.google.com/youtube/answer/12220281`
- YouTube Shorts search and discovery tips: `https://support.google.com/youtube/answer/11914225`
- YouTube Shorts analytics tips: `https://support.google.com/youtube/answer/12942217`
- Reddit/NewTubers 1k plateau discussion: `https://www.reddit.com/r/NewTubers/comments/1ritva5/my_shorts_keep_getting_stuck_at_around_1k_views/`
- Reddit/NewTubers hook critique: `https://www.reddit.com/r/NewTubers/comments/1rs6m3l/review_my_shorts_hooks_retention_stuck_at_30/`

## Selected Approach

Use an analytics-informed episode research stage before script generation.

```text
Tiny Mechanisms create request
-> backend default project settings
-> generate_script job
-> load recent analytics and creative context
-> generate 5 episode candidates
-> score and select one candidate
-> generate 30-second script from selected brief
-> store prompt history
-> replace scenes
```

This keeps a curated channel format while avoiding a finite seed bank. It also makes the script prompt more performance-aware without automating publishing decisions or relying on live external research.

## Alternatives Considered

### A. Add More Static Seeds

Pros:

- Smallest code change.
- Keeps deterministic topic selection.

Cons:

- The seed bank can be exhausted again.
- It does not address the 800-1,200 view plateau.
- Manual curation remains the main bottleneck.

### B. Remove Seeds And Generate Script Directly

Pros:

- Simple flow.
- No seed exhaustion.

Cons:

- Script quality becomes less stable.
- The model may choose broad or repeated topics.
- There is no explicit feed hypothesis or candidate comparison.

### C. Analytics-Informed Candidate Pipeline

Pros:

- Avoids finite active seed exhaustion.
- Uses recent channel evidence.
- Keeps an explicit episode brief between topic selection and script writing.
- Produces traceable candidate reasoning.
- Lets the app optimize first-frame and hook behavior before full script generation.

Cons:

- Adds an extra OpenAI call.
- Requires new schemas and prompt tests.
- Generation is less deterministic than static seeds.

This is the selected approach.

## Project Creation UX

The home page project creation panel should become a single-action Tiny Mechanisms launcher.

Remove from the create form:

- Duration segmented control.
- Any generation method choice.
- Any custom title or topic inputs for the Tiny Mechanisms flow.

Keep:

- Tiny Mechanisms preset label.
- Short explanation of what the action creates.
- Loading, disabled, and error states.
- A single button that creates the project.

The frontend should call `POST /projects/tiny-mechanisms` with an empty body. The backend should apply the Tiny Mechanisms defaults.

## Backend Defaults

Tiny Mechanisms project creation should default to:

- `title`: `Tiny Mechanisms Episode`
- `topic`: `tiny_mechanisms:pending`
- `targetDurationSeconds`: 30
- `language`: English
- `format`: vertical 9:16

The generic project endpoint can keep its existing duration behavior. The Tiny Mechanisms endpoint should not rely on frontend duration selection.

## Topic Identity

Existing static and legacy projects remain valid:

```text
tiny_mechanisms:<known-seed-id>
```

New AI-selected projects should use a generated topic identity after candidate selection:

```text
tiny_mechanisms:ai:<slug>
```

The slug should be stable enough for display and debugging, but the full selected brief should live in prompt history, not only in the topic string.

## Prompt Pipeline

### Stage 1: Analytics Context

Before generating candidates, load recent public Shorts and any linked local creative context available through the analytics tables.

Use a compact context object:

```ts
type RecentVideoPromptContext = {
  youtubeVideoId: string;
  title: string;
  views: number | null;
  engagedViews: number | null;
  averageViewPercentage: number | null;
  averageViewDurationSeconds: number | null;
  viewsPerHour: number | null;
  likeRate: number | null;
  hookNarration: string | null;
  hookCaption: string | null;
  hookImagePrompt: string | null;
};
```

The prompt should treat low performers as negative examples and winners as abstract pattern references. It must not copy old topics, hook wording, or first-frame compositions.

If analytics data is unavailable, the pipeline should still generate candidates from the channel bible and recent project titles/topics.

### Stage 2: Episode Candidate Research

The episode research prompt should not write the final script. It should generate exactly five candidates and score them.

Candidate shape:

```ts
type EpisodeCandidate = {
  candidateId: string;
  objectOrMechanism: string;
  centralQuestion: string;
  firstFrame: string;
  firstLine: string;
  firstThreeWords: string;
  feedHypothesis: string;
  swipeRisk: "low" | "medium" | "high";
  broadAudienceReason: string;
  retentionPromise: string;
  titleCuriosityGap: string;
  mechanismProof: string;
  visualReveal: string;
  loopPayoff: string;
  whyThisCanBeatRecentVideos: string;
  scores: {
    feedClarity: number;
    swipeResistance: number;
    broadAppeal: number;
    visualNovelty: number;
    retentionPath: number;
    repeatRisk: number;
  };
};
```

Scoring rules:

- Score each dimension from 1 to 5.
- `repeatRisk` is inverse: 1 is low repeat risk, 5 is high repeat risk.
- Select the candidate with the strongest balance of feed clarity, swipe resistance, broad appeal, visual novelty, and retention path.
- Reject candidates that require medical, legal, finance, politics, dangerous instructions, public figures, or crime content.
- Reject candidates whose first frame is a calm object portrait.
- Reject candidates that cannot show a physical part moving, locking, sliding, catching, bending, releasing, cutting, spraying, or changing state.

### Stage 3: Script Generation

Generate the script only from the selected candidate.

Default 30-second scene structure:

```text
hook: 0-2.5s
context: 2.5-7s
proof: 7-17s
payoff: 17-25s
loop: 25-30s
```

Map this to existing scene roles without adding a new role enum:

- `hook`
- `context`
- `point`
- `payoff`
- `cta`

For this preset, `cta` remains a loop-ending slot, not a long subscribe call-to-action.

Script rules:

- No intro.
- No setup before the interesting action.
- Start mid-action.
- First narration line max 8 words.
- First caption max 4 words.
- Keep total spoken narration appropriate for 30 seconds.
- Avoid repeating the sentence pattern `That X is not Y` unless it is clearly the strongest hook.
- Add a new visual reason to keep watching every 3-5 seconds.
- Explain one mechanism only.
- Use tactile verbs: locks, releases, snaps, bends, slides, catches, pulls, pushes, cuts, sprays.
- End by reframing the first image so the video feels loopable.

### Stage 4: Title And Metadata

Generate multiple title variants, then select one.

Title rules:

- Prefer familiar object plus surprising behavior.
- Avoid titles that only name the mechanism.
- Avoid abstract titles.
- Keep under YouTube's title length limit.
- Match the promise made by the first frame and first line.

Metadata remains English and should not make unsupported claims.

## Image Prompt Changes

The hook image prompt is treated as the first-frame product.

Hook frame rules:

- Must work with sound off.
- Must be readable on a phone in under 0.5 seconds.
- Must show action, tension, resistance, consequence, or release already happening.
- Must not be a calm object portrait.
- Must not be a clean diagram as the first frame.
- Must not default to a workbench, repair bench, or generic tabletop unless native to the object.
- Must use one dominant subject and keep caption-safe space.

Point scenes can use cutaways, transparent layers, macro views, or force-path visuals after the hook has established a recognizable object and action.

## Karaoke Subtitle Safety

Karaoke subtitle sync must not depend on model-generated caption timing.

Rules:

- Narration is the source of truth for spoken audio.
- Captions are punch captions, not transcripts.
- Captions should remain short enough for stable on-screen display.
- The model must not output word-level timing.
- Word-level or karaoke timing must be derived from the final audio/transcript alignment pipeline, not from the caption field.
- After audio generation, timing assets must reference the final narration/audio that will be rendered.
- If narration changes after audio generation, audio and caption timing assets are stale and must be regenerated.
- Remotion render input must use persisted timing assets when available.
- If timing assets are missing or invalid, the renderer should fall back to scene-level caption display instead of fake karaoke timing.
- Remotion animations for subtitles must be frame-based through `useCurrentFrame`, `Sequence`, and fps. CSS transitions or Tailwind animation classes must not control subtitle timing.

The prompt should explicitly separate:

- `narration`: spoken text for TTS.
- `caption`: short visual punch text.
- `ttsDirection`: delivery guidance.
- `visualBrief`: image comprehension target.

## Prompt History

The first implementation should avoid a database migration unless a new prompt purpose is clearly needed.

Store the episode research prompt, candidate output, selected candidate, scoring rationale, analytics context, and final script prompt in the existing script prompt history payload:

```text
prompt_versions.purpose = "script"
prompt_payload.episodeResearch = ...
prompt_payload.selectedCandidate = ...
prompt_payload.scriptPrompt = ...
response_text = final parsed script plan JSON
response_metadata = model ids, response ids, template versions, selected candidate id
```

Future work may add a dedicated `episode_brief` prompt purpose if separate revision history becomes valuable.

## Error Handling

New errors:

- `episode_research_response_invalid`: episode research output fails schema validation.
- `episode_candidate_selection_failed`: no candidate passes quality gates.
- `analytics_context_unavailable`: only for unexpected analytics query failures, not for normal empty analytics.

Existing behavior:

- Explicit old seed IDs still resolve through `getTinyMechanismsSeed(seedId)`.
- Unknown explicit seed IDs still fail with `tiny_mechanisms_seed_not_found`.
- `tiny_mechanisms_seed_bank_exhausted` should no longer occur for new `tiny_mechanisms:pending` projects.

Retry behavior:

- Provider/network failures can retry through the existing job retry system.
- Deterministic schema failures should produce clear errors and should not be retried forever without changing prompt/input.

## File-Level Design

Expected package changes:

- `packages/ai`: add episode research prompt, schemas, parser, and script prompt integration.
- `apps/worker`: update `generate_script` flow to use AI episode research for pending projects.
- `packages/db`: reuse prompt version storage; no initial migration required.
- `apps/api`: default Tiny Mechanisms creation to backend-owned settings.
- `packages/shared`: adjust Tiny Mechanisms create request schema if the frontend no longer sends duration.
- `apps/web`: simplify `ProjectCreateForm` to one action.
- `apps/render`: preserve frame-based subtitle behavior and validate timing fallbacks if touched.

## Validation

Use the lightest checks needed for the MVP stage:

- Create a Tiny Mechanisms project from the UI with no options.
- Verify the API accepts an empty Tiny Mechanisms create body.
- Run one `generate_script` job and confirm it does not hit seed exhaustion.
- Inspect `prompt_versions.prompt_payload` for analytics context, five candidates, selected candidate, scoring rationale, and final script prompt.
- Confirm generated script defaults to a 30-second scene plan.
- Confirm hook caption is short and not a transcript line.
- Confirm no word-level karaoke timing is generated by the model.
- Render a small fixture or existing short input when subtitle/render code changes, and visually check captions do not drift past audio.

## Rollout

This should be implemented as a narrow prompt-flow change before any broader analytics automation:

1. Backend default and UI simplification.
2. Episode candidate research prompt and schema.
3. Worker integration for pending Tiny Mechanisms projects.
4. Script prompt adjustments for 30-second hook-first structure.
5. Image prompt hook-frame tightening.
6. Manual verification using a new project.

## Open Questions

- Whether to expose duration selection later as an advanced setting after the 30-second flow performs better.
- Whether to add a dedicated `episode_brief` prompt purpose after the first implementation proves useful.
- Whether to import Studio CSV data later for stayed-to-watch and shown-in-feed values that are not always available through the public API.
