# Bulk Asset Queue Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a project-level button that queues missing or stale scene image/audio jobs for the whole project.

**Architecture:** Reuse the existing scene-level job types and worker handlers. Add one API endpoint that computes which scene assets are missing/stale, calls existing idempotent job creation, and returns a small summary. The web app calls the endpoint once and relies on existing active-job polling for progress.

**Tech Stack:** Bun, TypeScript, ElysiaJS, Drizzle query helpers, TanStack Query, React, Tailwind, lucide-react.

---

## Source Spec

Implement the approved design in:

`docs/superpowers/specs/2026-05-18-bulk-asset-queue-design.md`

Do not add a new job type, worker handler, database migration, automatic render trigger, provider setting, or prompt behavior.

## File Structure

- Modify `packages/shared/src/api.ts`
  - Add `bulkAssetQueueResponseSchema`.
  - Export `BulkAssetQueueResponse`.
- Modify `apps/api/src/services/projects.ts`
  - Add `queueMissingProjectAssets`.
  - Add small current-asset and active-job helpers.
- Modify `apps/api/src/services/projects.test.ts`
  - Test queue selection behavior without HTTP.
- Modify `apps/api/src/routes/projects.ts`
  - Add `POST /projects/:projectId/generate-assets`.
  - Add the service to `ProjectRouteServices` and defaults.
- Modify `apps/api/src/app.test.ts`
  - Test route success and no-scenes error behavior.
- Modify `apps/web/src/features/projects/hooks.ts`
  - Add `useGenerateProjectAssetsMutation`.
- Modify `apps/web/src/features/projects/AssetPanel.tsx`
  - Add the bulk queue button and feedback message.
  - Keep existing per-scene image/audio buttons.
- Modify `apps/web/src/features/projects/ProjectWorkflow.tsx`
  - Pass scene count into `AssetPanel`.
- Modify `apps/web/src/features/projects/workflow.test.ts`
  - Test frontend feedback helper for queued vs current states.

No new dependency should be added.

---

## Task 1: Shared API Contract

**Files:**
- Modify: `packages/shared/src/api.ts`

- [ ] **Step 1: Add the failing contract usage**

Before editing production code, add this temporary import check in a scratch command to prove the type is missing:

```bash
bun -e 'import { bulkAssetQueueResponseSchema } from "./packages/shared/src/api.ts"; console.log(bulkAssetQueueResponseSchema)'
```

Expected before implementation: fails because `bulkAssetQueueResponseSchema` is not exported.

- [ ] **Step 2: Add the response schema and type**

In `packages/shared/src/api.ts`, after `projectDetailResponseSchema`, add:

```ts
export const bulkAssetQueueResponseSchema = z
  .object({
    jobs: z.array(jobSchema),
    queuedCount: z.number().int().nonnegative(),
    existingActiveCount: z.number().int().nonnegative(),
    skippedCurrentCount: z.number().int().nonnegative(),
  })
  .strict();
```

Near the exported types, add:

```ts
export type BulkAssetQueueResponse = z.infer<typeof bulkAssetQueueResponseSchema>;
```

- [ ] **Step 3: Verify the contract exists**

Run:

```bash
bun -e 'import { bulkAssetQueueResponseSchema } from "./packages/shared/src/api.ts"; console.log(bulkAssetQueueResponseSchema.parse({ jobs: [], queuedCount: 0, existingActiveCount: 0, skippedCurrentCount: 4 }).skippedCurrentCount)'
```

Expected: prints `4`.

- [ ] **Step 4: Run focused shared check**

Run:

```bash
bun run --cwd packages/shared typecheck
```

Expected: exits `0`.

---

## Task 2: Project Asset Queue Service

**Files:**
- Modify: `apps/api/src/services/projects.ts`
- Modify: `apps/api/src/services/projects.test.ts`

- [ ] **Step 1: Add failing service tests**

Append these imports in `apps/api/src/services/projects.test.ts`:

```ts
import type { JobRow } from "@short-workflow/db";
```

Update the project service import to include the new function:

```ts
import {
  buildRenderPreconditionReport,
  buildYoutubeUploadDescription,
  queueMissingProjectAssets,
} from "./projects";
```

Add these helper functions near the existing test helpers:

```ts
function job(
  sceneId: string,
  type: Extract<JobRow["type"], "generate_scene_image" | "generate_scene_audio">,
): JobRow {
  return {
    id: crypto.randomUUID(),
    projectId,
    sceneId,
    type,
    status: "pending",
    attempts: 0,
    maxAttempts: 5,
    parentJobId: null,
    errorMessage: null,
    input: { projectId, sceneId },
    output: null,
    nextRetryAt: null,
    createdAt: new Date("2026-05-17T00:00:00.000Z"),
    startedAt: null,
    finishedAt: null,
    updatedAt: new Date("2026-05-17T00:00:00.000Z"),
  };
}

function queueDeps(input: {
  assets?: ReturnType<typeof asset>[];
  activeJobs?: JobRow[];
  scenes?: ReturnType<typeof scene>[];
}) {
  const createdInputs: unknown[] = [];

  return {
    createdInputs,
    deps: {
      createJobIdempotent: async (
        _db: never,
        jobInput: {
          projectId: string;
          sceneId: string | null;
          type: JobRow["type"];
          input: Record<string, unknown>;
          maxAttempts?: number;
        },
      ) => {
        createdInputs.push(jobInput);
        return job(jobInput.sceneId ?? currentSceneId, jobInput.type as "generate_scene_image" | "generate_scene_audio");
      },
      listProjectAssets: async () => input.assets ?? [],
      listProjectJobs: async () => input.activeJobs ?? [],
      listProjectScenes: async () =>
        input.scenes ?? [scene(currentSceneId, "ready", "2026-05-17T01:00:00.000Z")],
    },
  };
}
```

Add this describe block:

```ts
describe("queueMissingProjectAssets", () => {
  test("queues image and audio jobs for missing assets", async () => {
    const { createdInputs, deps } = queueDeps({});

    const result = await queueMissingProjectAssets({} as never, projectId, deps);

    expect(result.queuedCount).toBe(2);
    expect(result.existingActiveCount).toBe(0);
    expect(result.skippedCurrentCount).toBe(0);
    expect(result.jobs).toHaveLength(2);
    expect(createdInputs).toEqual([
      {
        projectId,
        sceneId: currentSceneId,
        type: "generate_scene_image",
        input: { projectId, sceneId: currentSceneId },
      },
      {
        projectId,
        sceneId: currentSceneId,
        type: "generate_scene_audio",
        input: { projectId, sceneId: currentSceneId },
      },
    ]);
  });

  test("skips current image and audio assets", async () => {
    const { createdInputs, deps } = queueDeps({
      assets: [
        asset(currentSceneId, "image", "2026-05-17T01:00:00.000Z"),
        asset(currentSceneId, "audio", "2026-05-17T01:00:00.000Z"),
      ],
    });

    const result = await queueMissingProjectAssets({} as never, projectId, deps);

    expect(result).toMatchObject({
      queuedCount: 0,
      existingActiveCount: 0,
      skippedCurrentCount: 2,
      jobs: [],
    });
    expect(createdInputs).toEqual([]);
  });

  test("queues stale assets and returns existing active jobs", async () => {
    const activeAudioJob = job(staleSceneId, "generate_scene_audio");
    const { createdInputs, deps } = queueDeps({
      activeJobs: [activeAudioJob],
      assets: [asset(staleSceneId, "image", "2026-05-17T01:59:59.000Z")],
      scenes: [scene(staleSceneId, "ready", "2026-05-17T02:00:00.000Z")],
    });

    const result = await queueMissingProjectAssets({} as never, projectId, deps);

    expect(result.queuedCount).toBe(1);
    expect(result.existingActiveCount).toBe(1);
    expect(result.skippedCurrentCount).toBe(0);
    expect(result.jobs).toHaveLength(2);
    expect(createdInputs).toEqual([
      {
        projectId,
        sceneId: staleSceneId,
        type: "generate_scene_image",
        input: { projectId, sceneId: staleSceneId },
      },
    ]);
  });

  test("throws when the project has no scenes", async () => {
    const { deps } = queueDeps({ scenes: [] });

    await expect(queueMissingProjectAssets({} as never, projectId, deps)).rejects.toThrow(
      "project_has_no_scenes",
    );
  });
});
```

- [ ] **Step 2: Run service tests to verify they fail**

Run:

```bash
bun test apps/api/src/services/projects.test.ts
```

Expected before implementation: fails because `queueMissingProjectAssets` is not exported.

- [ ] **Step 3: Add service imports and helper types**

In `apps/api/src/services/projects.ts`, add `createJobIdempotent` and the response type to imports:

```ts
import {
  createJobIdempotent,
  deleteProjectRows,
  getProject,
  listProjectAssets,
  listProjectRenders,
  listProjectScenes,
  type AssetRow,
  type DbClient,
  type JobRow,
  type SceneRow,
} from "@short-workflow/db";
import type { BulkAssetQueueResponse } from "@short-workflow/shared";
```

Add these types and constants near the existing `RenderPreconditionDeps` type:

```ts
type QueueAssetKind = Extract<AssetRow["kind"], "image" | "audio">;
type QueueAssetJobType = Extract<JobRow["type"], "generate_scene_image" | "generate_scene_audio">;

const assetQueueKinds: QueueAssetKind[] = ["image", "audio"];

const assetJobTypeByKind: Record<QueueAssetKind, QueueAssetJobType> = {
  audio: "generate_scene_audio",
  image: "generate_scene_image",
};

type QueueMissingProjectAssetsDeps = {
  createJobIdempotent: typeof createJobIdempotent;
  listProjectAssets: typeof listProjectAssets;
  listProjectJobs: typeof listProjectJobs;
  listProjectScenes: typeof listProjectScenes;
};

const defaultQueueMissingProjectAssetsDeps: QueueMissingProjectAssetsDeps = {
  createJobIdempotent,
  listProjectAssets,
  listProjectJobs,
  listProjectScenes,
};
```

- [ ] **Step 4: Add current asset and active job helpers**

In `apps/api/src/services/projects.ts`, add these helpers before `buildRenderPreconditionReport`:

```ts
function hasCurrentSceneAsset(
  assets: Pick<AssetRow, "createdAt" | "kind" | "sceneId" | "status">[],
  scene: Pick<SceneRow, "contentUpdatedAt" | "id">,
  kind: QueueAssetKind,
) {
  return assets.some(
    (asset) =>
      asset.sceneId === scene.id &&
      asset.kind === kind &&
      asset.status === "ready" &&
      asset.createdAt.getTime() >= scene.contentUpdatedAt.getTime(),
  );
}

function findActiveAssetJob(
  activeJobs: Pick<JobRow, "sceneId" | "status" | "type">[],
  sceneId: string,
  type: QueueAssetJobType,
) {
  return activeJobs.find(
    (job) =>
      job.sceneId === sceneId &&
      job.type === type &&
      (job.status === "pending" || job.status === "processing"),
  );
}
```

- [ ] **Step 5: Add the queue service**

In `apps/api/src/services/projects.ts`, add:

```ts
export async function queueMissingProjectAssets(
  db: DbClient,
  projectId: string,
  deps: QueueMissingProjectAssetsDeps = defaultQueueMissingProjectAssetsDeps,
): Promise<BulkAssetQueueResponse> {
  const [scenes, assets, activeJobs] = await Promise.all([
    deps.listProjectScenes(db, projectId),
    deps.listProjectAssets(db, projectId),
    deps.listProjectJobs(db, projectId, "active"),
  ]);

  if (scenes.length === 0) {
    throw new Error("project_has_no_scenes");
  }

  const jobs: JobRow[] = [];
  let queuedCount = 0;
  let existingActiveCount = 0;
  let skippedCurrentCount = 0;

  for (const scene of scenes) {
    for (const kind of assetQueueKinds) {
      const type = assetJobTypeByKind[kind];

      if (hasCurrentSceneAsset(assets, scene, kind)) {
        skippedCurrentCount += 1;
        continue;
      }

      const activeJob = findActiveAssetJob(activeJobs, scene.id, type);
      if (activeJob) {
        jobs.push(activeJob as JobRow);
        existingActiveCount += 1;
        continue;
      }

      jobs.push(
        await deps.createJobIdempotent(db, {
          projectId: scene.projectId,
          sceneId: scene.id,
          type,
          input: { projectId: scene.projectId, sceneId: scene.id },
        }),
      );
      queuedCount += 1;
    }
  }

  return {
    jobs,
    queuedCount,
    existingActiveCount,
    skippedCurrentCount,
  };
}
```

- [ ] **Step 6: Run service tests**

Run:

```bash
bun test apps/api/src/services/projects.test.ts
```

Expected: all service tests pass.

---

## Task 3: API Route Wiring

**Files:**
- Modify: `apps/api/src/routes/projects.ts`
- Modify: `apps/api/src/app.test.ts`

- [ ] **Step 1: Add failing route tests**

In `apps/api/src/app.test.ts`, add `queueMissingProjectAssets` to `createServices` defaults:

```ts
queueMissingProjectAssets: async () => ({
  jobs: [],
  queuedCount: 0,
  existingActiveCount: 0,
  skippedCurrentCount: 0,
}),
```

Then add these tests near the existing project job creation route tests:

```ts
test("queues missing project assets", async () => {
  const app = createApp({
    db: {} as never,
    projectServices: createServices({
      queueMissingProjectAssets: async () => ({
        jobs: [job],
        queuedCount: 1,
        existingActiveCount: 0,
        skippedCurrentCount: 3,
      }),
    }),
  });

  const response = await app.handle(
    request(`/projects/${project.id}/generate-assets`, { method: "POST" }),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    jobs: [{ id: job.id }],
    queuedCount: 1,
    existingActiveCount: 0,
    skippedCurrentCount: 3,
  });
});

test("returns no-scenes error for project asset queue", async () => {
  const app = createApp({
    db: {} as never,
    projectServices: createServices({
      queueMissingProjectAssets: async () => {
        throw new Error("project_has_no_scenes");
      },
    }),
  });

  const response = await app.handle(
    request(`/projects/${project.id}/generate-assets`, { method: "POST" }),
  );

  expect(response.status).toBe(422);
  expect(await response.json()).toEqual({ error: "project_has_no_scenes" });
});
```

- [ ] **Step 2: Run route tests to verify they fail**

Run:

```bash
bun test apps/api/src/app.test.ts
```

Expected before implementation: fails because `queueMissingProjectAssets` is not on `ProjectRouteServices` or because the route is missing.

- [ ] **Step 3: Wire the service into route services**

In `apps/api/src/routes/projects.ts`, import the helper:

```ts
import {
  assertProjectCanDelete,
  buildRenderPreconditionReport,
  buildYoutubeUploadJobInput,
  deleteProjectLocalFiles,
  deleteProjectRows,
  getProjectDetail,
  queueMissingProjectAssets,
  readAssetFile,
  revealAssetFile,
} from "../services/projects";
```

Add it to `ProjectRouteServices`:

```ts
queueMissingProjectAssets: typeof queueMissingProjectAssets;
```

Add it to `defaultServices`:

```ts
queueMissingProjectAssets,
```

- [ ] **Step 4: Add the route**

In `apps/api/src/routes/projects.ts`, add this project route after `generate-script` and before `render`:

```ts
.post("/:projectId/generate-assets", async (context) => {
  const { db, params, set } = withRouteContext(context);
  const projectId = requireRouteParam(params.projectId, "projectId");
  const project = await services.getProject(db, projectId);

  if (!project) {
    return notFound(set);
  }

  try {
    return await services.queueMissingProjectAssets(db, project.id);
  } catch (error) {
    if (error instanceof Error && error.message === "project_has_no_scenes") {
      return jsonError(set, 422, "project_has_no_scenes");
    }

    throw error;
  }
})
```

- [ ] **Step 5: Run API tests and typecheck**

Run:

```bash
bun test apps/api/src/services/projects.test.ts
bun test apps/api/src/app.test.ts
bun run --cwd apps/api typecheck
```

Expected: all commands exit `0`.

---

## Task 4: Web Hook And Asset Panel Button

**Files:**
- Modify: `apps/web/src/features/projects/hooks.ts`
- Modify: `apps/web/src/features/projects/AssetPanel.tsx`
- Modify: `apps/web/src/features/projects/ProjectWorkflow.tsx`
- Modify: `apps/web/src/features/projects/workflow.test.ts`

- [ ] **Step 1: Add failing frontend helper tests**

In `apps/web/src/features/projects/workflow.test.ts`, update the AssetPanel import:

```ts
import {
  assetQueueFeedbackMessage,
  getLatestSceneAsset,
  isAssetCurrentForScene,
} from "./AssetPanel";
```

Add tests:

```ts
describe("asset queue feedback helpers", () => {
  test("formats queued asset job feedback", () => {
    expect(
      assetQueueFeedbackMessage({
        jobs: [],
        queuedCount: 6,
        existingActiveCount: 2,
        skippedCurrentCount: 4,
      }),
    ).toBe("Queued 8 asset jobs.");
  });

  test("formats all-current asset feedback", () => {
    expect(
      assetQueueFeedbackMessage({
        jobs: [],
        queuedCount: 0,
        existingActiveCount: 0,
        skippedCurrentCount: 8,
      }),
    ).toBe("All assets are current.");
  });
});
```

- [ ] **Step 2: Run web tests to verify they fail**

Run:

```bash
bun test apps/web/src/features/projects/workflow.test.ts
```

Expected before implementation: fails because `assetQueueFeedbackMessage` is not exported.

- [ ] **Step 3: Add the web mutation**

In `apps/web/src/features/projects/hooks.ts`, import the shared response type:

```ts
import type {
  BulkAssetQueueResponse,
  CreateProjectRequest,
  CreateTinyMechanismsProjectRequest,
  Job,
  Project,
  ProjectDetailResponse,
  Scene,
  UpdateSceneRequest,
  YoutubeAuthStartResponse,
  YoutubeAuthStatus,
} from "@short-workflow/shared";
```

Add the mutation before `useGenerateScriptMutation`:

```ts
export function useGenerateProjectAssetsMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<BulkAssetQueueResponse>(`/projects/${projectId}/generate-assets`, {
        method: "POST",
      }),
    onSuccess: () => invalidateProjectWorkflow(queryClient, projectId),
  });
}
```

- [ ] **Step 4: Add feedback helper and props**

In `apps/web/src/features/projects/AssetPanel.tsx`, update imports:

```ts
import type { Asset, BulkAssetQueueResponse, Job, Scene } from "@short-workflow/shared";
import { Image, Layers3, Loader2, Music2, RefreshCw } from "lucide-react";
import { useState } from "react";
```

Update hooks import:

```ts
import {
  useGenerateProjectAssetsMutation,
  useGenerateSceneAudioMutation,
  useGenerateSceneImageMutation,
} from "./hooks";
```

Add the helper near the other exported helpers:

```ts
export function assetQueueFeedbackMessage(result: BulkAssetQueueResponse) {
  const activeOrQueued = result.queuedCount + result.existingActiveCount;

  if (activeOrQueued > 0) {
    return `Queued ${activeOrQueued} asset ${activeOrQueued === 1 ? "job" : "jobs"}.`;
  }

  return "All assets are current.";
}
```

Add `sceneCount` to props:

```ts
type AssetPanelProps = {
  activeJobs: Job[];
  assets: Asset[];
  projectId: string;
  sceneCount: number;
  selectedScene: Scene | null;
};
```

- [ ] **Step 5: Add the bulk queue button**

In `AssetPanel`, initialize mutation and feedback:

```ts
const [assetQueueMessage, setAssetQueueMessage] = useState<string | null>(null);
const projectAssetsMutation = useGenerateProjectAssetsMutation(projectId);

const queueProjectAssets = async () => {
  setAssetQueueMessage(null);
  const result = await projectAssetsMutation.mutateAsync();
  setAssetQueueMessage(assetQueueFeedbackMessage(result));
};
```

Use the same code in the `!selectedScene` branch and the normal branch by adding this button block near the top of each returned section:

```tsx
<button
  className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
  disabled={sceneCount === 0 || projectAssetsMutation.isPending}
  onClick={() => void queueProjectAssets()}
  type="button"
>
  {projectAssetsMutation.isPending ? (
    <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
  ) : (
    <Layers3 className="size-4 shrink-0" aria-hidden="true" />
  )}
  <span className="whitespace-nowrap">
    {projectAssetsMutation.isPending ? "Queueing assets" : "Generate missing assets"}
  </span>
</button>

{assetQueueMessage ? (
  <p className="mt-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
    {assetQueueMessage}
  </p>
) : null}
```

In the existing error block, include `projectAssetsMutation.error`:

```tsx
{imageMutation.error || audioMutation.error || projectAssetsMutation.error ? (
  <p className="mt-3 rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent-foreground">
    Asset generation could not be queued.
  </p>
) : null}
```

If duplicating the button block makes the file noisy, extract a local `ProjectAssetQueueButton` component in the same file. Keep it private to `AssetPanel.tsx`.

- [ ] **Step 6: Pass scene count**

In `apps/web/src/features/projects/ProjectWorkflow.tsx`, update the `AssetPanel` call:

```tsx
<AssetPanel
  activeJobs={activeWorkflowJobs}
  assets={detail.assets}
  projectId={projectId}
  sceneCount={detail.scenes.length}
  selectedScene={selectedScene}
/>
```

- [ ] **Step 7: Run web checks**

Run:

```bash
bun test apps/web/src/features/projects/workflow.test.ts
bun run --cwd apps/web typecheck
```

Expected: both commands exit `0`.

---

## Task 5: Final Verification

**Files:**
- Check all files touched by Tasks 1-4.

- [ ] **Step 1: Run focused tests**

Run:

```bash
bun test apps/api/src/services/projects.test.ts
bun test apps/api/src/app.test.ts
bun test apps/web/src/features/projects/workflow.test.ts
```

Expected: all commands exit `0`.

- [ ] **Step 2: Run focused typechecks**

Run:

```bash
bun run --cwd packages/shared typecheck
bun run --cwd apps/api typecheck
bun run --cwd apps/web typecheck
```

Expected: all commands exit `0`.

- [ ] **Step 3: Run diff checks**

Run:

```bash
git diff --check
git diff --stat
```

Expected: no whitespace errors. Diff should include only shared API, API project service/routes/tests, and web project feature files for this feature.

## Self-Review

- Spec coverage: The plan implements missing/stale-only project asset queueing, active-job idempotency, no-scenes error handling, the project-level button, feedback states, and focused tests.
- Scope check: The plan does not add a new job type, migration, worker handler, automatic render, or provider setting.
- Type consistency: Shared response type is `BulkAssetQueueResponse`; API service is `queueMissingProjectAssets`; route path is `POST /projects/:projectId/generate-assets`; frontend mutation is `useGenerateProjectAssetsMutation`.
