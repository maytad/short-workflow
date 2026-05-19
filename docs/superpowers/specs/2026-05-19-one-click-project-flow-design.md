# One-Click Project Flow Design

## Summary

Add a project-level one-click flow that turns a newly created project into a rendered local MP4 without uploading to YouTube.

The user flow is:

1. Create a project.
2. Click `Run full flow`.
3. The app generates the script, generates all scene image/audio assets, and renders the video.
4. The final MP4 appears in the existing render preview.

This feature keeps the existing manual workflow intact. The current script, asset, render, and YouTube upload controls remain available for manual use, but the one-click flow is only allowed before a project has started generation work.

## Goals

- Add one button that runs script generation, all required asset generation, and video rendering.
- Keep YouTube upload out of the one-click flow.
- Preserve existing manual step-by-step controls.
- Keep orchestration local and durable if the browser tab is closed.
- Avoid worker deadlock when `WORKER_CONCURRENCY=1`.
- Avoid duplicate work during automatic retry after a partial failure.

## Non-Goals

- No YouTube upload, private upload, or scheduled public upload automation in this flow.
- No background music.
- No cloud rendering.
- No new queue system such as Redis or BullMQ.
- No frontend-driven multi-step orchestration.
- No automatic start immediately after project creation.
- No regenerate-all behavior for projects that have already started.

## Selected Approach

Add a new project-level job type:

```text
run_project_flow
```

`POST /projects/:projectId/run-flow` creates this job after validating that the project is eligible. The worker handles the job with a dedicated `handleRunProjectFlow` handler.

The handler runs the full sequence inline rather than queueing child jobs and waiting on them. This is intentional: if a parent job claimed the only worker slot and waited for child jobs in the same queue, `WORKER_CONCURRENCY=1` would deadlock. Inline execution keeps the flow durable and compatible with conservative local worker concurrency.

Manual jobs continue to use the existing job handlers:

- `generate_script`
- `generate_scene_image`
- `generate_scene_audio`
- `render_video`
- `upload_youtube`

The implementation must extract shared step functions for script, image, audio, and render work so manual jobs and the full-flow handler call the same generation/render logic.

## Eligibility Rules

The one-click flow is intended for a fresh project after `Create project`.

The API should reject `POST /projects/:projectId/run-flow` with `409 project_has_active_jobs` when the project has any active job:

- `pending`
- `processing`

The API should reject with `409 project_flow_already_started` when the project has any evidence that generation/render work has already started:

- one or more scenes
- one or more assets
- one or more renders
- any job of type `run_project_flow`
- any job of type `generate_script`
- any job of type `generate_scene_image`
- any job of type `generate_scene_audio`
- any job of type `render_video`

`upload_youtube` is not part of the one-click flow, but an active upload still blocks through the active-job rule. In normal usage, a project with YouTube upload history will also already have render history, so it is already ineligible.

The API should return `404` when the project does not exist.

## API Design

Add:

```text
POST /projects/:projectId/run-flow
```

Successful response:

```ts
Job
```

The response is the created `run_project_flow` job. If an active job is detected before creation, the route returns `409 project_has_active_jobs`. If two identical requests race, the existing active-job uniqueness and insert-first behavior may return the concurrently created `run_project_flow` job instead of failing with a duplicate-key error.

The route should keep business logic in a service helper named:

```ts
queueProjectFullFlow(db, projectId)
```

The helper should:

1. Load the project.
2. Return a not-found signal if missing.
3. Check active jobs.
4. Check already-started evidence.
5. Create the `run_project_flow` job with input `{ projectId }`.

## Database And Migration Design

Add `run_project_flow` to the Postgres `job_type` enum and the Drizzle `jobTypeEnum`.

Update the job type and scene-id constraint so `run_project_flow` is a project-level job:

```text
run_project_flow -> scene_id is null
```

The migration must include both `migration.sql` and `down.sql`. Because PostgreSQL does not support a simple safe `DROP VALUE` for enum values in the expected migration path, `down.sql` should fail explicitly with a clear comment explaining that rollback requires manual enum recreation after deleting or rewriting any `run_project_flow` rows.

No new table is required.

## Worker Design

Add `handleRunProjectFlow(db, job)` and dispatch it from the worker handler index.

The handler should acquire an advisory transaction lock scoped to the project, for example:

```text
project-flow:<projectId>
```

This prevents accidental overlap if two workers claim equivalent work during race conditions or retries.

The handler sequence is:

1. Validate the project still exists.
2. Generate script and replace project scenes if the project has no scenes.
3. Load current scenes.
4. For each scene, generate a current image if missing or stale.
5. For each scene, generate current audio and caption timing if missing or stale.
6. Verify render preconditions with the same current-asset rules used by the existing render endpoint.
7. Render the local MP4.
8. Mark the `run_project_flow` job succeeded with compact references to created or reused records.

The job output should stay compact. A suitable shape is:

```json
{
  "sceneIds": ["..."],
  "imageAssetIds": ["..."],
  "audioAssetIds": ["..."],
  "renderId": "...",
  "outputAssetId": "..."
}
```

The exact output can include additional IDs such as prompt versions or render input asset if they are already returned by reusable step functions, but it must not store binary data or large provider payloads.

## Reusable Step Functions

Existing handlers currently own most generation logic. The implementation should extract reusable functions without changing public behavior:

- script step: generate script, insert prompt version, replace scenes, update project title/topic/status
- image step: generate current scene image and return the ready asset
- audio step: generate current scene audio/caption timing and return the ready audio asset
- render step: build render input, run Remotion, create render/input/output records, update project status

Manual handlers should become thin wrappers around those functions and still mark their own manual jobs succeeded.

The full-flow handler should call the same functions directly and mark only the parent `run_project_flow` job succeeded. It should not create child jobs for each internal step.

## Current Asset Rules

The full-flow handler should use the existing freshness rule:

An asset is current for a scene when:

- `asset.status === "ready"`
- `asset.sceneId === scene.id`
- `asset.kind` is `image` or `audio`
- `asset.createdAt >= scene.contentUpdatedAt`

On retry, the full-flow handler should skip steps that already have current outputs. This keeps automatic retry from regenerating successful image/audio assets after a later step fails.

## UI Design

Add a project-level button:

```text
Run full flow
```

Placement:

- Put the primary `Run full flow` button in the main empty-state section shown when the project has no scenes, next to the existing manual `Generate script` action.
- Keep the existing `Generate script` control available as the manual alternative.
- Do not show the full-flow button once scenes exist; at that point the project has already started and the manual workflow controls should remain the primary UI.

Button states:

- Default: `Run full flow`
- Mutation pending or active flow job: `Running full flow`
- Disabled when any active job exists
- Disabled when the project is no longer eligible for full-flow start

The existing active jobs panel should show the active `run_project_flow` job using the same status/progress treatment as other jobs. The label can be derived from the job type as `run project flow`.

When the flow succeeds, the existing project detail invalidation and active-job polling should refresh scenes, assets, renders, metadata, and the final render preview.

When the flow fails permanently, the job appears as failed in job history through existing patterns. Retry can use the existing job retry endpoint if the UI exposes failed job retry for this job type.

## Error Handling

API errors:

- `404`: project not found
- `409 project_has_active_jobs`: a pending or processing job exists for the project
- `409 project_flow_already_started`: scenes, assets, renders, or generation/render job history exists
- unexpected errors: existing API internal error handling

Worker errors:

- Provider failures use existing job retry behavior.
- Render failures use existing render failure behavior and mark the project failed when appropriate.
- Permanent full-flow failure marks the `run_project_flow` job failed through existing worker retry policy.
- Retried full-flow jobs should skip already current assets and rerun only missing/stale steps.

## Testing And Verification

Add focused tests for:

- API queues `run_project_flow` for a fresh project.
- API returns `404` for a missing project.
- API returns `409 project_has_active_jobs` when any active job exists.
- API returns `409 project_flow_already_started` when scenes/assets/renders or relevant job history exists.
- Drizzle/shared schemas accept `run_project_flow`.
- Worker dispatch calls the full-flow handler for `run_project_flow`.
- Full-flow orchestration calls steps in order and skips current assets on retry.
- Web hook calls `POST /projects/:projectId/run-flow`.
- UI disables the button when a project is ineligible or active jobs exist.

Manual verification:

- Run migration check and migrate up/down according to project migration rules.
- Manually verify `GET /health`.
- Create a fresh project, click `Run full flow`, run the worker, and confirm a local MP4 render appears.
- Confirm no YouTube upload job is created.

Per the current MVP note, do not broaden the automated test suite beyond the focused coverage above unless implementation risk requires it.

## Implementation Boundaries

- Keep `apps/web` as an API consumer only.
- Keep all database access behind `packages/db` and API/worker services.
- Keep generated files under `LOCAL_ASSET_ROOT`.
- Keep portable relative asset paths in the database.
- Do not add new dependencies for this feature.
- Do not change prompt behavior except where reusable step extraction requires preserving existing behavior.
- Do not modify YouTube upload behavior.

## Open Decisions

None. The approved behavior is fully automatic after the user clicks `Run full flow`, blocked for projects that have already started generation/render work, and excludes YouTube upload.
