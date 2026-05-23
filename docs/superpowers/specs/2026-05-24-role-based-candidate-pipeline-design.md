# Role-Based Candidate Pipeline Design

## Summary

Tiny Mechanisms should move from a single episode research call to a role-based candidate pipeline. New pending projects should generate five specialized episode candidates in parallel, judge those candidates in a separate selection step, then generate the final 30-second script from the refined winning brief.

This design intentionally removes recent analytics from the generation prompt for now. The current channel data mostly represents plateau videos around 1,000-1,200 views. Feeding those examples into generation risks teaching the model to imitate patterns that have not yet proven they can break out. Analytics should remain useful as offline evaluation after new batches publish, not as prompt context in this generation path.

## Goals

- Increase candidate diversity with five role-specific prompts instead of one prompt producing five similar candidates.
- Keep a shared base prompt for channel rules, safety, output schema, and first-frame principles.
- Separate candidate creation from candidate judgment.
- Fail `generate_script` early with detailed UI-visible reasons when candidate generation or judgment is not good enough.
- Strengthen image prompts through structured visual fields without adding a database migration.
- Keep the pipeline local-running, single-user, and English-only.
- Keep legacy static seed projects working.
- Keep karaoke subtitle timing safe by not asking the model for timestamps, beat timings, or word-level timing.

## Non-Goals

- No recent analytics context in generation prompts.
- No analytics digest stage.
- No Memory/RAG system.
- No QA, vision verification, or image-result validation calls.
- No separate image-prompt polish call.
- No separate title or metadata variants call.
- No live web/community research during generation.
- No database migration in this change.
- No changes to the Remotion subtitle timing engine.

## Research Rationale

This design follows prompt decomposition rather than repeated sampling of the same prompt.

- OpenAI prompting guidance favors clear task/context/output boundaries and breaking complex work into smaller steps.
- Decomposed Prompting supports modular prompts where each subtask can be optimized for one job.
- Self-consistency and Tree of Thoughts support generating multiple paths and evaluating them, but the useful part is not randomness alone; it is generation plus a separate selection/evaluation step.
- YouTube Shorts guidance and creator-facing discussion consistently point to the first frame and first seconds as high-leverage feed behavior, so candidate roles should explicitly target first-frame clarity, object familiarity, visual mechanism, retention path, and loop payoff.
- OpenAI image prompting guidance favors concrete subject/action/framing/constraints. For this product, image prompts should be structured as first-frame hook instructions, not generic scene illustrations.

References:

- OpenAI prompting fundamentals: `https://openai.com/academy/prompting/`
- OpenAI evaluation best practices: `https://platform.openai.com/docs/guides/evaluation-best-practices`
- OpenAI prompt optimizer: `https://platform.openai.com/docs/guides/prompt-optimizer/`
- Decomposed Prompting: `https://arxiv.org/abs/2210.02406`
- Self-Consistency: `https://arxiv.org/abs/2203.11171`
- Tree of Thoughts: `https://arxiv.org/abs/2305.10601`
- YouTube Shorts deep dive: `https://blog.youtube/creator-and-artist-stories/youtube-shorts-deep-dive/`
- YouTube Shorts help: `https://support.google.com/youtube/answer/10059070`
- OpenAI image generation: `https://openai.com/academy/image-generation/`

## Current State

The current merged flow is:

```text
tiny_mechanisms:pending project
-> load recent analytics context
-> generateEpisodeResearch() creates 5 candidates, self-scores, and selects one
-> generateScript() writes scenes from the selected candidate
-> save script prompt version and replace scenes
```

That solved static seed exhaustion for new projects, but it still combines candidate generation, scoring, and selection in one model call. It also sends recent analytics into generation even though the available data mostly describes plateau videos.

## Selected Approach

Replace the single episode research call with:

```text
tiny_mechanisms:pending project
-> 5 role-based candidate calls in parallel
-> CandidateJudgeAgent call
-> generateScript() from refined production brief
-> save scenes and prompt history
```

Text/planning calls per new project:

```text
candidate role calls x5
judge/select/refine x1
script generation x1
= 7 text/planning calls
```

The five candidate calls can run in parallel. If any role call fails at provider/schema level, the job fails terminally for this job attempt. There is no role retry, no whole-batch retry, and no fallback to the old single-call research prompt.

## Candidate Generation

Candidate generation uses a shared base prompt plus one role prompt.

Shared base prompt responsibilities:

- Tiny Mechanisms channel identity.
- English-only output.
- Safety rules.
- Output schema.
- 30-second Shorts constraints.
- First-frame hook principles.
- No calm object portrait.
- No clean diagram as hook.
- No generic macro shot.
- No timestamp, beat timing, word-level timing, or karaoke timing.
- No recent analytics context.

Each role returns exactly one candidate using the same schema.

### Role 1: Feed Stop Strategist

Focus:

- First frame.
- First 0.5 seconds.
- First narration line.
- Swipe resistance.

This role should produce the candidate most likely to stop a silent mobile viewer in the feed.

### Role 2: Broad Object Selector

Focus:

- A familiar everyday object.
- Immediate object recognition.
- Broad audience comprehension.

This role should reduce niche mechanisms that are mechanically interesting but too obscure for a general Shorts audience.

### Role 3: Visual Mechanism Director

Focus:

- Visible motion.
- Tension, snap, lock, slide, release, catch, pull, bend, or failure.
- Physical cause and effect.

This role should produce a candidate whose mechanism can be understood visually, not only through narration.

### Role 4: Retention Architect

Focus:

- Reveal path every 3-5 seconds.
- Curiosity progression.
- Mid-video visual reasons to keep watching.

This role should avoid candidates with a strong hook but flat middle.

### Role 5: Loop Payoff Editor

Focus:

- Ending payoff.
- Replay logic.
- Title curiosity gap.
- A final beat that makes the opening frame more satisfying in retrospect.

This role should produce candidates with a clear loop-back ending.

## Candidate Schema

The current candidate fields remain useful, but the next version should add the role source explicitly.

```ts
type CandidateRole =
  | "feed_stop_strategist"
  | "broad_object_selector"
  | "visual_mechanism_director"
  | "retention_architect"
  | "loop_payoff_editor";

type RoleEpisodeCandidate = {
  candidateId: string;
  roleSource: CandidateRole;
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
  whyThisCanBreakPattern: string;
  scores: {
    firstFrameClarity: number;
    swipeResistance: number;
    broadObjectFamiliarity: number;
    visualNovelty: number;
    retentionPath: number;
    loopPayoffStrength: number;
    genericRisk: number;
  };
};
```

The model should self-score each role candidate, but those scores are advisory only. CandidateJudgeAgent owns the final selection decision.

## CandidateJudgeAgent

CandidateJudgeAgent is a model call plus worker control logic. It is not a new background service.

Inputs:

- Five role candidates.
- Target duration.
- Tiny Mechanisms channel/base principles.

It does not receive recent analytics context and does not retrieve Memory/RAG content.

Responsibilities:

- Validate all five candidates are present and role-tagged.
- Score candidates with the judge rubric.
- Select one winner.
- Refine the winner into a production brief for script generation.
- Fail with structured detail if no candidate clears threshold.

Judge rubric:

- `firstFrameClarity`
- `swipeResistance`
- `broadObjectFamiliarity`
- `visualNovelty`
- `retentionPath`
- `loopPayoffStrength`
- `genericRisk`

Threshold:

- At least one candidate must have a core average score of at least `4`.
- Core average is based on first-frame clarity, swipe resistance, broad object familiarity, visual novelty, retention path, and loop payoff strength.
- Generic risk must not be high. In numeric terms, the selected candidate should have `genericRisk <= 2` on a 1-5 scale where 5 is highest risk.

If the threshold is not met, the job fails terminally. There is no role retry, whole-batch retry, or automatic fallback in this design.

## Judge Output

```ts
type CandidateJudgeResult =
  | {
      status: "selected";
      selectedCandidateId: string;
      selectedRoleSource: CandidateRole;
      scoreTable: CandidateJudgeScore[];
      selectionRationale: string;
      refinedBrief: RefinedEpisodeBrief;
    }
  | {
      status: "rejected";
      scoreTable: CandidateJudgeScore[];
      failureReason: string;
      thresholdSummary: string;
    };

type CandidateJudgeScore = {
  candidateId: string;
  roleSource: CandidateRole;
  firstFrameClarity: number;
  swipeResistance: number;
  broadObjectFamiliarity: number;
  visualNovelty: number;
  retentionPath: number;
  loopPayoffStrength: number;
  genericRisk: number;
  coreAverage: number;
  notes: string;
};

type RefinedEpisodeBrief = {
  candidateId: string;
  roleSource: CandidateRole;
  objectOrMechanism: string;
  centralQuestion: string;
  firstFrame: string;
  firstLine: string;
  firstThreeWords: string;
  viewerQuestion: string;
  retentionPromise: string;
  mechanismProof: string;
  visualReveal: string;
  loopPayoff: string;
  titleCuriosityGap: string;
  avoidAngles: string[];
};
```

## Script Generation

`generateScript()` should consume the refined production brief. It must not invent a new topic.

Rules:

- Default Tiny Mechanisms script duration remains 30 seconds.
- Existing scene role order by duration remains authoritative.
- Hook narration must be no more than 8 words.
- Hook caption must be no more than 4 words.
- Captions are punch text, not transcript text.
- The model must not output timestamps, beat timings, word-level timings, or karaoke timing.
- Metadata remains part of the script output for now.

Legacy static seed generation should still work. Static seed projects can bypass role-based candidate generation and use the existing seed-to-script path.

## Structured Visual Fields

The script output should include structured visual fields per scene so image prompts become first-frame hook instructions instead of generic scene illustrations.

Fields:

```ts
type SceneVisualPlan = {
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
```

The database should not change. `SceneVisualPlan` should live in the script response and prompt history. Before saving scenes, the AI package should compile the visual plan into the existing `scene.imagePrompt` string.

The saved `imagePrompt` should include:

- Familiar object.
- Visible action already happening.
- Visible consequence.
- One clear visual question.
- Motion or tension cue.
- Camera framing.
- Caption-safe lower area.
- Avoided visuals.

Hook-scene image prompt rules:

- Consequence-first.
- Action already happening.
- Recognizable object.
- One clear visual question.
- No calm object portrait.
- No clean diagram as the first frame.
- No text, labels, logos, UI, or watermarks.

Context, point, payoff, and CTA scene prompts can still use cutaway, macro, before/after, and loop-back imagery when appropriate.

## Worker Flow

For pending Tiny Mechanisms projects:

```text
get project
-> generate role candidates in parallel
-> if any role call provider/schema fails, mark job terminally failed
-> judge candidates
-> if judge rejects, mark job terminally failed
-> generate script from refined brief
-> insert prompt version
-> replace scenes
-> update project title/topic
-> set project ready
-> mark job succeeded
```

OpenAI calls should remain outside database write transactions. The write transaction should contain only prompt version insert, scene replacement, project update, status update, and optional job success marking.

## Failure Handling

There are two new expected failure categories.

### Candidate Role Failure

If any role candidate call fails due to provider error, missing output, or schema invalid output, fail the job terminally and do not use the existing capped auto-retry behavior for this error class.

Structured failure payload:

```ts
type CandidateRoleFailure = {
  stage: "candidate_generation";
  failedRole: CandidateRole;
  reason: string;
};
```

### Candidate Judge Rejection

If judge rejects all candidates, fail the job immediately.

Structured failure payload:

```ts
type CandidateJudgeFailure = {
  stage: "candidate_judge";
  reason: string;
  thresholdSummary: string;
  scoreTable: CandidateJudgeScore[];
};
```

Candidate judge rejection is a terminal quality failure. It should not be retried automatically by the worker loop.

These details must be stored through existing project job data. `errorMessage` should remain short, while `jobs.output` carries the detailed role/score data. This design should not add a migration.

Implementation should add a narrow failure helper or error type, for example:

```ts
type TerminalWorkflowFailure = {
  errorMessage: string;
  output: CandidateRoleFailure | CandidateJudgeFailure;
};
```

The worker loop or handler should recognize this failure and mark the job `failed` immediately with `finished_at` set and `output` populated. Existing capped auto-retry behavior can remain for provider/network errors outside this explicit terminal failure path.

## UI Failure Display

`ProjectWorkflow` should show the latest failed `generate_script` or `run_project_flow` job under the Generate script / Run full flow controls.

Display:

- Failed stage.
- Failed role when available.
- Reason.
- Threshold summary when available.
- Score table when judge rejects candidates.
- A concise suggestion such as `Try generating again.`

The UI should be detailed enough for the local single user to debug prompt quality without opening the database. It should not expose raw provider payloads or full prompt text in the main workflow UI.

The UI should read the structured details from `job.output` and fall back to `job.errorMessage` when no structured output is available.

## Prompt History

Use the existing `prompt_versions` table. Do not add a migration.

For the script prompt version:

- `responseText` should continue to store the final script response so existing metadata/style extraction keeps working.
- `promptPayload` should include:
  - role candidate prompt payloads,
  - role candidate outputs,
  - judge prompt payload,
  - judge output,
  - selected refined brief,
  - final script prompt payload,
  - model metadata for each call.

This makes the full selection path inspectable without changing the schema.

## Data Flow Boundaries

- `packages/ai` owns prompt schemas, role prompts, judge prompt, script prompt, visual-plan compilation, and OpenAI calls.
- `apps/worker` owns orchestration, parallel candidate calls, failure handling, and DB writes.
- `packages/db` remains the DB boundary but should not need schema changes.
- `apps/web` displays detailed job failure information from existing API responses.
- `apps/api` exposes existing job/project data; any response shaping should stay narrow.

## Validation Strategy

Per current project instruction, this design does not require adding automated tests or running test suites by default while the MVP local flow is still being built.

Implementation verification should use manual/static checks:

- Confirm worker no longer sends recent analytics into candidate generation.
- Confirm five role prompts are called for pending projects.
- Confirm role call failure marks the job failed with a UI-visible role.
- Confirm judge rejection marks the job failed with a score table.
- Confirm accepted judge output generates a script from the refined brief.
- Confirm static seed projects still generate through the legacy path.
- Confirm prompt history contains role outputs, judge output, selected brief, and script prompt payload.
- Confirm hook image prompts include consequence/action/viewer-question language.
- Confirm no prompt requests karaoke, timestamp, beat, or word-level timing.

## Rollout

Implement behind the existing Tiny Mechanisms pending project flow. No feature flag is required for the single-user local MVP, but the old static seed path must remain for legacy topics.

If the role-based path proves too costly or unstable, the code should be easy to simplify back to one candidate generation call because the judge and script stages consume a normalized refined brief.
