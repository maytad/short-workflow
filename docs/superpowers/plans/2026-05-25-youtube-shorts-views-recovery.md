# YouTube Shorts Views Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the Tiny Mechanisms prompt and topic pipeline so new Shorts optimize for `Stayed to watch (%)`, first-frame swipe resistance, and visible mechanical hooks.

**Architecture:** Keep the change inside `packages/ai` prompt code. Add one shared Shorts recovery policy module, wire it into candidate research, candidate judging, script planning, image prompting, and the channel bible, then verify through prompt-compilation tests. Do not touch UI, DB schema, rendering, YouTube upload, or CSV import in this plan.

**Tech Stack:** Bun, TypeScript, `bun:test`, existing `PromptTemplate` prompt modules in `packages/ai`.

---

## Scope Check

This plan implements the approved spec in `docs/superpowers/specs/2026-05-25-youtube-shorts-views-recovery-design.md`.

It covers:

- first-frame and first-line prompt changes
- topic direction away from non-mechanism/perception drift
- `Stayed to watch (%)` as the quality gate
- 12-video experiment framing in prompt guidance
- prompt tests and type/lint verification

It intentionally does not cover:

- UI work
- YouTube Studio scraping
- CSV/manual import
- dashboard redesign
- schema migration

## File Structure

- Create `packages/ai/src/prompts/shortsRecovery.ts`
  - Owns reusable Shorts recovery policy text, metric gates, prioritized object list, paused topic list, and experiment batch rules.
- Create `packages/ai/src/prompts/shortsRecovery.test.ts`
  - Owns prompt-compilation tests for the recovery policy across research, judge, script, and image prompts.
- Modify `packages/ai/src/prompts/presets/tinyMechanisms.ts`
  - Adds recovery channel-bible lines and removes channel-level drift toward broad non-mechanical causes.
- Modify `packages/ai/src/prompts/episodeResearch.ts`
  - Uses the recovery policy while generating candidate topics.
- Modify `packages/ai/src/prompts/episodeJudge.ts`
  - Uses the recovery policy while selecting candidates.
- Modify `packages/ai/src/prompts/scriptPlan.ts`
  - Uses the recovery policy while writing the production script and scene visual plans.
- Modify `packages/ai/src/prompts/imagePrompt.ts`
  - Uses the recovery policy while creating first-frame image prompt instructions.
- Modify `packages/ai/src/prompts/mechanicalEpisodeBank.test.ts`
  - Updates existing version assertions and prompt-content assertions after prompt version bumps.

Before execution, inspect `git status --short`. The current workspace may contain unrelated dirty files from the analytics measurement fix. Do not stage or revert unrelated files.

---

### Task 1: Add Failing Prompt Policy Tests

**Files:**
- Create: `packages/ai/src/prompts/shortsRecovery.test.ts`

- [ ] **Step 1: Create the failing test file**

Add this file:

```ts
import { describe, expect, test } from "bun:test";

import { imagePromptTemplate } from "./imagePrompt";
import { candidateJudgePrompt } from "./episodeJudge";
import { episodeResearchPrompt } from "./episodeResearch";
import { scriptPlanPrompt } from "./scriptPlan";
import { TINY_MECHANISMS_PRESET_ID } from "./presets/tinyMechanisms";

function developerMessage(
  compiled: { messages: Array<{ role: string; content: string }> },
) {
  return compiled.messages.find((message) => message.role === "developer")?.content ?? "";
}

describe("shorts recovery prompt policy", () => {
  test("episode research prioritizes visible mechanical swipe resistance", () => {
    const compiled = episodeResearchPrompt.compile({
      channelPresetId: TINY_MECHANISMS_PRESET_ID,
      targetDurationSeconds: 30,
      role: "feed_stop_strategist",
    });
    const text = developerMessage(compiled);

    expect(compiled.templateVersion).toBe(3);
    expect(text).toContain("Stayed to watch");
    expect(text).toContain("first 0.5 seconds");
    expect(text).toContain("latch, ratchet, zipper, nail clipper");
    expect(text).toContain("pause perception, biology, voice, onions");
    expect(text).not.toContain("Do not default to latches");
    expect(text).not.toContain("A moving part is helpful but not required");
  });

  test("candidate judge selects for recovery gates instead of novelty drift", () => {
    const candidate = {
      candidateId: "candidate-1",
      roleSource: "feed_stop_strategist" as const,
      objectOrMechanism: "zipper teeth locking under sideways pull",
      centralQuestion: "Why does a zipper resist sideways pulling?",
      firstFrame: "A jacket zipper is pulled sideways but the teeth stay locked.",
      firstLine: "It should split open.",
      firstThreeWords: "It should split",
      feedHypothesis: "A visible sideways pull creates immediate tension.",
      swipeRisk: "low" as const,
      broadAudienceReason: "Everyone recognizes a zipper under tension.",
      retentionPromise: "The slider turns loose teeth into a locked rail.",
      titleCuriosityGap: "Why a Zipper Locks Under Tension",
      mechanismProof: "The slider wedges teeth into one interlocked track.",
      visualReveal: "Macro cutaway of zipper teeth meshing under force.",
      loopPayoff: "The pull makes the lock tighter.",
      whyThisCanBreakPattern: "It opens on visible tension rather than a clean diagram.",
      scores: {
        firstFrameClarity: 5,
        swipeResistance: 5,
        broadObjectFamiliarity: 5,
        visualNovelty: 4,
        retentionPath: 5,
        loopPayoffStrength: 4,
        genericRisk: 1,
      },
    };
    const compiled = candidateJudgePrompt.compile({
      channelPresetId: TINY_MECHANISMS_PRESET_ID,
      targetDurationSeconds: 30,
      candidates: [candidate, candidate, candidate, candidate, candidate],
    });
    const text = developerMessage(compiled);

    expect(compiled.templateVersion).toBe(2);
    expect(text).toContain("Stayed to watch");
    expect(text).toContain("60%+");
    expect(text).toContain("visible moving or tension state");
    expect(text).toContain("penalize perception, biology, voice, onions");
    expect(text).not.toContain("Do not penalize non-mechanical causes");
  });

  test("script plan prompts the first scene for a short swipe-resistant hook", () => {
    const compiled = scriptPlanPrompt.compile({
      channelPresetId: TINY_MECHANISMS_PRESET_ID,
      seedId: "zipper_locking",
      targetDurationSeconds: 30,
    });
    const text = developerMessage(compiled);

    expect(compiled.templateVersion).toBe(13);
    expect(text).toContain("Stayed to watch");
    expect(text).toContain("first 1-3 seconds");
    expect(text).toContain("first caption must be no more than 4 words");
    expect(text).toContain("no clean product shot");
    expect(text).toContain("no diagram or cutaway as the opening image");
    expect(text).toContain("reveal the hidden mechanism within the first two seconds");
  });

  test("image prompt treats the hook frame as the feed test product", () => {
    const compiled = imagePromptTemplate.compile({
      provider: "openai",
      project: {
        id: "project-1",
        title: "Tiny Mechanisms: zipper lock",
        topic: "tiny_mechanisms:zipper_locking",
      },
      scene: {
        id: "scene-1",
        position: 1,
        role: "hook",
        durationSeconds: 3,
        narration: "It should split open.",
        caption: "It should split",
        imagePrompt:
          "a jacket zipper pulled sideways while the interlocked teeth refuse to separate",
        visualBrief: "The viewer sees a familiar zipper under impossible-looking tension.",
        visualHookArchetype: "consequence_first",
      },
    });

    expect(compiled.templateVersion).toBe(7);
    expect(compiled.prompt).toContain("Stayed to watch");
    expect(compiled.prompt).toContain("first-frame feed test");
    expect(compiled.prompt).toContain("No clean product shot");
    expect(compiled.prompt).toContain("No clean diagram or cutaway as the opening frame");
    expect(compiled.prompt).toContain("caption context only");
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
bun test packages/ai/src/prompts/shortsRecovery.test.ts
```

Expected: FAIL. At least the first failure should mention a missing file or missing expected prompt text such as `Expected to contain: "Stayed to watch"` or a template version mismatch.

- [ ] **Step 3: Leave the failing test uncommitted**

Do not commit this red state. Keep `packages/ai/src/prompts/shortsRecovery.test.ts` in the
working tree and commit it together with the first green implementation in Task 4.

---

### Task 2: Add Shared Shorts Recovery Policy Module

**Files:**
- Create: `packages/ai/src/prompts/shortsRecovery.ts`

- [ ] **Step 1: Add the shared policy module**

Create `packages/ai/src/prompts/shortsRecovery.ts`:

```ts
export const SHORTS_RECOVERY_PRIORITIZED_OBJECTS = [
  "latch",
  "ratchet",
  "zipper",
  "nail clipper",
  "tape measure lock",
  "stapler",
  "door closer",
  "camera aperture",
  "cam follower",
  "spring release",
  "pawl lock",
] as const;

export const SHORTS_RECOVERY_PAUSED_TOPICS = [
  "perception",
  "biology",
  "voice",
  "onions",
  "abstract physics gimmicks",
  "repeated cabinet or push-latch variants",
] as const;

export const SHORTS_RECOVERY_METRIC_GATES = [
  "Stayed to watch under 45% means the first frame and first line failed.",
  "Stayed to watch from 45-55% is weak and should not be scaled.",
  "Stayed to watch from 55-60% is usable only if average percentage viewed also improves.",
  "Stayed to watch 60%+ with average percentage viewed above 60% is the candidate reuse gate.",
] as const;

export const SHORTS_RECOVERY_CHANNEL_BIBLE_LINES = [
  "Shorts recovery goal: increase Stayed to watch from about 45% toward 60%+ before optimizing for raw views.",
  "Distribution note: Shorts feed is already the dominant traffic source, so solve feed response before SEO or hashtag changes.",
  `Prioritized recovery objects: ${SHORTS_RECOVERY_PRIORITIZED_OBJECTS.join(", ")}.`,
  `Paused recovery topics: ${SHORTS_RECOVERY_PAUSED_TOPICS.join(", ")}.`,
  "Recovery gate: raw views are a scale signal only; viewer choice and engaged-view quality decide whether a format is reusable.",
] as const;

export const SHORTS_RECOVERY_RESEARCH_RULES = [
  "Use the recovery metric gate: optimize for Stayed to watch, engaged views, and average percentage viewed before raw views.",
  "The first frame must create a visible moving or tension state in the first 0.5 seconds.",
  `Prioritize ${SHORTS_RECOVERY_PRIORITIZED_OBJECTS.join(", ")} when they can open with visible action, tension, snap, lock, release, or contradiction.`,
  `Pause perception, biology, voice, onions, abstract physics gimmicks, and repeated cabinet or push-latch variants unless the user explicitly asks for them.`,
  "Start from a familiar object under visible stress or change, not from a broad fact or clean explanatory category.",
  "Reject candidates whose opening would be a calm object portrait, clean diagram, product shot, or abstract explanation.",
] as const;

export const SHORTS_RECOVERY_JUDGE_RULES = [
  "Judge for the 24-48 hour feed test, not evergreen educational completeness.",
  "A reusable candidate should plausibly reach Stayed to watch 60%+ and average percentage viewed above 60%.",
  "Reward a first frame with a visible moving or tension state that makes the viewer ask why before narration matters.",
  "Penalize perception, biology, voice, onions, abstract physics gimmicks, calm product shots, clean diagrams, and repeated cabinet or push-latch variants.",
  "Do not select a candidate just because the mechanism is familiar; select it because the opening behavior is visually undeniable.",
] as const;

export const SHORTS_RECOVERY_SCRIPT_RULES = [
  "Recovery target: improve Stayed to watch in the first 1-3 seconds before optimizing raw views.",
  "The first scene must open on visible action, tension, snap, lock, release, or contradiction already happening.",
  "The first caption must be no more than 4 words and must read like a feed hook, not a transcript line.",
  "Use no clean product shot as the hook image.",
  "Use no diagram or cutaway as the opening image unless the cutaway itself is the surprising visible action.",
  "Reveal the hidden mechanism within the first two seconds when possible, or show an unmistakable clue before the first scene ends.",
  "The first narration line must describe what the viewer sees, not define the mechanism.",
] as const;

export const SHORTS_RECOVERY_IMAGE_RULES = [
  "This is a first-frame feed test for Stayed to watch, not a pretty illustration.",
  "No clean product shot for hook scenes.",
  "No clean diagram or cutaway as the opening frame unless the cutaway is itself the visible surprise.",
  "Show action, tension, snap, lock, release, resistance, or failure already happening.",
  "The viewer should understand the object and curiosity gap without reading captions or hearing narration.",
] as const;
```

- [ ] **Step 2: Run focused typecheck**

Run:

```bash
bun run --cwd packages/ai typecheck
```

Expected before wiring: PASS, because the module is standalone.

- [ ] **Step 3: Commit the policy module**

```bash
git add packages/ai/src/prompts/shortsRecovery.ts
git commit -m "feat: add shorts recovery prompt policy"
```

---

### Task 3: Wire Recovery Policy Into Channel Bible

**Files:**
- Modify: `packages/ai/src/prompts/presets/tinyMechanisms.ts`

- [ ] **Step 1: Import channel bible recovery lines**

At the top of `packages/ai/src/prompts/presets/tinyMechanisms.ts`, add:

```ts
import { SHORTS_RECOVERY_CHANNEL_BIBLE_LINES } from "../shortsRecovery";
```

- [ ] **Step 2: Add recovery lines to the bible**

Inside `TINY_MECHANISMS_CHANNEL_BIBLE`, after the existing `Retention:` line or immediately before it, add:

```ts
  ...SHORTS_RECOVERY_CHANNEL_BIBLE_LINES,
```

- [ ] **Step 3: Tighten broad topic language**

Replace this line if present:

```ts
"Reject topics or angles that cannot show a physical part moving, locking, sliding, catching, bending, releasing, or changing state on screen.",
```

with:

```ts
"Reject topics or angles that cannot show an object moving, locking, sliding, catching, bending, releasing, changing state, or visibly resisting force on screen.",
```

- [ ] **Step 4: Run tests**

Run:

```bash
bun test packages/ai/src/prompts/shortsRecovery.test.ts
```

Expected: still FAIL until the research, judge, script, and image prompts are wired.

- [ ] **Step 5: Commit**

```bash
git add packages/ai/src/prompts/presets/tinyMechanisms.ts
git commit -m "feat: add shorts recovery rules to channel bible"
```

---

### Task 4: Wire Recovery Policy Into Candidate Research And Judge Prompts

**Files:**
- Modify: `packages/ai/src/prompts/episodeResearch.ts`
- Modify: `packages/ai/src/prompts/episodeJudge.ts`

- [ ] **Step 1: Update candidate research imports and version**

In `packages/ai/src/prompts/episodeResearch.ts`, add:

```ts
import { SHORTS_RECOVERY_RESEARCH_RULES } from "./shortsRecovery";
```

Change:

```ts
version: 2,
```

to:

```ts
version: 3,
```

- [ ] **Step 2: Update candidate research developer prompt**

In the developer message after `"# Task"`, add:

```ts
            "# Shorts Recovery Policy",
            ...SHORTS_RECOVERY_RESEARCH_RULES,
            "",
```

Remove or replace these old lines:

```ts
"Do not default to latches, springs, cams, push-pop actions, one-way locks, ratchets, or click mechanisms unless the idea is unusually fresh and visually different from those patterns.",
"Prefer familiar everyday behavior with a visible surprise and a provable hidden cause. A moving part is helpful but not required.",
```

with:

```ts
"Do not avoid latches, springs, cams, one-way locks, ratchets, or click mechanisms when they create a stronger visible feed hook.",
"Prefer familiar everyday behavior with a visible surprise and a provable hidden cause. A visible moving or tension state is strongly preferred for this recovery batch.",
```

- [ ] **Step 3: Update role instructions**

In `roleInstruction`, replace the role strings with these exact return values:

```ts
    case "feed_stop_strategist":
      return "Focus on the first frame, the first 0.5 seconds, the first line, and maximum swipe resistance. Start from a familiar object under visible action or tension, not from a broad fact.";
    case "broad_object_selector":
      return "Focus on a familiar everyday object or setting that a broad audience recognizes immediately. Prefer objects with visible locking, snapping, catching, sliding, releasing, bending, or resisting force.";
    case "visual_mechanism_director":
      return "Focus on visual proof of cause and effect that can be understood from the picture alone. Prioritize motion, tension, deformation, contact points, force paths, or visible state changes.";
    case "retention_architect":
      return "Focus on a reveal path that gives the viewer a new visual reason to keep watching every 3-5 seconds. Avoid flat middle explanations and reveal the hidden cause early.";
    case "loop_payoff_editor":
      return "Focus on ending payoff, replay logic, and a title curiosity gap that resolves the first-frame contradiction. The payoff must make the opening action make sense.";
```

- [ ] **Step 4: Update candidate judge imports and version**

In `packages/ai/src/prompts/episodeJudge.ts`, add:

```ts
import { SHORTS_RECOVERY_JUDGE_RULES } from "./shortsRecovery";
```

Change:

```ts
version: 1,
```

to:

```ts
version: 2,
```

- [ ] **Step 5: Update candidate judge developer prompt**

In the developer message after `"# Task"`, add:

```ts
            "# Shorts Recovery Policy",
            ...SHORTS_RECOVERY_JUDGE_RULES,
            "",
```

Remove or replace these old lines:

```ts
"Treat latches, springs, cams, push-pop actions, one-way locks, ratchets, and clickers as high generic risk when they look like a familiar Tiny Mechanisms pattern.",
"Do not penalize non-mechanical causes just because they lack a moving part. Optical, material, fluid, acoustic, thermal, electrical, geometric, chemical, or other safe everyday causes can win if the visual proof is clear.",
```

with:

```ts
"Treat familiar mechanisms as high generic risk only when the first frame is calm, diagrammatic, repeated, or visually indistinct from recent videos.",
"Penalize candidates that lack a visible moving or tension state unless the visual proof is unusually immediate and concrete.",
```

- [ ] **Step 6: Run tests**

Run:

```bash
bun test packages/ai/src/prompts/shortsRecovery.test.ts
```

Expected: research and judge tests pass; script and image tests may still fail until later tasks.

- [ ] **Step 7: Commit**

```bash
git add packages/ai/src/prompts/episodeResearch.ts packages/ai/src/prompts/episodeJudge.ts packages/ai/src/prompts/shortsRecovery.test.ts
git commit -m "feat: bias episode selection toward shorts recovery"
```

---

### Task 5: Wire Recovery Policy Into Script Planning

**Files:**
- Modify: `packages/ai/src/prompts/scriptPlan.ts`
- Modify: `packages/ai/src/prompts/mechanicalEpisodeBank.test.ts`

- [ ] **Step 1: Import script recovery rules**

In `packages/ai/src/prompts/scriptPlan.ts`, add:

```ts
import { SHORTS_RECOVERY_SCRIPT_RULES } from "./shortsRecovery";
```

- [ ] **Step 2: Bump script prompt version**

Change:

```ts
version: 12,
```

to:

```ts
version: 13,
```

- [ ] **Step 3: Add recovery block to the developer message**

After the existing `"# Editorial Mission"` block and before `"# Pacing Rules"`, add:

```ts
            "# Shorts Recovery Policy",
            ...SHORTS_RECOVERY_SCRIPT_RULES,
            "Design the hook scene as the product being tested in Shorts feed.",
            "Use the first scene to make the viewer choose to stay before the explanatory arc begins.",
            "For the 12-video recovery batch, vary the opening format across action-first, contradiction-caption-first, and early-mechanism-reveal formats.",
            "",
```

- [ ] **Step 4: Keep legacy prompt assertions current**

In `packages/ai/src/prompts/mechanicalEpisodeBank.test.ts`, update:

```ts
expect(compiled.templateVersion).toBe(10);
```

to:

```ts
expect(compiled.templateVersion).toBe(13);
```

Add these assertions in the same test:

```ts
    expect(developerMessage).toContain("Stayed to watch");
    expect(developerMessage).toContain("first 1-3 seconds");
    expect(developerMessage).toContain("no clean product shot");
    expect(developerMessage).toContain("reveal the hidden mechanism within the first two seconds");
```

- [ ] **Step 5: Run tests**

Run:

```bash
bun test packages/ai/src/prompts/shortsRecovery.test.ts packages/ai/src/prompts/mechanicalEpisodeBank.test.ts
```

Expected: script tests pass; image prompt tests may still fail until Task 6.

- [ ] **Step 6: Commit**

```bash
git add packages/ai/src/prompts/scriptPlan.ts packages/ai/src/prompts/mechanicalEpisodeBank.test.ts
git commit -m "feat: tighten script hooks for shorts recovery"
```

---

### Task 6: Wire Recovery Policy Into Image Prompting

**Files:**
- Modify: `packages/ai/src/prompts/imagePrompt.ts`
- Modify: `packages/ai/src/prompts/mechanicalEpisodeBank.test.ts`

- [ ] **Step 1: Import image recovery rules**

In `packages/ai/src/prompts/imagePrompt.ts`, add:

```ts
import { SHORTS_RECOVERY_IMAGE_RULES } from "./shortsRecovery";
```

- [ ] **Step 2: Bump image prompt version**

Change:

```ts
version: 6,
```

to:

```ts
version: 7,
```

- [ ] **Step 3: Add recovery rules to image prompt**

Inside the `prompt` array after `"RETENTION JOB"`, add:

```ts
      "# Shorts Recovery Policy",
      ...SHORTS_RECOVERY_IMAGE_RULES,
      "",
```

Also add these exact lines to the existing social hook section:

```ts
      "First-frame feed test: the image must be interesting before the title, narration, or caption helps.",
      "No clean product shot for hook scenes.",
      "No clean diagram or cutaway as the opening frame unless the cutaway is the visible surprise.",
```

- [ ] **Step 4: Update existing image prompt test version**

In `packages/ai/src/prompts/mechanicalEpisodeBank.test.ts`, update:

```ts
expect(compiled.templateVersion).toBe(6);
```

to:

```ts
expect(compiled.templateVersion).toBe(7);
```

Add these assertions to the image prompt test:

```ts
    expect(compiled.prompt).toContain("Stayed to watch");
    expect(compiled.prompt).toContain("first-frame feed test");
    expect(compiled.prompt).toContain("No clean product shot");
    expect(compiled.prompt).toContain("No clean diagram or cutaway as the opening frame");
```

- [ ] **Step 5: Run tests**

Run:

```bash
bun test packages/ai/src/prompts/shortsRecovery.test.ts packages/ai/src/prompts/mechanicalEpisodeBank.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ai/src/prompts/imagePrompt.ts packages/ai/src/prompts/mechanicalEpisodeBank.test.ts
git commit -m "feat: tighten image prompts for shorts feed hooks"
```

---

### Task 7: Full Verification

**Files:**
- Verify only; no source edits expected.

- [ ] **Step 1: Run focused prompt tests**

Run:

```bash
bun test packages/ai/src/prompts/shortsRecovery.test.ts packages/ai/src/prompts/mechanicalEpisodeBank.test.ts
```

Expected: all tests pass with `0 fail`.

- [ ] **Step 2: Run package typecheck**

Run:

```bash
bun run --cwd packages/ai typecheck
```

Expected: exit code 0.

- [ ] **Step 3: Run formatter/linter check on touched files**

Run:

```bash
bunx biome check \
  packages/ai/src/prompts/shortsRecovery.ts \
  packages/ai/src/prompts/shortsRecovery.test.ts \
  packages/ai/src/prompts/presets/tinyMechanisms.ts \
  packages/ai/src/prompts/episodeResearch.ts \
  packages/ai/src/prompts/episodeJudge.ts \
  packages/ai/src/prompts/scriptPlan.ts \
  packages/ai/src/prompts/imagePrompt.ts \
  packages/ai/src/prompts/mechanicalEpisodeBank.test.ts
```

Expected: `Checked 8 files` and no errors.

- [ ] **Step 4: Inspect git status**

Run:

```bash
git status --short
```

Expected: only intended prompt-policy files are modified or all intended changes are committed. If unrelated analytics files are dirty, leave them alone and call them out in the handoff.

---

## Execution Notes

- Prefer a separate worktree before executing if analytics measurement changes are still dirty in the main workspace.
- Do not change `apps/web`, `apps/api`, database migrations, or render code for this plan.
- Do not add dependencies.
- Do not start dev servers.
- Do not implement CSV import in this plan.
