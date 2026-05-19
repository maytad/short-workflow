# One-Click Project Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Run full flow` button that runs script generation, all scene image/audio asset generation, and local Remotion rendering for a fresh project, without uploading to YouTube.

**Architecture:** Add a new project-level `run_project_flow` job type. The API queues it only for fresh projects. The worker handles it as one durable parent job by calling extracted reusable generation/render step functions inline, so the flow cannot deadlock when worker concurrency is one.

**Tech Stack:** Bun workspaces, ElysiaJS, React + Vite, TanStack Query, Drizzle ORM, hosted Supabase Postgres, Bun worker, Remotion render subprocess.

---

## File Structure

- Modify `packages/shared/src/constants.ts`: add `run_project_flow` to `JOB_TYPES`.
- Modify `packages/shared/src/schemas.test.ts`: add schema coverage for the new job type.
- Modify `packages/db/src/schema.ts`: add `run_project_flow` to the Drizzle enum and project-level scene-id check.
- Create `packages/db/migrations/0006_add_run_project_flow_job/migration.sql`: add the Postgres enum value and update the check constraint.
- Create `packages/db/migrations/0006_add_run_project_flow_job/down.sql`: explicit failing rollback for enum value removal.
- Modify `apps/api/src/services/projects.ts`: add fresh-project eligibility and `queueProjectFullFlow`.
- Modify `apps/api/src/services/projects.test.ts`: service tests for queueing, active-job blocking, and already-started blocking.
- Modify `apps/api/src/routes/projects.ts`: expose `POST /projects/:projectId/run-flow`.
- Modify `apps/api/src/app.test.ts`: route tests for successful queueing and conflict mapping.
- Modify `apps/worker/src/handlers/generateScript.ts`: extract `generateProjectScript`.
- Modify `apps/worker/src/handlers/generateSceneImage.ts`: extract `generateCurrentSceneImage`.
- Modify `apps/worker/src/handlers/generateSceneAudio.ts`: extract `generateCurrentSceneAudio`.
- Modify `apps/worker/src/handlers/renderVideo.ts`: extract `renderProjectVideo`.
- Create `apps/worker/src/handlers/runProjectFlow.ts`: orchestrate the full flow using reusable step functions.
- Create `apps/worker/src/handlers/runProjectFlow.test.ts`: test ordering and current-asset skip behavior.
- Modify `apps/worker/src/handlers/index.ts`: dispatch `run_project_flow`.
- Modify `apps/web/src/features/projects/hooks.ts`: add `useRunProjectFlowMutation`.
- Modify `apps/web/src/features/projects/ProjectWorkflow.tsx`: add the full-flow button to the no-scenes empty state.
- Modify `apps/web/src/features/projects/workflow.test.ts`: add eligibility helper coverage.

Implementation note: Use the existing `withAdvisoryTransactionLock` for the API eligibility and queue insert section, not around provider or render calls. Holding a Postgres transaction open across AI calls and Remotion rendering would be unsafe on Supabase Free Tier. Worker overlap is already constrained by the active project-level job uniqueness rule and atomic job claiming.

---

### Task 1: Add Job Type Contract And Migration

**Files:**
- Modify: `packages/shared/src/constants.ts`
- Modify: `packages/shared/src/schemas.test.ts`
- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/migrations/0006_add_run_project_flow_job/migration.sql`
- Create: `packages/db/migrations/0006_add_run_project_flow_job/down.sql`

- [ ] **Step 1: Write the shared schema test**

Append this test to `packages/shared/src/schemas.test.ts` inside `describe("shared API schemas", () => { ... })`:

```ts
  test("accepts one-click project flow jobs", () => {
    const result = jobSchema.parse({
      attempts: 0,
      createdAt: "2026-05-19T00:00:00.000Z",
      errorMessage: null,
      finishedAt: null,
      id: "11111111-1111-4111-8111-111111111111",
      input: { projectId: "22222222-2222-4222-8222-222222222222" },
      maxAttempts: 5,
      nextRetryAt: null,
      output: null,
      parentJobId: null,
      projectId: "22222222-2222-4222-8222-222222222222",
      sceneId: null,
      startedAt: null,
      status: "pending",
      type: "run_project_flow",
      updatedAt: "2026-05-19T00:00:00.000Z",
    });

    expect(result.type).toBe("run_project_flow");
  });
```

Update the import at the top of `packages/shared/src/schemas.test.ts`:

```ts
import { createProjectRequestSchema, renderPreconditionErrorSchema } from "./api";
import { jobSchema } from "./schemas";
```

- [ ] **Step 2: Run the failing shared schema test**

Run:

```bash
bun test packages/shared/src/schemas.test.ts
```

Expected: FAIL because `run_project_flow` is not currently in `JOB_TYPES`.

- [ ] **Step 3: Add the shared job type**

In `packages/shared/src/constants.ts`, replace `JOB_TYPES` with:

```ts
export const JOB_TYPES = [
  "generate_script",
  "generate_scene_image",
  "generate_scene_audio",
  "render_video",
  "upload_youtube",
  "run_project_flow",
] as const;
```

- [ ] **Step 4: Add the Drizzle enum and check constraint branch**

In `packages/db/src/schema.ts`, update `jobTypeEnum`:

```ts
export const jobTypeEnum = pgEnum("job_type", [
  "generate_script",
  "generate_scene_image",
  "generate_scene_audio",
  "render_video",
  "upload_youtube",
  "run_project_flow",
]);
```

In the `jobs_scene_id_per_type` check, add the project-level branch:

```ts
          when 'run_project_flow' then ${table.sceneId} is null
```

The full check should read:

```ts
    check(
      "jobs_scene_id_per_type",
      sql`
        case ${table.type}::text
          when 'generate_script' then ${table.sceneId} is null
          when 'render_video' then ${table.sceneId} is null
          when 'upload_youtube' then ${table.sceneId} is null
          when 'run_project_flow' then ${table.sceneId} is null
          when 'generate_scene_image' then ${table.sceneId} is not null
          when 'generate_scene_audio' then ${table.sceneId} is not null
          else false
        end
      `,
    ),
```

- [ ] **Step 5: Create the migration SQL**

Create `packages/db/migrations/0006_add_run_project_flow_job/migration.sql`:

```sql
alter type job_type add value if not exists 'run_project_flow';

alter table jobs drop constraint jobs_scene_id_per_type;

alter table jobs add constraint jobs_scene_id_per_type check (
  case type::text
    when 'generate_script' then scene_id is null
    when 'render_video' then scene_id is null
    when 'upload_youtube' then scene_id is null
    when 'run_project_flow' then scene_id is null
    when 'generate_scene_image' then scene_id is not null
    when 'generate_scene_audio' then scene_id is not null
    else false
  end
);
```

Create `packages/db/migrations/0006_add_run_project_flow_job/down.sql`:

```sql
-- Postgres does not support DROP VALUE on an enum type. Rolling back would
-- require recreating job_type, casting every jobs row, and dropping the new
-- type. We refuse to encode that here. If a true rollback is needed, write a
-- one-off migration after confirming no rows use 'run_project_flow'.
do $$
begin
  if exists (
    select 1 from jobs
    where type::text = 'run_project_flow'
  ) then
    raise exception 'down_blocked_rows_use_run_project_flow';
  end if;
  raise exception 'down_blocked_enum_value_drop_not_supported';
end$$;
```

- [ ] **Step 6: Verify shared and migration contracts**

Run:

```bash
bun test packages/shared/src/schemas.test.ts
bun run db:check
bun run --cwd packages/db typecheck
```

Expected:

- shared schema test passes
- `db:check` prints `Checked 6 migration folders`
- db typecheck exits successfully

- [ ] **Step 7: Commit the contract and migration**

Run:

```bash
git add packages/shared/src/constants.ts packages/shared/src/schemas.test.ts packages/db/src/schema.ts packages/db/migrations/0006_add_run_project_flow_job/migration.sql packages/db/migrations/0006_add_run_project_flow_job/down.sql
git commit -m "feat: add run project flow job type"
```

---

### Task 2: Add API Full-Flow Eligibility Service

**Files:**
- Modify: `apps/api/src/services/projects.ts`
- Modify: `apps/api/src/services/projects.test.ts`

- [ ] **Step 1: Add service tests**

Append this block to `apps/api/src/services/projects.test.ts`:

```ts
const fullFlowProject = {
  id: "55555555-5555-4555-8555-555555555555",
  title: "Fresh project",
  topic: "A topic",
  status: "draft",
  targetDurationSeconds: 45,
  language: "en",
  format: "vertical_9_16",
  createdAt: new Date("2026-05-19T00:00:00.000Z"),
  updatedAt: new Date("2026-05-19T00:00:00.000Z"),
} as const;

const fullFlowJob = {
  id: "66666666-6666-4666-8666-666666666666",
  projectId: fullFlowProject.id,
  sceneId: null,
  type: "run_project_flow",
  status: "pending",
  attempts: 0,
  maxAttempts: 5,
  parentJobId: null,
  errorMessage: null,
  input: { projectId: fullFlowProject.id },
  output: null,
  nextRetryAt: null,
  createdAt: new Date("2026-05-19T00:00:00.000Z"),
  startedAt: null,
  finishedAt: null,
  updatedAt: new Date("2026-05-19T00:00:00.000Z"),
} as const;

function fullFlowDeps(input: {
  activeJobs?: JobRow[];
  allJobs?: JobRow[];
  assets?: ReturnType<typeof asset>[];
  project?: typeof fullFlowProject | null;
  renders?: RenderRow[];
  scenes?: ReturnType<typeof scene>[];
} = {}) {
  const createdInputs: {
    projectId: string;
    sceneId: string | null;
    type: JobRow["type"];
    input: Record<string, unknown>;
    maxAttempts?: number;
  }[] = [];

  return {
    createdInputs,
    deps: {
      createJobIdempotent: async (_db: DbClient, jobInput: (typeof createdInputs)[number]) => {
        createdInputs.push(jobInput);
        return fullFlowJob;
      },
      getProject: async () => input.project ?? fullFlowProject,
      listProjectAssets: async () => input.assets ?? [],
      listProjectJobs: async (_db: DbClient, _projectId: string, status?: "active") =>
        status === "active" ? (input.activeJobs ?? []) : (input.allJobs ?? []),
      listProjectRenders: async () => input.renders ?? [],
      listProjectScenes: async () => input.scenes ?? [],
      withAdvisoryTransactionLock: async <T>(
        _db: DbClient,
        _key: string,
        callback: (tx: DbClient) => Promise<T>,
      ) => callback({} as DbClient),
    },
  };
}

describe("queueProjectFullFlow", () => {
  test("queues one-click flow for a fresh project", async () => {
    const { createdInputs, deps } = fullFlowDeps();

    const result = await queueProjectFullFlow({} as never, fullFlowProject.id, deps);

    expect(result).toEqual({ status: "queued", job: fullFlowJob });
    expect(createdInputs).toEqual([
      {
        projectId: fullFlowProject.id,
        sceneId: null,
        type: "run_project_flow",
        input: { projectId: fullFlowProject.id },
      },
    ]);
  });

  test("returns not_found when the project is missing", async () => {
    const { deps } = fullFlowDeps({ project: null });

    await expect(queueProjectFullFlow({} as never, fullFlowProject.id, deps)).resolves.toEqual({
      status: "not_found",
    });
  });

  test("blocks while any project job is active", async () => {
    const { createdInputs, deps } = fullFlowDeps({ activeJobs: [fullFlowJob] });

    await expect(queueProjectFullFlow({} as never, fullFlowProject.id, deps)).resolves.toEqual({
      status: "active_jobs",
    });
    expect(createdInputs).toEqual([]);
  });

  test("blocks when generation or render work already started", async () => {
    const { createdInputs, deps } = fullFlowDeps({
      allJobs: [{ ...fullFlowJob, status: "succeeded", type: "generate_script" }],
    });

    await expect(queueProjectFullFlow({} as never, fullFlowProject.id, deps)).resolves.toEqual({
      status: "already_started",
    });
    expect(createdInputs).toEqual([]);
  });

  test("blocks when scenes already exist", async () => {
    const { deps } = fullFlowDeps({
      scenes: [scene(currentSceneId, "ready", "2026-05-19T00:00:00.000Z")],
    });

    await expect(queueProjectFullFlow({} as never, fullFlowProject.id, deps)).resolves.toEqual({
      status: "already_started",
    });
  });
});
```

Update the import block in `apps/api/src/services/projects.test.ts`:

```ts
import type { DbClient, JobRow, RenderRow } from "@short-workflow/db";

import {
  buildRenderPreconditionReport,
  buildYoutubeUploadDescription,
  queueMissingProjectAssets,
  queueProjectFullFlow,
} from "./projects";
```

- [ ] **Step 2: Run the failing service tests**

Run:

```bash
bun test apps/api/src/services/projects.test.ts
```

Expected: FAIL because `queueProjectFullFlow` is not exported.

- [ ] **Step 3: Add the service helper**

In `apps/api/src/services/projects.ts`, extend imports from `@short-workflow/db`:

```ts
  withAdvisoryTransactionLock,
```

Add these types and constants near the queue helper types:

```ts
type QueueProjectFullFlowDeps = {
  createJobIdempotent: typeof createJobIdempotent;
  getProject: typeof getProject;
  listProjectAssets: typeof listProjectAssets;
  listProjectJobs: typeof listProjectJobs;
  listProjectRenders: typeof listProjectRenders;
  listProjectScenes: typeof listProjectScenes;
  withAdvisoryTransactionLock: typeof withAdvisoryTransactionLock;
};

export type QueueProjectFullFlowResult =
  | { status: "queued"; job: JobRow }
  | { status: "not_found" }
  | { status: "active_jobs" }
  | { status: "already_started" };

const fullFlowStartedJobTypes = new Set<JobRow["type"]>([
  "run_project_flow",
  "generate_script",
  "generate_scene_image",
  "generate_scene_audio",
  "render_video",
]);

const defaultQueueProjectFullFlowDeps: QueueProjectFullFlowDeps = {
  createJobIdempotent,
  getProject,
  listProjectAssets,
  listProjectJobs,
  listProjectRenders,
  listProjectScenes,
  withAdvisoryTransactionLock,
};
```

Add this function before `queueMissingProjectAssets`:

```ts
export async function queueProjectFullFlow(
  db: DbClient,
  projectId: string,
  deps: QueueProjectFullFlowDeps = defaultQueueProjectFullFlowDeps,
): Promise<QueueProjectFullFlowResult> {
  return deps.withAdvisoryTransactionLock(db, `project-flow:${projectId}`, async (tx) => {
    const project = await deps.getProject(tx, projectId);

    if (!project) {
      return { status: "not_found" };
    }

    const activeJobs = await deps.listProjectJobs(tx, project.id, "active");
    if (activeJobs.length > 0) {
      return { status: "active_jobs" };
    }

    const [scenes, assets, renders, jobs] = await Promise.all([
      deps.listProjectScenes(tx, project.id),
      deps.listProjectAssets(tx, project.id),
      deps.listProjectRenders(tx, project.id),
      deps.listProjectJobs(tx, project.id),
    ]);

    const hasStarted =
      scenes.length > 0 ||
      assets.length > 0 ||
      renders.length > 0 ||
      jobs.some((job) => fullFlowStartedJobTypes.has(job.type));

    if (hasStarted) {
      return { status: "already_started" };
    }

    const job = await deps.createJobIdempotent(tx, {
      projectId: project.id,
      sceneId: null,
      type: "run_project_flow",
      input: { projectId: project.id },
    });

    return { status: "queued", job };
  });
}
```

- [ ] **Step 4: Run service tests**

Run:

```bash
bun test apps/api/src/services/projects.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the API service helper**

Run:

```bash
git add apps/api/src/services/projects.ts apps/api/src/services/projects.test.ts
git commit -m "feat: add project flow queue service"
```

---

### Task 3: Add Full-Flow API Route

**Files:**
- Modify: `apps/api/src/routes/projects.ts`
- Modify: `apps/api/src/app.test.ts`

- [ ] **Step 1: Add route tests**

In `apps/api/src/app.test.ts`, add a `fullFlowJob` fixture near the other job fixtures:

```ts
const fullFlowJob = {
  ...job,
  id: "99999999-9999-4999-8999-999999999999",
  type: "run_project_flow",
  input: { projectId: project.id },
} as const;
```

Add these tests near the existing generation route tests:

```ts
  test("queues a one-click project flow job", async () => {
    const app = createApp({
      db: testDb,
      projectServices: createServices({
        queueProjectFullFlow: async () => ({ status: "queued", job: fullFlowJob }),
      }),
    });

    const response = await app.handle(
      request(`/projects/${project.id}/run-flow`, { method: "POST" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: fullFlowJob.id,
      type: "run_project_flow",
    });
  });

  test("maps active jobs to one-click flow conflict", async () => {
    const app = createApp({
      db: testDb,
      projectServices: createServices({
        queueProjectFullFlow: async () => ({ status: "active_jobs" }),
      }),
    });

    const response = await app.handle(
      request(`/projects/${project.id}/run-flow`, { method: "POST" }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "project_has_active_jobs" });
  });

  test("maps already-started projects to one-click flow conflict", async () => {
    const app = createApp({
      db: testDb,
      projectServices: createServices({
        queueProjectFullFlow: async () => ({ status: "already_started" }),
      }),
    });

    const response = await app.handle(
      request(`/projects/${project.id}/run-flow`, { method: "POST" }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "project_flow_already_started" });
  });
```

Add the default service implementation in `createServices`:

```ts
    queueProjectFullFlow: async () => ({ status: "queued", job: fullFlowJob }),
```

- [ ] **Step 2: Run the failing route tests**

Run:

```bash
bun test apps/api/src/app.test.ts
```

Expected: FAIL because `queueProjectFullFlow` is not part of `ProjectRouteServices` and `/run-flow` does not exist.

- [ ] **Step 3: Wire the route service**

In `apps/api/src/routes/projects.ts`, add `queueProjectFullFlow` to the service imports from `../services/projects`:

```ts
  queueProjectFullFlow,
```

Add it to `ProjectRouteServices`:

```ts
  queueProjectFullFlow: typeof queueProjectFullFlow;
```

Add it to `defaultServices`:

```ts
  queueProjectFullFlow,
```

Add this route before `generate-script`:

```ts
        .post("/:projectId/run-flow", async (context) => {
          const { db, params, set } = withRouteContext(context);
          const projectId = requireRouteParam(params.projectId, "projectId");
          const result = await services.queueProjectFullFlow(db, projectId);

          switch (result.status) {
            case "queued":
              return result.job;
            case "not_found":
              return notFound(set);
            case "active_jobs":
              return conflict(set, "project_has_active_jobs");
            case "already_started":
              return conflict(set, "project_flow_already_started");
            default: {
              const exhaustiveResult: never = result;
              throw new Error(`unknown_project_flow_result:${exhaustiveResult}`);
            }
          }
        })
```

- [ ] **Step 4: Run API tests and typecheck**

Run:

```bash
bun test apps/api/src/app.test.ts apps/api/src/services/projects.test.ts
bun run --cwd apps/api typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit the API route**

Run:

```bash
git add apps/api/src/routes/projects.ts apps/api/src/app.test.ts
git commit -m "feat: add project flow route"
```

---

### Task 4: Extract Reusable Worker Step Functions

**Files:**
- Modify: `apps/worker/src/handlers/generateScript.ts`
- Modify: `apps/worker/src/handlers/generateSceneImage.ts`
- Modify: `apps/worker/src/handlers/generateSceneAudio.ts`
- Modify: `apps/worker/src/handlers/renderVideo.ts`

- [ ] **Step 1: Extract `generateProjectScript`**

In `apps/worker/src/handlers/generateScript.ts`, add this type above `handleGenerateScript`:

```ts
export type GenerateProjectScriptResult = {
  sceneIds: string[];
  promptVersionId: string;
  seedId: string;
  channelPresetId: string;
  metadataDraft: unknown;
};
```

Add this function above `handleGenerateScript`:

```ts
export async function generateProjectScript(
  db: DbClient,
  projectId: string,
  options: { jobId?: string } = {},
): Promise<GenerateProjectScriptResult> {
  const { project, seed } = await reserveTinyMechanismsSeed(db, projectId);
  const scriptInput = {
    channelPresetId: TINY_MECHANISMS_PRESET_ID,
    seedId: seed.seedId,
    targetDurationSeconds: targetDurationSeconds(project.targetDurationSeconds),
  };
  const script = await generateScript(scriptInput);

  return withDbTransaction(db, async (tx) => {
    const promptVersion = await insertPromptVersion(tx, {
      projectId: project.id,
      sceneId: null,
      purpose: "script",
      provider: "openai",
      promptPayload: script.promptPayload,
      responseText: script.responseText,
      responseMetadata: script.responseMetadata,
    });
    const scenes = await replaceProjectScenes(tx, project.id, script.scenes);

    await updateProject(tx, project.id, {
      title: script.title || tinyMechanismsProjectTitle(seed),
      topic: encodeTinyMechanismsTopic(seed.seedId),
    });
    await setProjectStatus(tx, project.id, "ready");

    const result: GenerateProjectScriptResult = {
      sceneIds: scenes.map((scene) => scene.id),
      promptVersionId: promptVersion.id,
      seedId: seed.seedId,
      channelPresetId: script.channelPresetId,
      metadataDraft: script.metadataDraft,
    };

    if (options.jobId) {
      await markJobSucceeded(tx, options.jobId, result);
    }

    return result;
  });
}
```

Replace `handleGenerateScript` with:

```ts
export async function handleGenerateScript(db: DbClient, job: JobRow) {
  await generateProjectScript(db, job.projectId, { jobId: job.id });
}
```

- [ ] **Step 2: Extract `generateCurrentSceneImage`**

In `apps/worker/src/handlers/generateSceneImage.ts`, add `getCurrentReadySceneAsset` to the DB imports.

Add this type above `handleGenerateSceneImage`:

```ts
export type GenerateCurrentSceneImageResult = {
  assetId: string;
  promptVersionId: string | null;
  reused: boolean;
};
```

Add this function above `handleGenerateSceneImage` by moving the existing body into it and changing the final success return:

```ts
export async function generateCurrentSceneImage(
  db: DbClient,
  sceneId: string,
  env?: HandlerEnv,
): Promise<GenerateCurrentSceneImageResult> {
  const currentAsset = await getCurrentReadySceneAsset(db, { sceneId, kind: "image" });
  if (currentAsset) {
    return {
      assetId: currentAsset.id,
      promptVersionId: null,
      reused: true,
    };
  }

  const handlerEnv = resolveHandlerEnv(env);
  const scene = await getScene(db, sceneId);

  if (!scene) {
    throw new Error("scene_not_found");
  }

  const project = await getProject(db, scene.projectId);
  if (!project) {
    throw new Error("project_not_found");
  }

  const latestScriptPrompt = await getLatestPromptVersion(db, {
    projectId: scene.projectId,
    sceneId: null,
    purpose: "script",
  });
  const styleContext = styleContextFromScriptResponseText(latestScriptPrompt?.responseText);
  const visualBrief = sceneVisualBriefFromScriptResponseText(
    latestScriptPrompt?.responseText,
    scene.position,
  );
  const visualHookArchetype = sceneVisualHookArchetypeFromScriptResponseText(
    latestScriptPrompt?.responseText,
    scene.position,
  );

  let asset: AssetRow | null = null;
  let assetReady = false;
  const provider = resolveImageProvider();

  try {
    asset = await createPendingAsset(db, {
      projectId: scene.projectId,
      sceneId: scene.id,
      kind: "image",
      path: sceneImagePath(scene.projectId, scene.id, "pending"),
      provider,
    });

    const compiledPrompt = imagePromptTemplate.compile({
      project,
      scene: {
        ...scene,
        ...(visualBrief ? { visualBrief } : {}),
        ...(visualHookArchetype ? { visualHookArchetype } : {}),
      },
      provider,
      ...(styleContext ? { styleContext } : {}),
    });
    const generated = await generateImage({
      prompt: compiledPrompt.prompt,
      provider,
      promptMetadata: {
        templateId: compiledPrompt.templateId,
        templateVersion: compiledPrompt.templateVersion,
      },
    });
    const finalPath = sceneImagePath(scene.projectId, scene.id, asset.id);
    const file = await writeAssetFile(handlerEnv.LOCAL_ASSET_ROOT, finalPath, generated.bytes);

    await markAssetReady(db, asset.id, {
      path: finalPath,
      mimeType: generated.mimeType,
      sizeBytes: file.sizeBytes,
      checksum: file.checksum,
      provider: generated.provider,
      model: generated.model,
    });
    assetReady = true;

    const promptVersion = await insertPromptVersion(db, {
      projectId: scene.projectId,
      sceneId: scene.id,
      purpose: "image_prompt",
      provider: generated.provider,
      model: generated.model,
      promptPayload: promptPayload(compiledPrompt, {
        projectId: project.id,
        sceneId: scene.id,
        imagePrompt: scene.imagePrompt,
        visualBrief: visualBrief ?? null,
        visualHookArchetype: visualHookArchetype ?? null,
      }),
      responseMetadata: generated.responseMetadata,
    });

    return {
      assetId: asset.id,
      promptVersionId: promptVersion.id,
      reused: false,
    };
  } catch (error) {
    if (asset && !assetReady) {
      await markAssetFailed(db, asset.id, errorMessage(error));
    }

    throw error;
  }
}
```

Replace `handleGenerateSceneImage` with:

```ts
export async function handleGenerateSceneImage(db: DbClient, job: JobRow, env?: HandlerEnv) {
  if (!job.sceneId) {
    throw new Error("scene_id_required");
  }

  const result = await generateCurrentSceneImage(db, job.sceneId, env);

  await markJobSucceeded(db, job.id, {
    assetId: result.assetId,
    promptVersionId: result.promptVersionId,
    reused: result.reused,
  });
}
```

- [ ] **Step 3: Extract `generateCurrentSceneAudio`**

In `apps/worker/src/handlers/generateSceneAudio.ts`, add `getCurrentReadySceneAsset` to the DB imports.

Add this type above `handleGenerateSceneAudio`:

```ts
export type GenerateCurrentSceneAudioResult = {
  assetId: string;
  captionTimingAssetId: string | null;
  promptVersionId: string | null;
  reused: boolean;
};
```

Add a `generateCurrentSceneAudio(db, sceneId, env?)` function that starts with:

```ts
export async function generateCurrentSceneAudio(
  db: DbClient,
  sceneId: string,
  env?: HandlerEnv,
): Promise<GenerateCurrentSceneAudioResult> {
  const currentAsset = await getCurrentReadySceneAsset(db, { sceneId, kind: "audio" });
  if (currentAsset) {
    return {
      assetId: currentAsset.id,
      captionTimingAssetId: null,
      promptVersionId: null,
      reused: true,
    };
  }
```

Move the existing generation body into this function, replacing `job.sceneId` with `sceneId`. Replace the final `markJobSucceeded` call with:

```ts
    return {
      assetId: audioAsset.id,
      captionTimingAssetId,
      promptVersionId: promptVersion.id,
      reused: false,
    };
```

Replace `handleGenerateSceneAudio` with:

```ts
export async function handleGenerateSceneAudio(db: DbClient, job: JobRow, env?: HandlerEnv) {
  if (!job.sceneId) {
    throw new Error("scene_id_required");
  }

  const result = await generateCurrentSceneAudio(db, job.sceneId, env);

  await markJobSucceeded(db, job.id, {
    assetId: result.assetId,
    captionTimingAssetId: result.captionTimingAssetId,
    promptVersionId: result.promptVersionId,
    reused: result.reused,
  });
}
```

- [ ] **Step 4: Extract `renderProjectVideo`**

In `apps/worker/src/handlers/renderVideo.ts`, add this type above `handleRenderVideo`:

```ts
export type RenderProjectVideoResult = {
  renderId: string;
  inputAssetId: string;
  outputAssetId: string;
  durationSeconds: number;
};
```

Rename the existing `handleRenderVideo` body into:

```ts
export async function renderProjectVideo(
  db: DbClient,
  projectId: string,
  env?: HandlerEnv,
): Promise<RenderProjectVideoResult> {
```

Inside it, replace `job.projectId` with `projectId`. Replace the final `markJobSucceeded` call with:

```ts
    return {
      renderId: render.id,
      inputAssetId: inputAsset.id,
      outputAssetId: outputAsset.id,
      durationSeconds: render.durationSeconds,
    };
```

Add this wrapper after `renderProjectVideo`:

```ts
export async function handleRenderVideo(db: DbClient, job: JobRow, env?: HandlerEnv) {
  const result = await renderProjectVideo(db, job.projectId, env);

  await markJobSucceeded(db, job.id, {
    renderId: result.renderId,
    inputAssetId: result.inputAssetId,
    outputAssetId: result.outputAssetId,
  });
}
```

- [ ] **Step 5: Run worker checks**

Run:

```bash
bun test apps/worker/src/handlers/renderVideo.test.ts
bun run --cwd apps/worker typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit reusable worker steps**

Run:

```bash
git add apps/worker/src/handlers/generateScript.ts apps/worker/src/handlers/generateSceneImage.ts apps/worker/src/handlers/generateSceneAudio.ts apps/worker/src/handlers/renderVideo.ts
git commit -m "refactor: extract worker generation steps"
```

---

### Task 5: Add Worker Full-Flow Handler

**Files:**
- Create: `apps/worker/src/handlers/runProjectFlow.ts`
- Create: `apps/worker/src/handlers/runProjectFlow.test.ts`
- Modify: `apps/worker/src/handlers/index.ts`

- [ ] **Step 1: Create the orchestration test**

Create `apps/worker/src/handlers/runProjectFlow.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import type { AssetRow, DbClient, JobRow, SceneRow } from "@short-workflow/db";

import { runProjectFlow } from "./runProjectFlow";

const projectId = "11111111-1111-4111-8111-111111111111";
const sceneAId = "22222222-2222-4222-8222-222222222222";
const sceneBId = "33333333-3333-4333-8333-333333333333";

const job: JobRow = {
  id: "44444444-4444-4444-8444-444444444444",
  projectId,
  sceneId: null,
  type: "run_project_flow",
  status: "processing",
  attempts: 1,
  maxAttempts: 5,
  parentJobId: null,
  errorMessage: null,
  input: { projectId },
  output: null,
  nextRetryAt: null,
  createdAt: new Date("2026-05-19T00:00:00.000Z"),
  startedAt: new Date("2026-05-19T00:00:00.000Z"),
  finishedAt: null,
  updatedAt: new Date("2026-05-19T00:00:00.000Z"),
};

function scene(id: string, position: number): SceneRow {
  return {
    id,
    projectId,
    position,
    role: position === 1 ? "hook" : "context",
    durationSeconds: 3,
    narration: `Narration ${position}`,
    caption: `Caption ${position}`,
    imagePrompt: `Prompt ${position}`,
    ssml: `<speak>Narration ${position}</speak>`,
    status: "ready",
    contentUpdatedAt: new Date("2026-05-19T00:00:00.000Z"),
    createdAt: new Date("2026-05-19T00:00:00.000Z"),
    updatedAt: new Date("2026-05-19T00:00:00.000Z"),
  };
}

function asset(id: string, sceneId: string, kind: "image" | "audio"): AssetRow {
  return {
    id,
    projectId,
    sceneId,
    kind,
    storageDriver: "local",
    path: `projects/${projectId}/${sceneId}/${kind}`,
    mimeType: kind === "image" ? "image/png" : "audio/mpeg",
    sizeBytes: 1,
    checksum: null,
    status: "ready",
    provider: kind === "image" ? "openai" : "elevenlabs",
    model: null,
    createdAt: new Date("2026-05-19T00:01:00.000Z"),
    updatedAt: new Date("2026-05-19T00:01:00.000Z"),
  };
}

describe("runProjectFlow", () => {
  test("generates script, missing assets, and render in order", async () => {
    const calls: string[] = [];
    const scenes = [scene(sceneAId, 1), scene(sceneBId, 2)];

    await runProjectFlow({} as DbClient, job, {
      generateCurrentSceneAudio: async (_db, sceneId) => {
        calls.push(`audio:${sceneId}`);
        return {
          assetId: `audio-${sceneId}`,
          captionTimingAssetId: null,
          promptVersionId: `audio-prompt-${sceneId}`,
          reused: false,
        };
      },
      generateCurrentSceneImage: async (_db, sceneId) => {
        calls.push(`image:${sceneId}`);
        return {
          assetId: `image-${sceneId}`,
          promptVersionId: `image-prompt-${sceneId}`,
          reused: false,
        };
      },
      generateProjectScript: async () => {
        calls.push("script");
        return {
          sceneIds: scenes.map((candidate) => candidate.id),
          promptVersionId: "script-prompt",
          seedId: "seed-1",
          channelPresetId: "tiny_mechanisms",
          metadataDraft: null,
        };
      },
      getCurrentReadySceneAsset: async () => null,
      listProjectScenes: async () => {
        calls.push("list-scenes");
        return calls.includes("script") ? scenes : [];
      },
      markJobSucceeded: async (_db, jobId, output) => {
        calls.push(`succeeded:${jobId}`);
        expect(output).toMatchObject({
          imageAssetIds: [`image-${sceneAId}`, `image-${sceneBId}`],
          audioAssetIds: [`audio-${sceneAId}`, `audio-${sceneBId}`],
          renderId: "render-1",
          outputAssetId: "render-output-1",
        });
        return job;
      },
      renderProjectVideo: async () => {
        calls.push("render");
        return {
          renderId: "render-1",
          inputAssetId: "render-input-1",
          outputAssetId: "render-output-1",
          durationSeconds: 45,
        };
      },
    });

    expect(calls).toEqual([
      "list-scenes",
      "script",
      "list-scenes",
      `image:${sceneAId}`,
      `audio:${sceneAId}`,
      `image:${sceneBId}`,
      `audio:${sceneBId}`,
      "render",
      `succeeded:${job.id}`,
    ]);
  });

  test("skips current scene assets on retry", async () => {
    const calls: string[] = [];
    const scenes = [scene(sceneAId, 1)];

    await runProjectFlow({} as DbClient, job, {
      generateCurrentSceneAudio: async () => {
        throw new Error("audio_should_not_run");
      },
      generateCurrentSceneImage: async () => {
        throw new Error("image_should_not_run");
      },
      generateProjectScript: async () => {
        throw new Error("script_should_not_run");
      },
      getCurrentReadySceneAsset: async (_db, input) =>
        asset(`${input.kind}-asset`, input.sceneId, input.kind as "image" | "audio"),
      listProjectScenes: async () => scenes,
      markJobSucceeded: async (_db, _jobId, output) => {
        calls.push("succeeded");
        expect(output).toMatchObject({
          imageAssetIds: ["image-asset"],
          audioAssetIds: ["audio-asset"],
        });
        return job;
      },
      renderProjectVideo: async () => {
        calls.push("render");
        return {
          renderId: "render-1",
          inputAssetId: "render-input-1",
          outputAssetId: "render-output-1",
          durationSeconds: 45,
        };
      },
    });

    expect(calls).toEqual(["render", "succeeded"]);
  });
});
```

- [ ] **Step 2: Run the failing orchestration test**

Run:

```bash
bun test apps/worker/src/handlers/runProjectFlow.test.ts
```

Expected: FAIL because `runProjectFlow.ts` does not exist.

- [ ] **Step 3: Implement the full-flow handler**

Create `apps/worker/src/handlers/runProjectFlow.ts`:

```ts
import {
  getCurrentReadySceneAsset,
  listProjectScenes,
  markJobSucceeded,
  type AssetRow,
  type DbClient,
  type JobRow,
  type SceneRow,
} from "@short-workflow/db";

import { generateCurrentSceneAudio } from "./generateSceneAudio";
import { generateCurrentSceneImage } from "./generateSceneImage";
import { generateProjectScript } from "./generateScript";
import { renderProjectVideo } from "./renderVideo";

type CurrentAssetInput = {
  sceneId: string;
  kind: AssetRow["kind"];
};

type RunProjectFlowDeps = {
  generateCurrentSceneAudio: typeof generateCurrentSceneAudio;
  generateCurrentSceneImage: typeof generateCurrentSceneImage;
  generateProjectScript: typeof generateProjectScript;
  getCurrentReadySceneAsset: (db: DbClient, input: CurrentAssetInput) => Promise<AssetRow | null>;
  listProjectScenes: typeof listProjectScenes;
  markJobSucceeded: typeof markJobSucceeded;
  renderProjectVideo: typeof renderProjectVideo;
};

const defaultDeps: RunProjectFlowDeps = {
  generateCurrentSceneAudio,
  generateCurrentSceneImage,
  generateProjectScript,
  getCurrentReadySceneAsset,
  listProjectScenes,
  markJobSucceeded,
  renderProjectVideo,
};

export async function runProjectFlow(
  db: DbClient,
  job: JobRow,
  deps: RunProjectFlowDeps = defaultDeps,
) {
  let scenes = await deps.listProjectScenes(db, job.projectId);
  let scriptResult = null;

  if (scenes.length === 0) {
    scriptResult = await deps.generateProjectScript(db, job.projectId);
    scenes = await deps.listProjectScenes(db, job.projectId);
  }

  if (scenes.length === 0) {
    throw new Error("project_flow_script_created_no_scenes");
  }

  const imageAssetIds: string[] = [];
  const audioAssetIds: string[] = [];

  for (const scene of scenes) {
    const image = await getOrGenerateSceneImage(db, scene, deps);
    imageAssetIds.push(image.assetId);

    const audio = await getOrGenerateSceneAudio(db, scene, deps);
    audioAssetIds.push(audio.assetId);
  }

  const render = await deps.renderProjectVideo(db, job.projectId);

  await deps.markJobSucceeded(db, job.id, {
    ...(scriptResult
      ? {
          scriptPromptVersionId: scriptResult.promptVersionId,
          seedId: scriptResult.seedId,
          channelPresetId: scriptResult.channelPresetId,
          metadataDraft: scriptResult.metadataDraft,
        }
      : {}),
    sceneIds: scenes.map((scene) => scene.id),
    imageAssetIds,
    audioAssetIds,
    renderId: render.renderId,
    inputAssetId: render.inputAssetId,
    outputAssetId: render.outputAssetId,
    durationSeconds: render.durationSeconds,
  });
}

async function getOrGenerateSceneImage(
  db: DbClient,
  scene: SceneRow,
  deps: RunProjectFlowDeps,
) {
  const current = await deps.getCurrentReadySceneAsset(db, {
    sceneId: scene.id,
    kind: "image",
  });

  if (current) {
    return {
      assetId: current.id,
      promptVersionId: null,
      reused: true,
    };
  }

  return deps.generateCurrentSceneImage(db, scene.id);
}

async function getOrGenerateSceneAudio(
  db: DbClient,
  scene: SceneRow,
  deps: RunProjectFlowDeps,
) {
  const current = await deps.getCurrentReadySceneAsset(db, {
    sceneId: scene.id,
    kind: "audio",
  });

  if (current) {
    return {
      assetId: current.id,
      captionTimingAssetId: null,
      promptVersionId: null,
      reused: true,
    };
  }

  return deps.generateCurrentSceneAudio(db, scene.id);
}

export async function handleRunProjectFlow(db: DbClient, job: JobRow) {
  await runProjectFlow(db, job);
}
```

- [ ] **Step 4: Dispatch the new job type**

In `apps/worker/src/handlers/index.ts`, add the import:

```ts
import { handleRunProjectFlow } from "./runProjectFlow";
```

Add the switch branch before `upload_youtube`:

```ts
    case "run_project_flow":
      await handleRunProjectFlow(db, job);
      break;
```

- [ ] **Step 5: Run worker tests and typecheck**

Run:

```bash
bun test apps/worker/src/handlers/runProjectFlow.test.ts apps/worker/src/handlers/renderVideo.test.ts
bun run --cwd apps/worker typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the full-flow worker**

Run:

```bash
git add apps/worker/src/handlers/runProjectFlow.ts apps/worker/src/handlers/runProjectFlow.test.ts apps/worker/src/handlers/index.ts
git commit -m "feat: add project flow worker handler"
```

---

### Task 6: Add Web Mutation And UI Button

**Files:**
- Modify: `apps/web/src/features/projects/hooks.ts`
- Modify: `apps/web/src/features/projects/ProjectWorkflow.tsx`
- Modify: `apps/web/src/features/projects/workflow.test.ts`

- [ ] **Step 1: Add UI helper tests**

In `apps/web/src/features/projects/workflow.test.ts`, update the import from `./ProjectWorkflow` after the helper is added:

```ts
import { isProjectFlowStartable } from "./ProjectWorkflow";
```

Append:

```ts
describe("project full-flow helpers", () => {
  test("allows a fresh project to start full flow", () => {
    const detail: ProjectDetailResponse = {
      assets: [],
      jobs: [],
      project: {
        createdAt: "2026-05-19T00:00:00.000Z",
        format: "vertical_9_16",
        id: "22222222-2222-4222-8222-222222222222",
        language: "en",
        status: "draft",
        targetDurationSeconds: 45,
        title: "Project",
        topic: "Topic",
        updatedAt: "2026-05-19T00:00:00.000Z",
      },
      renders: [],
      scenes: [],
      youtubeMetadata: null,
      youtubeUpload: null,
    };

    expect(isProjectFlowStartable(detail, [])).toBe(true);
  });

  test("blocks full flow after generation has started", () => {
    const detail: ProjectDetailResponse = {
      assets: [],
      jobs: [job({ status: "succeeded", type: "generate_script" })],
      project: {
        createdAt: "2026-05-19T00:00:00.000Z",
        format: "vertical_9_16",
        id: "22222222-2222-4222-8222-222222222222",
        language: "en",
        status: "draft",
        targetDurationSeconds: 45,
        title: "Project",
        topic: "Topic",
        updatedAt: "2026-05-19T00:00:00.000Z",
      },
      renders: [],
      scenes: [],
      youtubeMetadata: null,
      youtubeUpload: null,
    };

    expect(isProjectFlowStartable(detail, [])).toBe(false);
  });

  test("blocks full flow while any job is active", () => {
    const detail: ProjectDetailResponse = {
      assets: [],
      jobs: [],
      project: {
        createdAt: "2026-05-19T00:00:00.000Z",
        format: "vertical_9_16",
        id: "22222222-2222-4222-8222-222222222222",
        language: "en",
        status: "draft",
        targetDurationSeconds: 45,
        title: "Project",
        topic: "Topic",
        updatedAt: "2026-05-19T00:00:00.000Z",
      },
      renders: [],
      scenes: [],
      youtubeMetadata: null,
      youtubeUpload: null,
    };

    expect(isProjectFlowStartable(detail, [job({ status: "pending", type: "run_project_flow" })])).toBe(
      false,
    );
  });
});
```

- [ ] **Step 2: Run the failing web helper test**

Run:

```bash
bun test apps/web/src/features/projects/workflow.test.ts
```

Expected: FAIL because `isProjectFlowStartable` does not exist and `run_project_flow` is not yet handled in the web code.

- [ ] **Step 3: Add the mutation hook**

In `apps/web/src/features/projects/hooks.ts`, add:

```ts
export function useRunProjectFlowMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<Job>(`/projects/${projectId}/run-flow`, {
        method: "POST",
      }),
    onSuccess: () => invalidateProjectWorkflow(queryClient, projectId),
  });
}
```

- [ ] **Step 4: Add the UI helper and button**

In `apps/web/src/features/projects/ProjectWorkflow.tsx`, update the icon import:

```ts
import { AlertCircle, Clapperboard, FileText, Loader2, Play, WandSparkles } from "lucide-react";
```

Update the hooks import:

```ts
import { useGenerateScriptMutation, useProjectJobsQuery, useRunProjectFlowMutation } from "./hooks";
```

Add helper constants and function near `activeJobLabel`:

```ts
const FLOW_STARTED_JOB_TYPES = new Set<Job["type"]>([
  "run_project_flow",
  "generate_script",
  "generate_scene_image",
  "generate_scene_audio",
  "render_video",
]);

export function isProjectFlowStartable(detail: ProjectDetailResponse, activeJobs: Job[]) {
  if (activeJobs.some((job) => job.status === "pending" || job.status === "processing")) {
    return false;
  }

  return (
    detail.scenes.length === 0 &&
    detail.assets.length === 0 &&
    detail.renders.length === 0 &&
    !detail.jobs.some((job) => FLOW_STARTED_JOB_TYPES.has(job.type))
  );
}
```

Inside `ProjectWorkflow`, after `const generateScript = useGenerateScriptMutation(projectId);`, add:

```ts
  const runProjectFlow = useRunProjectFlowMutation(projectId);
```

After `const scriptJobActive = ...`, add:

```ts
  const flowJobActive = activeWorkflowJobs.some((job) => job.type === "run_project_flow");
  const flowStartable = isProjectFlowStartable(detail, activeWorkflowJobs);
```

In the no-scenes empty-state action area, keep the existing `Generate script` button and add this sibling button before it:

```tsx
              <button
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!flowStartable || runProjectFlow.isPending || flowJobActive}
                onClick={() => runProjectFlow.mutate()}
                type="button"
              >
                {runProjectFlow.isPending || flowJobActive ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <WandSparkles className="size-4" />
                )}
                {flowJobActive ? "Running full flow" : "Run full flow"}
              </button>
```

Below the existing script-generation error message, add:

```tsx
            {runProjectFlow.error ? (
              <p className="mt-3 flex items-center gap-2 rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent-foreground">
                <AlertCircle className="size-4" />
                Full flow could not be started.
              </p>
            ) : null}
```

- [ ] **Step 5: Run web tests and typecheck**

Run:

```bash
bun test apps/web/src/features/projects/workflow.test.ts
bun run --cwd apps/web typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the web UI**

Run:

```bash
git add apps/web/src/features/projects/hooks.ts apps/web/src/features/projects/ProjectWorkflow.tsx apps/web/src/features/projects/workflow.test.ts
git commit -m "feat: add run full flow button"
```

---

### Task 7: Final Verification And Manual Smoke

**Files:**
- No new files

- [ ] **Step 1: Run focused automated verification**

Run:

```bash
bun test packages/shared/src/schemas.test.ts apps/api/src/services/projects.test.ts apps/api/src/app.test.ts apps/worker/src/handlers/runProjectFlow.test.ts apps/worker/src/handlers/renderVideo.test.ts apps/web/src/features/projects/workflow.test.ts
bun run --cwd apps/api typecheck
bun run --cwd apps/worker typecheck
bun run --cwd apps/web typecheck
bun run --cwd packages/db typecheck
bun run db:check
```

Expected:

- all listed tests pass
- all listed typechecks pass
- `db:check` prints `Checked 6 migration folders`

- [ ] **Step 2: Apply the migration against the configured hosted Supabase database**

Run:

```bash
bun run db:migrate:up
```

Expected: migration `0006_add_run_project_flow_job` applies successfully and records in `app_migrations`.

- [ ] **Step 3: Verify API health**

Start the API in one terminal:

```bash
bun run dev:api
```

In another terminal, run:

```bash
curl -s http://localhost:3001/health
```

Expected:

```json
{"ok":true,"service":"short-workflow-api"}
```

- [ ] **Step 4: Run local one-click smoke**

Start the local services:

```bash
bun run dev:api
bun run dev:web
bun run dev:worker
```

Manual actions:

1. Open the web app.
2. Create a fresh project.
3. Click `Run full flow`.
4. Keep the project page mounted until active jobs clear.
5. Confirm scenes are created.
6. Confirm image/audio assets are created.
7. Confirm a render appears in the existing final preview.
8. Confirm no `upload_youtube` job was created for the project.

Expected: the final MP4 is ready under `LOCAL_ASSET_ROOT`, and the UI shows the render preview.

- [ ] **Step 5: Commit any verification-only documentation updates**

If no documentation changed during verification, do not create a commit.

If a verification note is added to an existing smoke script, run:

```bash
git add scripts/smoke/run-local-flow.md
git commit -m "docs: update local flow smoke steps"
```

---

## Rollback Notes

- Code rollback is normal Git revert.
- Database down migration intentionally fails for the enum value, matching the existing `upload_youtube` migration style. A true rollback requires a one-off migration after confirming no rows use `run_project_flow`.

## Implementation Order

Implement tasks in order. Do not start worker or web work before the shared job type and migration are complete because TypeScript exhaustiveness checks depend on the shared `JOB_TYPES` contract.
