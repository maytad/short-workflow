# Short Workflow Design

## Summary

Short Workflow is a single-user, local-first tool for creating English vertical short-form videos with AI assistance. The MVP uses a step-by-step editor instead of one-click automation so the user can review and edit script, scenes, image prompts, voice, and render output before exporting the final video.

The initial output format is a 45-second English faceless short for YouTube Shorts, TikTok, and Instagram Reels.

## Goals

- Create a local-first workflow that turns a topic into a finished vertical MP4.
- Keep the app usable by one person without authentication, multi-user permissions, or billing.
- Keep AI generation steps explicit and reviewable.
- Store generated assets on the local filesystem while keeping portable paths in the database for future migration to cloud storage.
- Separate frontend, backend, worker, rendering, AI clients, database access, and shared schemas into clear monorepo boundaries.

## Non-Goals

- No Supabase Auth in the MVP.
- No RLS policy design in the MVP.
- No internal API token in the MVP.
- No public deployment in the MVP.
- No Redis, BullMQ, or cloud queue in the MVP.
- No Google Cloud Storage or Supabase Storage in the MVP.
- No YouTube upload automation in the MVP.
- No SaaS billing, teams, or multi-user support in the MVP.
- No cloud rendering in the MVP.

## Product Scope

The MVP is an English-only step-by-step editor for producing vertical AI-assisted short videos.

The workflow is:

1. Create a project from a topic.
2. Generate an English short-form script.
3. Review and edit scene narration, captions, and image prompts.
4. Generate scene images.
5. Generate English voice narration.
6. Preview the timeline and scene durations.
7. Render a local MP4 with Remotion.
8. Review/export the final video path.

The app UI is English only. Generated script, captions, image prompts, and SSML are English only.

## Video Format

- Primary format: vertical short-form video.
- Resolution: 1080x1920.
- Aspect ratio: 9:16.
- FPS: 30.
- Default duration: 45 seconds.
- Editable duration presets: 30, 45, and 60 seconds.
- MVP allowed duration range: 20-60 seconds.
- Style: faceless explainer / visual essay / mini-documentary.
- Core elements: generated image per scene, AI narration, large captions, simple motion, and transitions.

Background music is out of scope for the MVP. It should not be modeled in the first Remotion input contract or asset schema.

Scene count is preset-driven in the MVP so prompt design and rendering stay predictable. The AI may adjust wording and scene content, but it should return the requested scene roles and count.

Scene ordering is fixed by the selected duration preset in the MVP. Users can edit scene text and prompts, but arbitrary scene reordering is out of scope because the roles and timing form the video structure.

Default role mapping:

- 30 seconds: `hook`, `context`, `point`, `payoff`, `cta`
- 45 seconds: `hook`, `context`, `point`, `point`, `payoff`, `cta`
- 60 seconds: `hook`, `context`, `point`, `point`, `point`, `payoff`, `cta`

Multiple `point` scenes are distinguished by `position`.

30-second structure:

- 0-3s: hook.
- 3-8s: context.
- 8-18s: point.
- 18-26s: payoff or takeaway.
- 26-30s: loop ending or soft CTA.

Default 45-second structure:

- 0-3s: hook.
- 3-10s: context.
- 10-22s: point 1.
- 22-34s: point 2.
- 34-42s: payoff or takeaway.
- 42-45s: soft CTA or loop ending.

60-second structure:

- 0-3s: hook.
- 3-10s: context.
- 10-22s: point 1.
- 22-34s: point 2.
- 34-48s: point 3 or escalation.
- 48-56s: payoff or takeaway.
- 56-60s: loop ending or soft CTA.

## Architecture

The repository is a Bun workspace monorepo orchestrated with Turborepo.

- Package manager: Bun workspaces.
- Task orchestration and caching: Turborepo.
- Runtime for `apps/api`: Bun.
- Runtime for `apps/worker`: Bun.
- Runtime for `apps/web`: Vite scripts launched through Bun.
- Runtime for `apps/render`: Node.js. Remotion render and Studio commands should run through Node.js, not the Bun runtime.

The root `package.json` should declare Bun as the package manager and include direct workspace globs:

```json
{
  "packageManager": "bun@1.2.0",
  "workspaces": ["apps/*", "packages/*"]
}
```

```text
short-workflow/
  apps/
    web/       # React + Vite + TanStack Router frontend
    api/       # ElysiaJS + Bun backend API
    worker/    # Bun worker commands for generation and render orchestration
    render/    # Remotion video templates and render entrypoint

  packages/
    db/        # Supabase schema, migrations, DB clients, query functions
    ai/        # OpenAI, Google Gemini image, Google Text-to-Speech clients
    shared/    # shared TypeScript types, Zod schemas, constants
    config/    # shared tsconfig, eslint, formatting config
```

### App Responsibilities

`apps/web` is a browser-only React SPA. It owns the editor UI, project setup, step navigation, status display, scene editing, preview controls, and calls to `apps/api`. It must not import `packages/db` directly.

`apps/api` is an ElysiaJS API running on Bun. It owns HTTP contracts, request validation, project mutations, job creation, and service orchestration. It uses `packages/db`, `packages/shared`, and `packages/ai` where needed.

`apps/worker` runs local worker commands on Bun. It processes pending jobs from the database, calls AI providers, writes local assets, updates asset and job records, and triggers Remotion render jobs through a Node.js subprocess in `apps/render`.

`apps/render` owns Remotion compositions and render commands. It accepts a typed render input JSON and produces a local MP4. Remotion is Node-first, so render and Studio commands must run through Node.js even though the monorepo uses Bun for package management and the API/worker runtime.

`packages/db` is the database boundary and source of truth for migrations, generated Supabase types, and DB query functions.

`packages/ai` wraps provider-specific API calls for OpenAI, Google Gemini image generation, and Google Cloud Text-to-Speech.

`packages/shared` owns schemas and types shared by web, API, worker, and render.

## Frontend React Design

`apps/web` uses React with Vite, TanStack Router, and TanStack Query, also known as React Query. TanStack Router owns navigation and URL state. TanStack Query owns server state, cache invalidation, polling, retries, and mutation status.

Frontend package expectations:

- `@tanstack/react-router`
- `@tanstack/router-plugin` for Vite file-based route generation
- `@tanstack/react-query`
- `@tanstack/react-query-devtools` for local development only
- `react-hook-form`
- `@hookform/resolvers`
- `tailwindcss`
- `@tailwindcss/vite`
- shadcn/ui CLI-generated components
- `lucide-react` for icons
- shared request and response schemas imported from `packages/shared`

The root React tree should install a single `QueryClientProvider` next to the router provider. The query client should use conservative defaults:

- `staleTime`: 5 seconds for project, scene, asset, and render reads.
- `gcTime`: 5 minutes for normal reads.
- `retry`: 1 retry for idempotent GET requests only.
- Mutations should not retry provider-triggering actions by default.

TanStack Router should use file-based routing through the Vite plugin. Route files live in `apps/web/src/routes`. The generated route tree lives at `apps/web/src/routeTree.gen.ts` and should not be manually edited. Feature implementation should stay in `apps/web/src/features/*`; route files should compose feature components and route-level loaders/search params.

`apps/web` should expose a thin API client around `fetch`. It should:

- call only `apps/api`
- parse responses with shared schemas
- throw a typed `ApiError` containing HTTP status and response payload
- never import `packages/db`
- never access Supabase directly

Use a query key factory instead of ad hoc string arrays. Initial keys:

```ts
projects.all
projects.detail(projectId)
projects.scenes(projectId)
projects.assets(projectId)
projects.renders(projectId)
projects.jobs(projectId, status)
```

Route components should read server data through query hooks, not duplicate it in local state. Local React state is reserved for UI-only concerns such as selected scene id, focused panel, unsaved form edits, disclosure modal visibility, and transient preview controls. URL state should hold durable navigation state such as active project id, selected scene id, and current step when useful for reloads or sharing local URLs.

Forms should use `react-hook-form` with `@hookform/resolvers/zod` and schemas from `packages/shared`. Scene editor forms should track dirty state, field-level validation errors, and submit state through form APIs instead of hand-rolled per-field state.

Core query hooks:

- `useProjectsQuery()`
- `useProjectQuery(projectId)`
- `useProjectScenesQuery(projectId)`
- `useProjectAssetsQuery(projectId)`
- `useProjectRendersQuery(projectId)`
- `useProjectJobsQuery(projectId, status)`

Core mutation hooks:

- `useCreateProjectMutation()`
- `useUpdateProjectMutation(projectId)`
- `useDeleteProjectMutation(projectId)`
- `useGenerateScriptMutation(projectId)`
- `useUpdateSceneMutation(sceneId)`
- `useGenerateSceneImageMutation(sceneId)`
- `useGenerateSceneAudioMutation(sceneId)`
- `useRenderProjectMutation(projectId)`
- `useRetryJobMutation(jobId)`
- `useAcknowledgeDisclosureMutation(renderId)`

Mutation invalidation rules:

- Project create/delete invalidates `projects.all`.
- Project update invalidates `projects.detail(projectId)` and `projects.all`.
- Script generation invalidates project detail, scenes, jobs, assets, and renders for the project.
- Scene patch invalidates project detail and scenes. It should also invalidate assets because prior image/audio may become stale for the current scene content.
- Image/audio generation invalidates jobs and assets for the project.
- Render mutation invalidates jobs, renders, assets, and project detail.
- Job retry invalidates jobs and the affected project-level or scene-level resources once the retry succeeds.
- Disclosure acknowledgement invalidates renders for the project.

Scene patch optimistic updates need special asset handling. If a scene content field changes optimistically, the mutation must immediately invalidate or optimistically mark the affected scene's image/audio assets as stale in `projects.assets(projectId)` during `onMutate`, before waiting for `onSuccess`. This prevents the UI from briefly showing an old image or audio as current while the server bumps `content_updated_at`.

Job progress polling uses TanStack Query. `useProjectJobsQuery(projectId, "active")` should poll every 2 seconds only while the project screen is mounted and active jobs exist. When the active jobs query changes from non-empty to empty, invalidate project detail, scenes, assets, and renders once so the UI reflects completed worker outputs. SSE and WebSockets remain out of scope for the MVP.

Optimistic updates are allowed only for lightweight text edits, such as project title/topic and scene text fields. Generation and render mutations should show pending job state from the API instead of fabricating generated assets on the client. API `409` and `422` responses should be displayed inline on the relevant step or scene so the user can fix the blocking condition.

## Frontend Styling And Component System

`apps/web` uses Tailwind CSS with shadcn/ui as the component foundation. shadcn components are copied into the repo and customized; they are not treated as an external black-box component library.

Tailwind setup:

- Use Tailwind v4 with the Vite plugin.
- Configure Tailwind through `@tailwindcss/vite`.
- Do not add the old `tailwindcss` PostCSS plugin for v4.
- Keep global theme tokens in `apps/web/src/styles/globals.css`.

shadcn/ui setup:

- Store shadcn primitives in `apps/web/src/components/ui`.
- Store domain components in `apps/web/src/features/*`.
- Store app shell components in `apps/web/src/components/layout`.
- Use `class-variance-authority` variants for reusable component states.
- Treat shadcn as primitives only; do not paste generic shadcn blocks as finished screens.

Initial shadcn components:

- `alert`
- `button`
- `card`
- `form`
- `input`
- `textarea`
- `label`
- `select`
- `tabs`
- `dialog`
- `sheet`
- `tooltip`
- `popover`
- `badge`
- `progress`
- `separator`
- `skeleton`
- `table`
- `sonner`

Design taste baseline for this workflow tool:

- `DESIGN_VARIANCE`: 5
- `MOTION_INTENSITY`: 3-4
- `VISUAL_DENSITY`: 6

These values use a 1-10 scale where 1 is the most conservative and 10 is the most expressive. `DESIGN_VARIANCE` controls layout asymmetry and visual distinctiveness, `MOTION_INTENSITY` controls animation amount, and `VISUAL_DENSITY` controls how much information appears on screen at once.

This is a focused production tool, not a marketing site. The first screen should be the usable editor workflow, not a landing page. Use clear information architecture, compact controls, predictable navigation, and restrained visual styling.

shadcn customization rules:

- Do not ship shadcn components in the generic default look.
- Customize radius, colors, borders, focus rings, shadows, and spacing through theme tokens.
- Use a quiet neutral base with one restrained accent color.
- Avoid purple/blue AI-style gradients, neon glows, outer glow shadows, and decorative blobs.
- Prefer borders, dividers, and spacing over nested cards.
- Do not put cards inside cards.
- Use cards only for repeated items, modals, preview frames, and genuinely grouped controls.
- Use `Geist`, `Satoshi`, or `Outfit` for the UI font stack. Avoid serif fonts and generic dashboard typography.
- Use `lucide-react` icons for icon buttons and tool actions. Do not hand-draw common UI icons.
- Do not use emojis in UI copy, labels, alt text, or placeholder content.

Expected UI structure:

- MVP is desktop-first, optimized for laptop and desktop localhost use.
- App shell has a left project/step rail, central scene editor, and right preview/status panel on desktop.
- Mobile responsive polish is out of scope for the MVP. Small screens should avoid broken layout, but the app does not need an optimized phone workflow.
- Scene list should be scannable, showing role, position, asset readiness, and job state.
- Scene editor should expose narration, caption, image prompt, SSML, image generation, and audio generation without hiding required fields behind multiple modals.
- Render step should show precondition failures inline before allowing render.

Interaction and state requirements:

- Loading states use skeletons that match the final layout dimensions.
- Empty states explain the next concrete action without marketing copy.
- Errors render inline near the blocked field, scene, or step.
- Buttons must include disabled, loading, hover, focus-visible, and active states.
- Use subtle transform or opacity transitions only; avoid continuous motion unless it communicates live job progress.
- Job progress should be readable through badges, progress rows, and timestamps rather than decorative animation.

## Security Model

The MVP is intentionally local-only and single-user.

- No authentication is implemented.
- No internal API token is implemented.
- The API must bind to localhost during MVP development.
- Public deployment is out of scope until an auth boundary is added.
- Supabase service role access is allowed only in `apps/api` and `apps/worker`.
- The frontend must not receive service role keys.
- The frontend must not access database tables directly.

This is acceptable only while the app is used locally by one person.

## Data Model

Initial tables:

- `projects`
- `scenes`
- `assets`
- `jobs`
- `renders`
- `prompt_versions`

### projects

Stores the top-level video project.

Key fields:

- `id`
- `title`
- `topic`
- `status`
- `target_duration_seconds`
- `language`
- `format`
- `created_at`
- `updated_at`

Project status values:

- `draft`
- `ready`
- `rendering`
- `done`
- `failed`

Project status represents the current working revision lifecycle only. Script, image, audio, and render progress is derived from `jobs`, `assets`, `scenes`, and `renders`. A project becomes `ready` once the editable script and scene plan are complete enough to generate assets. Regenerating one scene image or audio file does not move the whole project back into a phase-specific status.

Project status transitions:

| Event | From | To | Rule |
| --- | --- | --- | --- |
| Project created | none | `draft` | New projects start without a complete scene plan. |
| Script generation succeeds | `draft`, `ready`, `done`, `failed` | `ready` | All required scene rows exist and each scene is `ready`. |
| Scene content becomes incomplete | `ready`, `done`, `failed` | `draft` | The current working revision is no longer renderable. Successful render history remains available in `renders`. |
| Scene content changes after a successful render | `done`, `failed` | `ready` | Existing render history remains, but the latest render is stale. |
| Render job is active | `ready`, `done`, `failed` | `rendering` | A `render_video` job is `pending` or `processing`, including pending auto-retry states. |
| Render succeeds | `rendering` | `done` | A render row is `succeeded` and has a ready output asset. |
| Render fails permanently | `rendering` | `failed` | The render job reaches `failed` after auto-retry is exhausted. |
| User retries failed render | `failed` | `rendering` | A new `render_video` retry job is claimed. |

Project status is updated by API and worker mutation handlers. It is not a generated database column because render job lifecycle events affect it. A project remains `rendering` while any `render_video` job is active, even if the worker temporarily moves that job from `processing` back to `pending` for auto-retry. It changes to `failed` only when the render job reaches terminal `failed`.

Project API responses should include derived fields rather than overloading `status`:

- `hasSuccessfulRender`: true when the project has at least one `succeeded` render.
- `latestRenderStale`: false when `hasSuccessfulRender` is false. Otherwise true when the latest succeeded render `created_at` is earlier than the maximum `content_updated_at` across the project's scenes.

### scenes

Stores the editable scene plan.

Key fields:

- `id`
- `project_id`
- `position`
- `role`
- `duration_seconds`
- `narration`
- `caption`
- `image_prompt`
- `ssml`
- `status`
- `content_updated_at`
- `created_at`
- `updated_at`

Scene roles:

- `hook`
- `context`
- `point`
- `payoff`
- `cta`

Scene status values:

- `draft`
- `ready`

Scene status represents the editable content state only. Image and audio generation state is derived from `assets` and `jobs`, which are the source of truth for generated files and in-progress work.

A scene becomes `ready` when `narration`, `caption`, `image_prompt`, and `ssml` are all present and non-empty. A scene can remain `ready` while its image or audio assets are missing, pending, regenerating, or failed.

Scene status is computed at the application layer in the API mutation handler. `PATCH /scenes/:sceneId` should normalize editable text fields, then set `status = ready` when all required content fields are present. Content generation failures are represented by `jobs`, not by `scenes.status`.

`content_updated_at` tracks the latest meaningful scene content change. It is set when the scene is created and bumps only when one of these fields actually changes after normalization: `narration`, `caption`, `image_prompt`, `ssml`, `role`, or `duration_seconds`. A no-op `PATCH /scenes/:sceneId` that sends the same values must not touch `content_updated_at`. Generic `updated_at` triggers must not be used for asset freshness.

Scene positions are unique within a project. The database must enforce `unique (project_id, position)` so script generation retries cannot create duplicate scene rows for the same slot.

### assets

Stores generated file metadata and portable local paths.

Key fields:

- `id`
- `project_id`
- `scene_id`
- `kind`
- `storage_driver`
- `path`
- `mime_type`
- `size_bytes`
- `checksum`
- `status`
- `provider`
- `model`
- `created_at`
- `updated_at`

Asset kinds:

- `image`
- `audio`
- `render`
- `thumbnail`
- `render_input`

Storage drivers:

- `local`

Asset status values:

- `pending`
- `ready`
- `failed`

Asset provider values:

- `openai`
- `google_gemini`
- `google_tts`
- `remotion`
- `local`

`provider` is an enum. `model` is a nullable free-text provider model, voice, or renderer identifier such as `gpt-5.5`, a Gemini image model id, a Google TTS voice id, or a Remotion renderer version.

The `path` field stores a relative portable path, not an absolute filesystem path.

Example:

```text
projects/{projectId}/scenes/{sceneId}/images/{assetId}.png
projects/{projectId}/scenes/{sceneId}/audio/{assetId}.mp3
projects/{projectId}/renders/{renderId}.mp4
projects/{projectId}/input/{renderId}.json
```

Generated asset paths are append-only in the MVP. Image and audio regeneration creates new asset records and new file paths instead of overwriting an existing file.

Consumers that need a scene image or audio file should select the newest current `ready` asset for `(project_id, scene_id, kind)` by `created_at desc`. An asset is current when `asset.created_at >= scene.content_updated_at`. An asset is stale when `asset.created_at < scene.content_updated_at`. Older ready assets remain historical stale assets for traceability and old render input reproducibility, but are ignored for new renders. `pending` and `failed` assets are ignored for rendering.

`mime_type`, `size_bytes`, and `checksum` are nullable while an asset is `pending` or `failed`. They are populated only after the worker has fully written the file and moved the asset to `ready`.

Checksums use the format `sha256:<hex>`. If checksum computation fails in the MVP, leave the field null rather than blocking the whole generation flow.

### jobs

Stores local job state without Redis or a queue service.

Key fields:

- `id`
- `project_id`
- `scene_id`
- `type`
- `status`
- `attempts`
- `max_attempts`
- `parent_job_id`
- `error_message`
- `input`
- `output`
- `created_at`
- `started_at`
- `finished_at`
- `updated_at`

Job types:

- `generate_script`
- `generate_scene_image`
- `generate_scene_audio`
- `render_video`

Job statuses:

- `pending`
- `processing`
- `succeeded`
- `failed`

Job `output` is nullable until a job succeeds. On success, it stores compact JSON references to records created or updated by the handler:

- `generate_script`: `{ "sceneIds": ["scene-id"] }`
- `generate_scene_image`: `{ "assetId": "asset-id" }`
- `generate_scene_audio`: `{ "assetId": "asset-id" }`
- `render_video`: `{ "renderId": "render-id", "inputAssetId": "asset-id", "outputAssetId": "asset-id" }`

The worker claims pending jobs atomically in the database and updates status after completion. Failed jobs can be retried from the UI.

Default `max_attempts` is `5`. Attempts are incremented on each claim, including claims after stale recovery, so the default leaves room for transient process crashes as well as provider errors.

The MVP uses one worker process with configurable in-process concurrency. Default concurrency is `2` and can be configured with:

```text
WORKER_CONCURRENCY=2
```

Each concurrent handler must claim jobs through the same atomic database function. This keeps the MVP simple while allowing image or audio work across multiple scenes to proceed in parallel.

On startup, and periodically while running, the worker should recover stale `processing` jobs by moving jobs with an old `started_at` back to `pending`.

Preferred stale recovery pattern:

```sql
update jobs
set
  status = 'pending',
  started_at = null,
  updated_at = now()
where status = 'processing'
  and started_at < now() - interval '10 minutes'
returning *;
```

The stale threshold should be configurable later if render jobs need longer processing windows. For MVP, 10 minutes is acceptable.

The implementation should expose a database function such as `claim_next_job()` and call it from the worker. The function should use row locking so running two worker processes does not process the same job twice.

Preferred Postgres pattern:

```sql
with claimed as (
  select id
  from jobs
  where status = 'pending'
    and attempts < max_attempts
  order by created_at
  for update skip locked
  limit 1
)
update jobs
set
  status = 'processing',
  attempts = attempts + 1,
  started_at = now(),
  updated_at = now()
where id in (select id from claimed)
returning *;
```

An alternative `UPDATE ... WHERE status = 'pending' RETURNING *` pattern is acceptable only if it preserves the same atomic claim behavior.

Generation endpoints are idempotent by job scope. If an equivalent `pending` or `processing` job already exists, the API returns the existing job instead of creating a duplicate.

The API should create jobs with an insert-first pattern, not a select-then-insert pattern:

```sql
insert into jobs (...)
values (...)
on conflict do nothing
returning *;
```

If the insert returns no row, the API selects the existing active job for the same idempotency scope and returns it. This avoids check-then-insert races under concurrent requests.

Job idempotency scopes:

- `generate_script`: one active job per project.
- `generate_scene_image`: one active image job per scene.
- `generate_scene_audio`: one active audio job per scene.
- `render_video`: one active render job per project.

User-initiated retry creates a new job using the failed job input. The new job starts with `attempts = 0`, keeps the same default `max_attempts`, and stores the failed job id in `parent_job_id`. The failed job remains unchanged for audit history.

`POST /jobs/:jobId/retry` is valid only for `failed` jobs. Retrying `pending`, `processing`, or `succeeded` jobs returns `409 Conflict`. Re-doing a successful generation should call the specific generation endpoint again, not the retry endpoint.

Worker failure handling provides lightweight auto-retry:

- If a handler fails and `attempts < max_attempts`, set the job back to `pending` and store the latest `error_message`.
- If a handler fails and `attempts >= max_attempts`, set the job to `failed`.
- User retry is separate from auto-retry and always creates a new job.

`scene_id` nullability is type-dependent:

- `generate_script` and `render_video` are project-level jobs and must have `scene_id = null`.
- `generate_scene_image` and `generate_scene_audio` are scene-level jobs and must have `scene_id` set.

Idempotency and scene position constraints must be enforced at the database level, not only by application checks:

```sql
create unique index jobs_one_active_project_job
on jobs (project_id, type)
where scene_id is null
  and status in ('pending', 'processing');

create unique index jobs_one_active_scene_job
on jobs (scene_id, type)
where scene_id is not null
  and status in ('pending', 'processing');

create unique index scenes_one_position_per_project
on scenes (project_id, position);
```

Migration index hints:

- `jobs(project_id, status, created_at desc)` for project job polling.
- `jobs(started_at) where status = 'processing'` for stale job recovery.
- `assets(scene_id, kind, created_at desc) where status = 'ready'` for current asset lookup during render preconditions and render input generation.
- `prompt_versions(project_id, scene_id, purpose, revision desc)` for prompt history lookup.

### renders

Stores render attempt metadata. It is not the source of truth for file paths.

Key fields:

- `id`
- `project_id`
- `status`
- `input_asset_id`
- `output_asset_id`
- `duration_seconds`
- `width`
- `height`
- `fps`
- `ai_disclosure_acknowledged_at`
- `error_message`
- `created_at`
- `updated_at`

Render status values:

- `pending`
- `rendering`
- `succeeded`
- `failed`

The rendered MP4 path is stored only in the `assets` table through the `output_asset_id` render asset. The render input JSON path is stored only in the `assets` table through the `input_asset_id` render input asset.

### prompt_versions

Stores prompts used for AI generation so outputs can be debugged and reproduced.

Key fields:

- `id`
- `project_id`
- `scene_id`
- `purpose`
- `provider`
- `model`
- `revision`
- `prompt_payload`
- `response_text`
- `response_metadata`
- `created_at`

Prompt purpose values:

- `script`
- `image_prompt`
- `ssml`
- `caption`

`prompt_payload` is JSONB. It stores the provider request input needed to debug or reproduce generation, such as chat messages, prompt text, structured output schema hints, model parameters, or provider-specific request fields. It must not store secrets, binary payloads, or base64 image/audio data.

`prompt_versions` must not store binary payloads or base64 image/audio data. Large provider responses should be summarized in `response_text` and linked to generated files through `assets`. `response_metadata` may store compact JSON provider metadata, token usage, model ids, and provider-neutral `safety_info`. The implementation should keep each stored response payload under 64 KB.

`revision` increments within the scope of `(project_id, scene_id, purpose)`. For project-level prompts where `scene_id` is null, the revision increments within `(project_id, purpose)`. This makes regenerated script, prompt, and SSML history easy to inspect without relying only on timestamps.

`response_metadata` should include compact debugging fields when available:

- `request_id`
- `model_id`
- `tokens_in`
- `tokens_out`
- `finish_reason`
- `latency_ms`
- `safety_info`

## Local Asset Storage

Assets are stored on the local filesystem in the MVP. The database stores portable relative paths and metadata so asset records can later point to Supabase Storage or Google Cloud Storage without changing project or scene logic.

The root is configured with:

```text
LOCAL_ASSET_ROOT=/absolute/path/to/short-workflow-data
```

Suggested local structure:

```text
{LOCAL_ASSET_ROOT}/
  projects/
    {projectId}/
      scenes/
        {sceneId}/
          images/
            {assetId}.png
          audio/
            {assetId}.mp3
      renders/
        {renderId}.mp4
      input/
        {renderId}.json
```

Workers write generated files to a temporary path first, then atomically rename the completed file to its final asset path. The worker updates the asset record to `ready` only after the rename succeeds and file metadata has been computed. On failure, the worker should delete the temporary file best-effort and leave the asset `failed` with nullable file metadata.

Project deletion is destructive in the MVP. `DELETE /projects/:projectId` removes project rows and attempts to recursively delete:

```text
{LOCAL_ASSET_ROOT}/projects/{projectId}/
```

Project deletion is blocked when the project has `pending` or `processing` jobs. In that case, `DELETE /projects/:projectId` returns `409 Conflict` and does not delete database rows or local files.

If there are no active jobs and local file cleanup fails, the API should return an error and leave enough database state to retry cleanup manually. A trash/archive period is out of scope for the MVP.

## API Contract

Initial endpoints:

- `GET /health`
- `GET /projects`
- `POST /projects`
- `GET /projects/:projectId`
- `PATCH /projects/:projectId`
- `DELETE /projects/:projectId`
- `GET /projects/:projectId/scenes`
- `POST /projects/:projectId/generate-script`
- `PATCH /scenes/:sceneId`
- `POST /scenes/:sceneId/generate-image`
- `POST /scenes/:sceneId/generate-audio`
- `POST /projects/:projectId/render`
- `POST /jobs/:jobId/retry`
- `POST /renders/:renderId/acknowledge-disclosure`
- `GET /projects/:projectId/jobs`
- `GET /projects/:projectId/assets`
- `GET /projects/:projectId/renders`

The API returns typed JSON validated by shared schemas.

`PATCH /projects/:projectId` editable fields in the MVP:

- `title`
- `topic`

`target_duration_seconds` can be changed only before a project has scene rows. After scenes exist, duration changes return `409 Conflict`; create a new project to change duration in the MVP. This keeps scene rows and historical assets append-only without introducing archived scene records. `status`, `language`, and `format` are read-only in the MVP.

`POST /projects/:projectId/generate-script` behavior:

- First successful run creates the preset-driven scene rows for the selected duration.
- If the project already has `pending` or `processing` jobs, return `409 Conflict`.
- Regeneration uses the project's existing `target_duration_seconds`.
- Regeneration merges by `position` inside one database transaction, using the `unique (project_id, position)` constraint.
- Existing scene ids are preserved when the same position is regenerated.
- `narration`, `caption`, `image_prompt`, `ssml`, `role`, and `duration_seconds` are updated from the new script output.
- If a scene content field changes, existing image and audio asset records and files for that scene are kept as stale history. New renders ignore those stale scene assets until fresh ready assets are generated for the updated scene content.
- Existing render rows and render assets remain append-only history. The project moves back to `ready` after successful regeneration.

`POST /scenes/:sceneId/generate-image` and `POST /scenes/:sceneId/generate-audio` behavior:

- If an equivalent active job already exists for the scene and kind, return that job.
- Otherwise create a new job and a new append-only asset record.
- A successful generation writes a new ready asset; the newest current ready asset becomes the default file used by previews and render input generation.

`PATCH /scenes/:sceneId` editable fields in the MVP:

- `narration`
- `caption`
- `image_prompt`
- `ssml`

Read-only scene fields in the MVP:

- `project_id`
- `position`
- `role`
- `duration_seconds`

`duration_seconds` remains fixed by the selected duration preset. A freeform timeline editor is out of scope for the MVP.

Job progress uses TanStack Query polling in the MVP. The frontend should poll `GET /projects/:projectId/jobs?status=active` every 2 seconds while active jobs exist and stop polling once all jobs are in a terminal status. SSE and WebSockets are out of scope for the MVP.

`GET /projects/:projectId/jobs` query behavior:

- `status=active` returns `pending` and `processing` jobs only.
- `status=failed` returns failed jobs.
- `status=all` returns all jobs.
- Default `limit` is `50`.
- Maximum `limit` is `100`.
- Sort order is newest first by `created_at`.

Render input generation is an internal worker sub-step. The frontend calls `POST /projects/:projectId/render`; the worker builds a render-specific input JSON, stores it as a `render_input` asset, and then runs the Remotion render through a Node.js subprocess in `apps/render`. There is no separate public render-input endpoint in the MVP.

`POST /projects/:projectId/render` preconditions:

- If an active `render_video` job already exists for the project, return the existing job.
- Every scene for the current duration preset must be `ready`.
- Every scene must have a current ready image asset and a current ready audio asset.
- If preconditions fail, return `422 Unprocessable Entity` with the missing or stale scene ids and asset kinds.

Example `422` response:

```json
{
  "error": "render_preconditions_failed",
  "details": {
    "scenesNotReady": ["scene-id"],
    "scenesMissingImage": ["scene-id"],
    "scenesMissingAudio": ["scene-id"],
    "scenesWithStaleImage": ["scene-id"],
    "scenesWithStaleAudio": ["scene-id"]
  }
}
```

The render input builder revalidates the same preconditions and selects the newest current ready image and audio asset for each scene. If any required scene is missing a current ready image or audio asset, the `render_video` job fails with a clear error instead of producing a partial video.

`POST /renders/:renderId/acknowledge-disclosure` sets `ai_disclosure_acknowledged_at` to the current timestamp. The endpoint is used by the export confirmation UI before the user uses the generated MP4 externally.

## AI Provider Responsibilities

OpenAI GPT-5.5 is used for:

- topic-to-script generation
- scene breakdown
- caption drafting
- image prompt drafting
- SSML drafting

The script model is config-driven, not hardcoded across the codebase:

```text
OPENAI_SCRIPT_MODEL=gpt-5.5
```

If the exact model id changes, update the configuration and provider wrapper rather than scattering model strings through app code.

Google Gemini image generation, using the Nano Banana image model family, is used for:

- vertical scene images
- later thumbnail generation

Google Cloud Text-to-Speech is used for:

- English narration audio
- SSML-based pause and pacing control

The MVP should keep provider wrappers thin and explicit. Provider responses should be normalized into shared types before they reach app code.

## Captions and Subtitles

Scene `caption` is the on-screen text rendered directly by Remotion. It is part of the scene data and is not a standalone file in the MVP.

Standalone subtitle exports such as `.srt` or `.vtt` are out of scope for the MVP. A future subtitle export can add a `subtitle` asset kind and a dedicated generation job after the core render flow is stable.

## Remotion Input Contract

The render app receives a single JSON input.

Example shape:

```json
{
  "projectId": "project-id",
  "title": "Video title",
  "format": {
    "width": 1080,
    "height": 1920,
    "fps": 30,
    "durationSeconds": 45
  },
  "scenes": [
    {
      "id": "scene-id",
      "position": 1,
      "role": "hook",
      "durationSeconds": 3,
      "narration": "English narration",
      "caption": "English caption",
      "imagePath": "projects/project-id/scenes/scene-id/images/asset-id.png",
      "audioPath": "projects/project-id/scenes/scene-id/audio/asset-id.mp3"
    }
  ]
}
```

The worker writes this input to an append-only render-specific path:

```text
projects/{projectId}/input/{renderId}.json
```

Then `apps/render` renders the final MP4 to:

```text
projects/{projectId}/renders/{renderId}.mp4
```

The user does not inspect or approve the render input JSON in the MVP. It is stored for debugging and reproducibility. Render files are append-only in the MVP; re-rendering creates a new `renders` row and new `render_input` and `render` asset records instead of overwriting a previous file path.

## Error Handling

Each generation and render step writes errors to its job record. A failed scene-level job should not force the whole project to be discarded.

The UI should allow retrying:

- script generation for a project
- image generation for a scene
- audio generation for a scene
- video render

Provider errors should be stored with a concise message and enough provider metadata to debug the issue. Raw secrets must never be stored.

## Testing Strategy

The MVP does not require a full automated test suite before the first working local flow. The implementation should still keep lightweight verification close to the boundaries that are most likely to break:

- Shared schemas should be validated with a small schema check or unit test when they are created.
- Database migrations and core query functions should be verified when `packages/db` is created.
- The API should expose and manually verify `GET /health`.
- The worker should be manually verified against one local pending job.
- Remotion should be manually smoke-rendered with a tiny fixture project before wiring real AI outputs.

Full API tests, worker tests, DB integration tests, and end-to-end tests can wait until the basic MVP flow works once manually.

## Environment Variables

Expected variables:

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
GOOGLE_API_KEY=
GOOGLE_CLOUD_TEXT_TO_SPEECH_KEY_PATH=
LOCAL_ASSET_ROOT=
WORKER_CONCURRENCY=2
API_BASE_URL=http://localhost:3001
```

The service role key and AI keys are only used by `apps/api` and `apps/worker`.

## Development Workflow

Expected local commands:

```text
bun run dev
bun run dev:web
bun run dev:api
bun run dev:worker
bun run dev:render
bun run render:project --project <projectId>
```

The exact scripts will be defined during implementation.

## Compliance Guardrails

The MVP should include basic guidance and metadata for AI-assisted publishing:

- Generated output is AI-assisted.
- Avoid copyrighted music and images unless rights are clear.
- Avoid misleading synthetic content.
- Avoid unsupported medical, legal, or financial claims.
- Keep prompts and outputs stored for traceability.
- AI disclosure is always required for generated videos in the MVP.
- Require a simple export confirmation that the user reviewed AI disclosure and rights risk before using the final MP4 externally.
- Store that confirmation on the render record as `ai_disclosure_acknowledged_at`.

Automated platform disclosure and upload checks are out of scope for MVP.

## Recommended Implementation Order

1. Set up monorepo tooling.
2. Create shared schemas and constants, then run lightweight schema verification.
3. Create Supabase migrations and DB query package, then verify migrations and core queries.
4. Create Elysia API with project and job endpoints.
5. Create React step-by-step editor shell.
6. Add OpenAI script generation.
7. Add scene image generation.
8. Add scene audio generation.
9. Add internal render input builder and local Remotion rendering.
10. Add retry and failure handling.
11. Run a manual end-to-end MVP smoke pass from topic to MP4.

## Open Decisions

There are no blocking open decisions for the MVP design. Later phases can revisit authentication, cloud storage, queueing, deployment, analytics, and publishing automation.

Operational backup is not automated in the MVP. The user is responsible for backing up the local Supabase data and `LOCAL_ASSET_ROOT`. Automated backup, file sync, or cloud storage should be treated as post-MVP operational work, not a requirement for the first local flow.
