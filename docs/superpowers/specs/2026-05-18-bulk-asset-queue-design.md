# Bulk Asset Queue Button Design

## Goal

Add one project-level button that queues missing or stale scene image/audio generation jobs for the whole project. The button should help move a scripted project from scenes to assets without clicking each scene and asset type one by one.

## Scope

In scope:

- Queue image jobs for scenes whose current image asset is missing or stale.
- Queue audio jobs for scenes whose current audio asset is missing or stale.
- Reuse existing `generate_scene_image` and `generate_scene_audio` jobs.
- Reuse existing active-job idempotency so the button can be clicked more than once safely.
- Show a concise UI state after clicking, including when all assets are already current.

Out of scope:

- Adding a new parent orchestration job type.
- Regenerating assets that are already current.
- Changing worker execution order or concurrency.
- Automatically rendering after assets finish.
- Adding new provider settings or prompt behavior.

## Current Definition

An asset is current for a scene when:

- `asset.status === "ready"`.
- `asset.sceneId === scene.id`.
- `asset.kind` matches the required kind, `image` or `audio`.
- `asset.createdAt >= scene.contentUpdatedAt`.

This intentionally matches the existing frontend current/stale behavior and render precondition logic.

## API Design

Add:

```text
POST /projects/:projectId/generate-assets
```

The endpoint:

1. Loads the project.
2. Returns `404` if the project does not exist.
3. Loads all project scenes, project assets, and active jobs.
4. Returns `422 project_has_no_scenes` if the project has no scenes.
5. For each scene, evaluates image and audio currentness.
6. Skips a scene/kind when the asset is already current.
7. Skips a scene/kind when an active job already exists for that scene and job type, and includes that active job in the response.
8. Calls `createJobIdempotent` for each missing or stale scene/kind.
9. Returns a summary plus the queued/existing jobs.

Response shape:

```ts
{
  jobs: Job[];
  queuedCount: number;
  existingActiveCount: number;
  skippedCurrentCount: number;
}
```

`jobs` includes newly inserted jobs and already-active jobs relevant to this request. `queuedCount` counts jobs inserted or returned by `createJobIdempotent` for missing/stale assets. `existingActiveCount` counts active jobs that were detected before queueing. `skippedCurrentCount` counts scene/kind pairs that already have current assets.

## Service Design

Add a project service helper, tentatively:

```ts
queueMissingProjectAssets(db, projectId)
```

The helper should keep the selection logic out of the route and make it easy to test without HTTP wiring.

The helper should process both asset kinds per scene:

- image -> `generate_scene_image`
- audio -> `generate_scene_audio`

For job input, keep the same shape as existing per-scene endpoints:

```ts
{ projectId: scene.projectId, sceneId: scene.id }
```

## UI Design

Add one button in the project workflow UI near the assets panel:

```text
Generate missing assets
```

Button behavior:

- Enabled only when the project has at least one scene and no local mutation is pending.
- Calls the new project endpoint once.
- Invalidates project detail, assets, and jobs through the existing workflow invalidation.
- Uses the existing active jobs polling to show progress.

User feedback:

- While request is pending: `Queueing assets`.
- If `queuedCount + existingActiveCount > 0`: show a small success message such as `Queued 8 asset jobs`.
- If no work was queued and no active jobs existed: show `All assets are current`.
- On failure: show `Asset generation could not be queued.`

The existing per-scene image/audio buttons remain for targeted regeneration.

## Error Handling

- Missing project: `404`.
- No scenes: `422 project_has_no_scenes`.
- Duplicate active jobs: return existing jobs through idempotent logic, not an error.
- Unexpected database/job errors: existing API error handling applies.

## Testing

Add focused tests for:

- The service queues image and audio for missing assets.
- The service skips current assets.
- The service queues stale assets.
- The service returns existing active jobs without duplicate insertion.
- The route returns `422 project_has_no_scenes`.
- The frontend helper/UI state treats `All assets are current` separately from queued jobs.

## Migration Impact

No database migration is required because the design reuses existing job types and constraints.

## Open Decisions

None. The selected behavior is missing/stale only.
