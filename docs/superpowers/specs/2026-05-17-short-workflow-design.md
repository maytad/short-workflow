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
- Core elements: generated image per scene, AI narration, large captions, simple motion, transitions, optional background music later.

Default 45-second structure:

- 0-3s: hook.
- 3-10s: context.
- 10-22s: point 1.
- 22-34s: point 2.
- 34-42s: payoff or takeaway.
- 42-45s: soft CTA or loop ending.

## Architecture

The repository is a Bun workspace monorepo orchestrated with Turborepo.

- Package manager: Bun workspaces.
- Task orchestration and caching: Turborepo.
- Runtime for `apps/api`: Bun.
- Runtime for `apps/worker`: Bun.
- Runtime for `apps/web`: Vite scripts launched through Bun.
- Runtime for `apps/render`: Remotion scripts may run through Node.js when Studio or rendering compatibility requires it.

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

`apps/worker` runs local worker commands on Bun. It processes pending jobs from the database, calls AI providers, writes local assets, updates asset and job records, and triggers Remotion render jobs.

`apps/render` owns Remotion compositions and render commands. It accepts a typed render input JSON and produces a local MP4. Remotion is Node-first, so render and Studio commands should be allowed to run through Node.js even though the monorepo uses Bun for package management and the API/worker runtime.

`packages/db` is the database boundary and source of truth for migrations, generated Supabase types, and DB query functions.

`packages/ai` wraps provider-specific API calls for OpenAI, Google Gemini image generation, and Google Cloud Text-to-Speech.

`packages/shared` owns schemas and types shared by web, API, worker, and render.

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
- `script_generating`
- `script_ready`
- `images_generating`
- `images_ready`
- `audio_generating`
- `audio_ready`
- `rendering`
- `done`
- `failed`

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
- `created_at`
- `updated_at`

Scene roles:

- `hook`
- `context`
- `point`
- `payoff`
- `cta`

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
- `subtitle`
- `render`
- `thumbnail`
- `render_input`

Storage drivers:

- `local`

The `path` field stores a relative portable path, not an absolute filesystem path.

Example:

```text
projects/{projectId}/scenes/{sceneId}/image.png
projects/{projectId}/scenes/{sceneId}/voice.mp3
projects/{projectId}/renders/final.mp4
projects/{projectId}/input/remotion-input.json
```

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
- `build_render_input`
- `render_video`

Job statuses:

- `pending`
- `processing`
- `succeeded`
- `failed`

The worker claims pending jobs locally and updates status in the database. Failed jobs can be retried from the UI.

### renders

Stores render attempts and final output metadata.

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
- `error_message`
- `created_at`
- `updated_at`

### prompt_versions

Stores prompts used for AI generation so outputs can be debugged and reproduced.

Key fields:

- `id`
- `project_id`
- `scene_id`
- `purpose`
- `provider`
- `model`
- `prompt`
- `response`
- `created_at`

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
          image.png
          voice.mp3
      renders/
        final.mp4
      input/
        remotion-input.json
```

## API Contract

Initial endpoints:

- `GET /health`
- `GET /projects`
- `POST /projects`
- `GET /projects/:projectId`
- `PATCH /projects/:projectId`
- `POST /projects/:projectId/generate-script`
- `PATCH /scenes/:sceneId`
- `POST /scenes/:sceneId/generate-image`
- `POST /scenes/:sceneId/generate-audio`
- `POST /projects/:projectId/build-render-input`
- `POST /projects/:projectId/render`
- `POST /jobs/:jobId/retry`
- `GET /projects/:projectId/jobs`
- `GET /projects/:projectId/assets`
- `GET /projects/:projectId/renders`

The API returns typed JSON validated by shared schemas.

## AI Provider Responsibilities

OpenAI GPT-5.5 is used for:

- topic-to-script generation
- scene breakdown
- caption drafting
- image prompt drafting
- SSML drafting

Google Gemini image generation, using the Nano Banana image model family, is used for:

- vertical scene images
- later thumbnail generation

Google Cloud Text-to-Speech is used for:

- English narration audio
- SSML-based pause and pacing control

The MVP should keep provider wrappers thin and explicit. Provider responses should be normalized into shared types before they reach app code.

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
      "imagePath": "projects/project-id/scenes/scene-id/image.png",
      "audioPath": "projects/project-id/scenes/scene-id/voice.mp3"
    }
  ]
}
```

The worker writes this input to:

```text
projects/{projectId}/input/remotion-input.json
```

Then `apps/render` renders the final MP4 to:

```text
projects/{projectId}/renders/final.mp4
```

## Error Handling

Each generation and render step writes errors to its job record. A failed scene-level job should not force the whole project to be discarded.

The UI should allow retrying:

- script generation for a project
- image generation for a scene
- audio generation for a scene
- render input generation
- video render

Provider errors should be stored with a concise message and enough provider metadata to debug the issue. Raw secrets must never be stored.

## Testing Strategy

MVP testing should focus on boundaries:

- Shared schema tests for project, scene, asset, job, and render input shapes.
- API route tests for validation and expected job creation.
- DB query tests against a local Supabase or test database where practical.
- Worker unit tests for job handlers using mocked AI providers.
- Remotion smoke test that renders a very short sample composition from local fixture assets.

Full end-to-end tests can wait until the basic flow works once manually.

## Environment Variables

Expected variables:

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
GOOGLE_API_KEY=
GOOGLE_CLOUD_TEXT_TO_SPEECH_KEY_PATH=
LOCAL_ASSET_ROOT=
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

Automated platform disclosure and upload checks are out of scope for MVP.

## Recommended Implementation Order

1. Set up monorepo tooling.
2. Create shared schemas and constants.
3. Create Supabase migrations and DB query package.
4. Create Elysia API with project and job endpoints.
5. Create React step-by-step editor shell.
6. Add OpenAI script generation.
7. Add scene image generation.
8. Add scene audio generation.
9. Add Remotion input generation.
10. Add local Remotion rendering.
11. Add retry and failure handling.
12. Add minimal smoke tests.

## Open Decisions

There are no blocking open decisions for the MVP design. Later phases can revisit authentication, cloud storage, queueing, deployment, analytics, and publishing automation.
