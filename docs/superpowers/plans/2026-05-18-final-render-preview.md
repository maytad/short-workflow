# Final Render Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the completed render MP4 in the Render panel and add a local button to reveal the output file in Finder.

**Architecture:** Reuse the existing asset file endpoint for video playback. Add a narrow local API endpoint for Finder reveal, restricted to ready local render assets and backed by a service that resolves paths under `LOCAL_ASSET_ROOT`.

**Tech Stack:** Bun, ElysiaJS, React, TanStack Query, Tailwind, lucide-react.

---

### Task 1: API Reveal Endpoint

**Files:**
- Modify: `apps/api/src/services/projects.ts`
- Modify: `apps/api/src/routes/projects.ts`
- Test: `apps/api/src/app.test.ts`

- [ ] Add route tests for `POST /assets/:assetId/reveal`.
- [ ] Implement `revealAssetFile()` in project services using `open -R` on macOS.
- [ ] Register the service in `ProjectRouteServices`.
- [ ] Add route logic that accepts only ready local `render` assets.
- [ ] Run `bun test apps/api/src/app.test.ts`.

### Task 2: Web Preview UI

**Files:**
- Create: `apps/web/src/features/projects/assetUrls.ts`
- Modify: `apps/web/src/features/projects/AssetPanel.tsx`
- Modify: `apps/web/src/features/projects/RenderPanel.tsx`
- Modify: `apps/web/src/features/projects/hooks.ts`
- Test: `apps/web/src/features/projects/workflow.test.ts`

- [ ] Move shared asset URL helpers into `assetUrls.ts`.
- [ ] Add `assetRevealUrl()` helper and a focused helper test.
- [ ] Add a reveal mutation hook that POSTs to `/assets/:assetId/reveal`.
- [ ] Render an inline `<video controls>` preview for successful render output assets.
- [ ] Add an `Open folder` button with pending and error states.
- [ ] Run `bun test apps/web/src/features/projects/workflow.test.ts`.

### Task 3: Verification

**Files:**
- Check all files touched by Tasks 1-2.

- [ ] Run `bun run --cwd apps/api typecheck`.
- [ ] Run `bun run --cwd apps/web typecheck`.
- [ ] Run `git diff --check`.
