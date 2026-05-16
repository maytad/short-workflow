# Short Workflow MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first local-running MVP that creates an English 9:16 AI-assisted short video from a topic, with reviewable script/scenes/assets/jobs and a local Remotion MP4 output.

**Architecture:** Use a Bun workspace monorepo with clear package boundaries: React SPA in `apps/web`, Elysia API in `apps/api`, Bun worker in `apps/worker`, Remotion renderer in `apps/render`, Drizzle/Postgres access in `packages/db`, AI provider wrappers in `packages/ai`, and shared Zod contracts in `packages/shared`. The API creates projects and jobs; the worker claims jobs atomically, calls providers, writes local files under `LOCAL_ASSET_ROOT`, updates hosted Supabase Postgres through Drizzle, and invokes Remotion through a Node.js subprocess.

**Tech Stack:** Bun workspaces, Turborepo, TypeScript, React, Vite, TanStack Router, TanStack Query, Tailwind v4, shadcn/ui, ElysiaJS, Drizzle ORM, hosted Supabase Postgres, OpenAI API, Google Gemini image API, Google Text-to-Speech, Remotion, Node.js for rendering.

---

## File Map

Create these top-level files:

- `package.json`: workspace, scripts, root dev dependencies.
- `turbo.json`: Turborepo pipelines for dev, check, typecheck, db commands, render commands.
- `tsconfig.base.json`: shared TypeScript compiler settings.
- `.gitignore`: env files, generated videos, local asset data, build outputs.
- `.env.example`: documented runtime and provider variables.
- `README.md`: short local setup and first smoke flow.

Create these apps:

- `apps/api/package.json`: Elysia API package scripts and dependencies.
- `apps/api/src/index.ts`: API server entrypoint.
- `apps/api/src/app.ts`: Elysia app factory.
- `apps/api/src/env.ts`: server env parsing.
- `apps/api/src/http.ts`: response helpers and typed API errors.
- `apps/api/src/routes/health.ts`: `GET /health`.
- `apps/api/src/routes/projects.ts`: project, scene, asset, render, and job HTTP endpoints.
- `apps/api/src/services/projects.ts`: project mutations and render precondition checks.
- `apps/api/src/services/jobs.ts`: idempotent job creation and retry behavior.

- `apps/worker/package.json`: worker package scripts and dependencies.
- `apps/worker/src/index.ts`: worker process entrypoint.
- `apps/worker/src/env.ts`: worker env parsing.
- `apps/worker/src/loop.ts`: concurrency loop and stale job recovery schedule.
- `apps/worker/src/handlers/index.ts`: job handler dispatch.
- `apps/worker/src/handlers/generateScript.ts`: script generation job.
- `apps/worker/src/handlers/generateSceneImage.ts`: image generation job.
- `apps/worker/src/handlers/generateSceneAudio.ts`: audio generation job.
- `apps/worker/src/handlers/renderVideo.ts`: render input build and Remotion subprocess trigger.
- `apps/worker/src/assets.ts`: local asset path, write, checksum, and metadata utilities.
- `apps/worker/src/retry.ts`: capped exponential retry helpers.

- `apps/render/package.json`: Remotion package scripts.
- `apps/render/src/Root.tsx`: Remotion composition registration.
- `apps/render/src/ShortVideo.tsx`: 9:16 composition.
- `apps/render/src/schema.ts`: render input schema imported by worker.
- `apps/render/src/render.ts`: Node.js CLI render entrypoint.

- `apps/web/package.json`: React app package scripts and dependencies.
- `apps/web/index.html`: Vite HTML shell.
- `apps/web/src/main.tsx`: React root.
- `apps/web/src/router.tsx`: TanStack Router setup.
- `apps/web/src/routeTree.gen.ts`: generated route tree, never manually edited after router plugin is configured.
- `apps/web/src/routes/__root.tsx`: root route.
- `apps/web/src/routes/index.tsx`: project list/create route.
- `apps/web/src/routes/projects.$projectId.tsx`: project workflow route.
- `apps/web/src/api/client.ts`: fetch wrapper and typed error.
- `apps/web/src/api/queryKeys.ts`: query key factory.
- `apps/web/src/features/projects/hooks.ts`: TanStack Query hooks.
- `apps/web/src/features/projects/ProjectWorkflow.tsx`: step shell.
- `apps/web/src/features/projects/ProjectCreateForm.tsx`: topic/title form.
- `apps/web/src/features/projects/SceneEditor.tsx`: scene editing form.
- `apps/web/src/features/projects/AssetPanel.tsx`: image/audio status controls.
- `apps/web/src/features/projects/RenderPanel.tsx`: render preconditions and render actions.
- `apps/web/src/components/ui/*`: shadcn primitives.
- `apps/web/src/components/layout/AppShell.tsx`: app shell.
- `apps/web/src/styles/globals.css`: Tailwind v4 theme tokens.

Create these packages:

- `packages/config/package.json`: shared config package.
- `packages/config/tsconfig/base.json`: shared TS config export.

- `packages/shared/package.json`: shared contracts package.
- `packages/shared/src/constants.ts`: enums and constants.
- `packages/shared/src/schemas.ts`: Zod schemas for DB-facing and API-facing data.
- `packages/shared/src/api.ts`: request/response contract schemas.
- `packages/shared/src/render.ts`: render input schema shared by worker/render.
- `packages/shared/src/index.ts`: exports.

- `packages/db/package.json`: Drizzle package scripts.
- `packages/db/drizzle.config.ts`: Drizzle Kit config using `DATABASE_DIRECT_URL`.
- `packages/db/src/client.ts`: Drizzle client factory using runtime `DATABASE_URL`.
- `packages/db/src/schema.ts`: Drizzle table definitions.
- `packages/db/src/queries/projects.ts`: project queries.
- `packages/db/src/queries/scenes.ts`: scene queries.
- `packages/db/src/queries/assets.ts`: asset queries.
- `packages/db/src/queries/jobs.ts`: job creation, claim, retry, stale recovery.
- `packages/db/src/queries/renders.ts`: render queries.
- `packages/db/src/queries/promptVersions.ts`: prompt version queries.
- `packages/db/src/index.ts`: exports.
- `packages/db/scripts/migrate.ts`: reversible migration runner.
- `packages/db/scripts/check.ts`: migration safety checks.
- `packages/db/migrations/0001_init/migration.sql`: initial schema up migration.
- `packages/db/migrations/0001_init/down.sql`: initial schema rollback.

- `packages/ai/package.json`: provider wrappers package.
- `packages/ai/src/openai.ts`: OpenAI script generation client.
- `packages/ai/src/googleImage.ts`: Google image generation client.
- `packages/ai/src/googleTts.ts`: Google TTS client.
- `packages/ai/src/types.ts`: provider-neutral inputs and outputs.
- `packages/ai/src/index.ts`: exports.

---

## Task 1: Workspace Scaffold

**Files:**
- Create: `package.json`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.env.example`
- Modify: `README.md`
- Create: `apps/api/package.json`
- Create: `apps/worker/package.json`
- Create: `apps/render/package.json`
- Create: `apps/web/package.json`
- Create: `packages/shared/package.json`
- Create: `packages/db/package.json`
- Create: `packages/ai/package.json`
- Create: `packages/config/package.json`

- [ ] **Step 1: Create root workspace manifest**

Use this exact root `package.json` shape:

```json
{
  "name": "short-workflow",
  "private": true,
  "packageManager": "bun@1.2.0",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo run dev --parallel",
    "dev:web": "turbo run dev --filter=@short-workflow/web",
    "dev:api": "turbo run dev --filter=@short-workflow/api",
    "dev:worker": "turbo run dev --filter=@short-workflow/worker",
    "dev:render": "turbo run dev --filter=@short-workflow/render",
    "check": "turbo run check",
    "typecheck": "turbo run typecheck",
    "db:generate": "bun --cwd packages/db run generate",
    "db:check": "bun --cwd packages/db run check",
    "db:migrate:up": "bun --cwd packages/db run migrate:up",
    "db:migrate:down": "bun --cwd packages/db run migrate:down",
    "db:studio": "bun --cwd packages/db run studio",
    "render:project": "bun --cwd apps/render run render:project"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "turbo": "latest",
    "typescript": "latest"
  }
}
```

- [ ] **Step 2: Create Turborepo pipeline**

Create `turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "check": {
      "dependsOn": ["^check"],
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["^typecheck"],
      "outputs": []
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "build/**"]
    }
  }
}
```

- [ ] **Step 3: Create shared TypeScript config**

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "types": ["bun-types"]
  }
}
```

- [ ] **Step 4: Create ignore rules**

Create `.gitignore`:

```gitignore
node_modules/
dist/
build/
.turbo/
.vite/
.env
.env.*
!.env.example
short-workflow-data/
*.mp4
*.mp3
*.wav
*.png
*.jpg
*.jpeg
*.webp
```

- [ ] **Step 5: Create env example**

Create `.env.example`:

```dotenv
DATABASE_URL="postgresql://postgres.<project-ref>:[PASSWORD]@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres"
DATABASE_DIRECT_URL="postgresql://postgres:[PASSWORD]@db.<project-ref>.supabase.co:5432/postgres"
SUPABASE_URL=""
SUPABASE_SERVICE_ROLE_KEY=""
OPENAI_API_KEY=""
GOOGLE_API_KEY=""
GOOGLE_CLOUD_TEXT_TO_SPEECH_KEY_PATH=""
LOCAL_ASSET_ROOT="/absolute/path/to/short-workflow-data"
WORKER_CONCURRENCY="2"
API_BASE_URL="http://localhost:3001"
```

- [ ] **Step 6: Create package manifests**

Create package manifests with these names and basic scripts:

```json
{
  "name": "@short-workflow/shared",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "check": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "latest"
  },
  "devDependencies": {
    "typescript": "latest"
  }
}
```

Create the remaining package manifests with the same `private`, `type`, and `typecheck` script shape. Use package names `@short-workflow/db`, `@short-workflow/ai`, `@short-workflow/api`, `@short-workflow/worker`, `@short-workflow/render`, `@short-workflow/web`, and `@short-workflow/config`. Dependencies are added in the task that owns each package.

Create a minimal `tsconfig.json` in every package and app directory:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": ["src"]
}
```

For `packages/config/tsconfig/base.json`, copy the root `tsconfig.base.json` content so package consumers have a stable config path.

- [ ] **Step 7: Install and verify workspace**

Run:

```bash
bun install
bun run typecheck
```

Expected:

```text
typecheck exits 0
```

- [ ] **Step 8: Commit scaffold**

```bash
git add package.json turbo.json tsconfig.base.json .gitignore .env.example README.md apps packages
git commit -m "chore: scaffold workspace"
```

---

## Task 2: Shared Contracts Package

**Files:**
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/constants.ts`
- Create: `packages/shared/src/schemas.ts`
- Create: `packages/shared/src/api.ts`
- Create: `packages/shared/src/render.ts`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/schemas.test.ts`
- Modify: `packages/shared/package.json`

- [ ] **Step 1: Add shared package config**

Create `packages/shared/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 2: Define constants and enums**

Create `packages/shared/src/constants.ts`:

```ts
export const PROJECT_STATUSES = ["draft", "ready", "rendering", "done", "failed"] as const;
export const SCENE_STATUSES = ["draft", "ready"] as const;
export const SCENE_ROLES = ["hook", "context", "point", "payoff", "cta"] as const;
export const ASSET_KINDS = ["image", "audio", "render", "thumbnail", "render_input"] as const;
export const ASSET_STATUSES = ["pending", "ready", "failed"] as const;
export const STORAGE_DRIVERS = ["local"] as const;
export const ASSET_PROVIDERS = ["openai", "google_gemini", "google_tts", "remotion", "local"] as const;
export const JOB_TYPES = ["generate_script", "generate_scene_image", "generate_scene_audio", "render_video"] as const;
export const JOB_STATUSES = ["pending", "processing", "succeeded", "failed"] as const;
export const RENDER_STATUSES = ["pending", "processing", "succeeded", "failed"] as const;
export const PROMPT_PURPOSES = ["script", "image_prompt", "ssml", "caption"] as const;
export const DURATION_PRESETS_SECONDS = [30, 45, 60] as const;

export const DEFAULT_TARGET_DURATION_SECONDS = 45;
export const DEFAULT_WORKER_CONCURRENCY = 2;
export const DEFAULT_MAX_ATTEMPTS = 5;
export const RENDER_WIDTH = 1080;
export const RENDER_HEIGHT = 1920;
export const RENDER_FPS = 30;
```

- [ ] **Step 3: Define base schemas**

Create `packages/shared/src/schemas.ts` with schemas for project, scene, asset, job, render, and prompt version. Start with this exact shape and add inferred types at the bottom:

```ts
import { z } from "zod";
import {
  ASSET_KINDS,
  ASSET_PROVIDERS,
  ASSET_STATUSES,
  JOB_STATUSES,
  JOB_TYPES,
  PROJECT_STATUSES,
  PROMPT_PURPOSES,
  RENDER_STATUSES,
  SCENE_ROLES,
  SCENE_STATUSES,
  STORAGE_DRIVERS
} from "./constants";

export const uuidSchema = z.string().uuid();
export const isoDateSchema = z.string().datetime();
export const nonEmptyTextSchema = z.string().trim().min(1);
export const nullableIsoDateSchema = isoDateSchema.nullable();

export const projectStatusSchema = z.enum(PROJECT_STATUSES);
export const sceneStatusSchema = z.enum(SCENE_STATUSES);
export const sceneRoleSchema = z.enum(SCENE_ROLES);
export const assetKindSchema = z.enum(ASSET_KINDS);
export const assetStatusSchema = z.enum(ASSET_STATUSES);
export const storageDriverSchema = z.enum(STORAGE_DRIVERS);
export const assetProviderSchema = z.enum(ASSET_PROVIDERS);
export const jobTypeSchema = z.enum(JOB_TYPES);
export const jobStatusSchema = z.enum(JOB_STATUSES);
export const renderStatusSchema = z.enum(RENDER_STATUSES);
export const promptPurposeSchema = z.enum(PROMPT_PURPOSES);

export const projectSchema = z.object({
  id: uuidSchema,
  title: z.string(),
  topic: z.string(),
  status: projectStatusSchema,
  targetDurationSeconds: z.number().int().min(20).max(60),
  language: z.literal("en"),
  format: z.literal("vertical_9_16"),
  hasSuccessfulRender: z.boolean().optional(),
  latestRenderStale: z.boolean().optional(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema
});

export const sceneSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  position: z.number().int().min(0),
  role: sceneRoleSchema,
  durationSeconds: z.number().int().min(1).max(60),
  narration: z.string(),
  caption: z.string(),
  imagePrompt: z.string(),
  ssml: z.string(),
  status: sceneStatusSchema,
  contentUpdatedAt: isoDateSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema
});

export const assetSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  sceneId: uuidSchema.nullable(),
  kind: assetKindSchema,
  storageDriver: storageDriverSchema,
  path: z.string().min(1),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  checksum: z.string().regex(/^sha256:[a-f0-9]{64}$/).nullable(),
  status: assetStatusSchema,
  provider: assetProviderSchema,
  model: z.string().nullable(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema
});

export const jobSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  sceneId: uuidSchema.nullable(),
  type: jobTypeSchema,
  status: jobStatusSchema,
  attempts: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  parentJobId: uuidSchema.nullable(),
  errorMessage: z.string().nullable(),
  input: z.record(z.string(), z.unknown()),
  output: z.record(z.string(), z.unknown()).nullable(),
  nextRetryAt: nullableIsoDateSchema,
  createdAt: isoDateSchema,
  startedAt: nullableIsoDateSchema,
  finishedAt: nullableIsoDateSchema,
  updatedAt: isoDateSchema
});

export const renderSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  status: renderStatusSchema,
  inputAssetId: uuidSchema.nullable(),
  outputAssetId: uuidSchema.nullable(),
  durationSeconds: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().int().positive(),
  aiDisclosureAcknowledgedAt: nullableIsoDateSchema,
  errorMessage: z.string().nullable(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema
});

export type Project = z.infer<typeof projectSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type Job = z.infer<typeof jobSchema>;
export type Render = z.infer<typeof renderSchema>;
```

- [ ] **Step 4: Define API contract schemas**

Create `packages/shared/src/api.ts`:

```ts
import { z } from "zod";
import { DURATION_PRESETS_SECONDS } from "./constants";
import { assetSchema, jobSchema, projectSchema, renderSchema, sceneSchema, uuidSchema } from "./schemas";

export const createProjectRequestSchema = z.object({
  title: z.string().trim().min(1).max(120),
  topic: z.string().trim().min(1).max(1000),
  targetDurationSeconds: z.union([
    z.literal(DURATION_PRESETS_SECONDS[0]),
    z.literal(DURATION_PRESETS_SECONDS[1]),
    z.literal(DURATION_PRESETS_SECONDS[2])
  ]).default(45)
});

export const updateProjectRequestSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  topic: z.string().trim().min(1).max(1000).optional()
});

export const updateSceneRequestSchema = z.object({
  narration: z.string().optional(),
  caption: z.string().optional(),
  imagePrompt: z.string().optional(),
  ssml: z.string().optional(),
  durationSeconds: z.number().int().min(1).max(60).optional()
});

export const projectDetailResponseSchema = z.object({
  project: projectSchema,
  scenes: z.array(sceneSchema),
  assets: z.array(assetSchema),
  renders: z.array(renderSchema),
  jobs: z.array(jobSchema)
});

export const renderPreconditionErrorSchema = z.object({
  error: z.literal("render_preconditions_failed"),
  details: z.object({
    scenesNotReady: z.array(uuidSchema),
    scenesMissingImage: z.array(uuidSchema),
    scenesMissingAudio: z.array(uuidSchema),
    scenesStaleImage: z.array(uuidSchema),
    scenesStaleAudio: z.array(uuidSchema)
  })
});

export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;
export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;
export type UpdateSceneRequest = z.infer<typeof updateSceneRequestSchema>;
export type ProjectDetailResponse = z.infer<typeof projectDetailResponseSchema>;
```

- [ ] **Step 5: Define render input schema**

Create `packages/shared/src/render.ts`:

```ts
import { z } from "zod";

export const renderSceneInputSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().min(0),
  role: z.enum(["hook", "context", "point", "payoff", "cta"]),
  durationSeconds: z.number().int().positive(),
  narration: z.string().min(1),
  caption: z.string().min(1),
  imagePath: z.string().min(1),
  audioPath: z.string().min(1)
});

export const renderInputSchema = z.object({
  projectId: z.string().uuid(),
  renderId: z.string().uuid(),
  width: z.literal(1080),
  height: z.literal(1920),
  fps: z.literal(30),
  durationSeconds: z.number().int().min(20).max(60),
  scenes: z.array(renderSceneInputSchema).min(1)
});

export type RenderInput = z.infer<typeof renderInputSchema>;
export type RenderSceneInput = z.infer<typeof renderSceneInputSchema>;
```

- [ ] **Step 6: Export shared package**

Create `packages/shared/src/index.ts`:

```ts
export * from "./api";
export * from "./constants";
export * from "./render";
export * from "./schemas";
```

- [ ] **Step 7: Add schema tests**

Create `packages/shared/src/schemas.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { createProjectRequestSchema, renderPreconditionErrorSchema } from "./api";

describe("shared API schemas", () => {
  it("defaults project duration to 45 seconds", () => {
    const parsed = createProjectRequestSchema.parse({ title: "A", topic: "B" });
    expect(parsed.targetDurationSeconds).toBe(45);
  });

  it("rejects unsupported project duration presets", () => {
    expect(() =>
      createProjectRequestSchema.parse({ title: "A", topic: "B", targetDurationSeconds: 50 })
    ).toThrow();
  });

  it("accepts render precondition error payloads", () => {
    const parsed = renderPreconditionErrorSchema.parse({
      error: "render_preconditions_failed",
      details: {
        scenesNotReady: [],
        scenesMissingImage: [],
        scenesMissingAudio: [],
        scenesStaleImage: [],
        scenesStaleAudio: []
      }
    });
    expect(parsed.error).toBe("render_preconditions_failed");
  });
});
```

- [ ] **Step 8: Verify shared package**

Run:

```bash
bun --cwd packages/shared test
bun --cwd packages/shared run typecheck
```

Expected:

```text
3 pass
typecheck exits 0
```

- [ ] **Step 9: Commit shared contracts**

```bash
git add packages/shared
git commit -m "feat: add shared contracts"
```

---

## Task 3: Drizzle Schema And Reversible Migrations

**Files:**
- Modify: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/drizzle.config.ts`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/schema.ts`
- Create: `packages/db/src/queries/jobs.ts`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/scripts/migrate.ts`
- Create: `packages/db/scripts/check.ts`
- Create: `packages/db/migrations/0001_init/migration.sql`
- Create: `packages/db/migrations/0001_init/down.sql`
- Create: `packages/db/src/queries/jobs.test.ts`

- [ ] **Step 1: Add database package dependencies and scripts**

Set `packages/db/package.json` scripts and dependencies:

```json
{
  "name": "@short-workflow/db",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "generate": "drizzle-kit generate",
    "check": "bun scripts/check.ts",
    "migrate:up": "bun scripts/migrate.ts up",
    "migrate:down": "bun scripts/migrate.ts down",
    "studio": "drizzle-kit studio",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@short-workflow/shared": "workspace:*",
    "drizzle-orm": "latest",
    "postgres": "latest"
  },
  "devDependencies": {
    "drizzle-kit": "latest",
    "typescript": "latest"
  }
}
```

- [ ] **Step 2: Add Drizzle config**

Create `packages/db/drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_DIRECT_URL) {
  throw new Error("DATABASE_DIRECT_URL is required for Drizzle Kit");
}

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_DIRECT_URL
  }
});
```

- [ ] **Step 3: Add Drizzle runtime client**

Create `packages/db/src/client.ts`:

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDbClient(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const client = postgres(connectionString, {
    max: 4,
    prepare: connectionString.includes("pooler.supabase.com:6543") ? false : true
  });

  return {
    db: drizzle(client, { schema }),
    client
  };
}

export type DbClient = ReturnType<typeof createDbClient>["db"];
```

- [ ] **Step 4: Add schema definitions**

Create `packages/db/src/schema.ts` with Drizzle enums and tables for `projects`, `scenes`, `assets`, `jobs`, `renders`, `prompt_versions`, and `app_migrations`. Include these constraints:

```ts
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export const projectStatusEnum = pgEnum("project_status", ["draft", "ready", "rendering", "done", "failed"]);
export const sceneStatusEnum = pgEnum("scene_status", ["draft", "ready"]);
export const sceneRoleEnum = pgEnum("scene_role", ["hook", "context", "point", "payoff", "cta"]);
export const assetKindEnum = pgEnum("asset_kind", ["image", "audio", "render", "thumbnail", "render_input"]);
export const assetStatusEnum = pgEnum("asset_status", ["pending", "ready", "failed"]);
export const storageDriverEnum = pgEnum("storage_driver", ["local"]);
export const assetProviderEnum = pgEnum("asset_provider", ["openai", "google_gemini", "google_tts", "remotion", "local"]);
export const jobTypeEnum = pgEnum("job_type", ["generate_script", "generate_scene_image", "generate_scene_audio", "render_video"]);
export const jobStatusEnum = pgEnum("job_status", ["pending", "processing", "succeeded", "failed"]);
export const renderStatusEnum = pgEnum("render_status", ["pending", "processing", "succeeded", "failed"]);
export const promptPurposeEnum = pgEnum("prompt_purpose", ["script", "image_prompt", "ssml", "caption"]);

const now = sql`now()`;

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  topic: text("topic").notNull(),
  status: projectStatusEnum("status").notNull().default("draft"),
  targetDurationSeconds: integer("target_duration_seconds").notNull().default(45),
  language: text("language").notNull().default("en"),
  format: text("format").notNull().default("vertical_9_16"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(now)
});

export const scenes = pgTable("scenes", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  role: sceneRoleEnum("role").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  narration: text("narration").notNull().default(""),
  caption: text("caption").notNull().default(""),
  imagePrompt: text("image_prompt").notNull().default(""),
  ssml: text("ssml").notNull().default(""),
  status: sceneStatusEnum("status").notNull().default("draft"),
  contentUpdatedAt: timestamp("content_updated_at", { withTimezone: true }).notNull().default(now),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(now)
}, (table) => ({
  onePositionPerProject: uniqueIndex("scenes_one_position_per_project").on(table.projectId, table.position)
}));

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  sceneId: uuid("scene_id").references(() => scenes.id, { onDelete: "cascade" }),
  type: jobTypeEnum("type").notNull(),
  status: jobStatusEnum("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(5),
  parentJobId: uuid("parent_job_id"),
  errorMessage: text("error_message"),
  input: jsonb("input").notNull().default({}),
  output: jsonb("output"),
  nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(now)
}, (table) => ({
  projectStatusCreatedAt: index("jobs_project_status_created_at_idx").on(table.projectId, table.status, table.createdAt),
  retryClaim: index("jobs_retry_claim_idx").on(table.status, table.nextRetryAt, table.createdAt),
  processingStartedAt: index("jobs_processing_started_at_idx").on(table.startedAt).where(sql`${table.status} = 'processing'`),
  sceneIdPerType: check("jobs_scene_id_per_type", sql`
    case type
      when 'generate_script' then scene_id is null
      when 'render_video' then scene_id is null
      when 'generate_scene_image' then scene_id is not null
      when 'generate_scene_audio' then scene_id is not null
      else false
    end
  `),
  oneActiveProjectJob: uniqueIndex("jobs_one_active_project_job").on(table.projectId, table.type).where(sql`scene_id is null and status in ('pending', 'processing')`),
  oneActiveSceneJob: uniqueIndex("jobs_one_active_scene_job").on(table.sceneId, table.type).where(sql`scene_id is not null and status in ('pending', 'processing')`)
}));
```

Add `serial` to the `drizzle-orm/pg-core` import list, then append these table definitions:

```ts
export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  sceneId: uuid("scene_id").references(() => scenes.id, { onDelete: "cascade" }),
  kind: assetKindEnum("kind").notNull(),
  storageDriver: storageDriverEnum("storage_driver").notNull().default("local"),
  path: text("path").notNull(),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  checksum: text("checksum"),
  status: assetStatusEnum("status").notNull().default("pending"),
  provider: assetProviderEnum("provider").notNull(),
  model: text("model"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(now)
}, (table) => ({
  currentAssetLookup: index("assets_scene_kind_created_ready_idx")
    .on(table.sceneId, table.kind, table.createdAt)
    .where(sql`${table.status} = 'ready'`)
}));

export const renders = pgTable("renders", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  status: renderStatusEnum("status").notNull().default("pending"),
  inputAssetId: uuid("input_asset_id").references(() => assets.id),
  outputAssetId: uuid("output_asset_id").references(() => assets.id),
  durationSeconds: integer("duration_seconds").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  fps: integer("fps").notNull(),
  aiDisclosureAcknowledgedAt: timestamp("ai_disclosure_acknowledged_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(now)
});

export const promptVersions = pgTable("prompt_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  sceneId: uuid("scene_id").references(() => scenes.id, { onDelete: "cascade" }),
  purpose: promptPurposeEnum("purpose").notNull(),
  revision: integer("revision").notNull(),
  promptPayload: jsonb("prompt_payload").notNull(),
  responseText: text("response_text"),
  responseMetadata: jsonb("response_metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now)
}, (table) => ({
  historyLookup: index("prompt_versions_history_idx").on(table.projectId, table.sceneId, table.purpose, table.revision)
}));

export const appMigrations = pgTable("app_migrations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  checksum: text("checksum").notNull(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().default(now)
});

export type ProjectRow = typeof projects.$inferSelect;
export type SceneRow = typeof scenes.$inferSelect;
export type AssetRow = typeof assets.$inferSelect;
export type JobRow = typeof jobs.$inferSelect;
export type RenderRow = typeof renders.$inferSelect;
export type PromptVersionRow = typeof promptVersions.$inferSelect;
```

- [ ] **Step 5: Add initial migration SQL**

Create `packages/db/migrations/0001_init/migration.sql` from the Drizzle-generated SQL, then manually add function/index details that Drizzle cannot express cleanly. Include:

```sql
create table if not exists app_migrations (
  id bigserial primary key,
  name text not null unique,
  checksum text not null,
  applied_at timestamptz not null default now()
);
```

Add the `claim_next_job()` function after table creation:

```sql
create or replace function claim_next_job()
returns jobs
language sql
as $$
  with claimed as (
    select id
    from jobs
    where status = 'pending'
      and attempts < max_attempts
      and (next_retry_at is null or next_retry_at <= now())
    order by created_at
    for update skip locked
    limit 1
  )
  update jobs
  set
    status = 'processing',
    attempts = attempts + 1,
    started_at = now(),
    finished_at = null,
    next_retry_at = null,
    updated_at = now()
  where id in (select id from claimed)
  returning *;
$$;
```

- [ ] **Step 6: Add initial rollback SQL**

Create `packages/db/migrations/0001_init/down.sql`:

```sql
drop function if exists claim_next_job();
drop table if exists prompt_versions;
drop table if exists renders;
drop table if exists jobs;
drop table if exists assets;
drop table if exists scenes;
drop table if exists projects;
drop table if exists app_migrations;
drop type if exists prompt_purpose;
drop type if exists render_status;
drop type if exists job_status;
drop type if exists job_type;
drop type if exists asset_provider;
drop type if exists storage_driver;
drop type if exists asset_status;
drop type if exists asset_kind;
drop type if exists scene_role;
drop type if exists scene_status;
drop type if exists project_status;
```

- [ ] **Step 7: Implement migration runner**

Create `packages/db/scripts/migrate.ts` with these behaviors:

```ts
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const direction = process.argv[2];
const stepsArgIndex = process.argv.indexOf("--steps");
const steps = stepsArgIndex === -1 ? 1 : Number(process.argv[stepsArgIndex + 1]);

if (direction !== "up" && direction !== "down") {
  throw new Error("Usage: bun scripts/migrate.ts <up|down> [--steps N]");
}

if (!process.env.DATABASE_DIRECT_URL) {
  throw new Error("DATABASE_DIRECT_URL is required for migrations");
}

const sql = postgres(process.env.DATABASE_DIRECT_URL, { max: 1 });
const migrationsDir = path.join(import.meta.dir, "..", "migrations");

function checksum(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

async function ensureMigrationsTable() {
  await sql`
    create table if not exists app_migrations (
      id bigserial primary key,
      name text not null unique,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `;
}

async function migrationFolders() {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

async function applyUp() {
  await ensureMigrationsTable();
  const applied = await sql<{ name: string; checksum: string }[]>`select name, checksum from app_migrations`;
  const appliedByName = new Map(applied.map((row) => [row.name, row.checksum]));

  for (const name of await migrationFolders()) {
    const filePath = path.join(migrationsDir, name, "migration.sql");
    const content = await readFile(filePath, "utf8");
    const hash = checksum(content);
    const existing = appliedByName.get(name);
    if (existing && existing !== hash) {
      throw new Error(`Applied migration checksum mismatch for ${name}`);
    }
    if (existing) continue;

    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx`insert into app_migrations (name, checksum) values (${name}, ${hash})`;
    });
  }
}

async function applyDown() {
  await ensureMigrationsTable();
  const applied = await sql<{ name: string }[]>`
    select name from app_migrations order by applied_at desc, id desc limit ${steps}
  `;

  for (const row of applied) {
    const filePath = path.join(migrationsDir, row.name, "down.sql");
    const content = await readFile(filePath, "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx`delete from app_migrations where name = ${row.name}`;
    });
  }
}

try {
  if (direction === "up") await applyUp();
  if (direction === "down") await applyDown();
} finally {
  await sql.end();
}
```

- [ ] **Step 8: Implement DB check script**

Create `packages/db/scripts/check.ts`:

```ts
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const migrationsDir = path.join(import.meta.dir, "..", "migrations");
const entries = await readdir(migrationsDir, { withFileTypes: true });
const folders = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();

for (const folder of folders) {
  const migrationPath = path.join(migrationsDir, folder, "migration.sql");
  const downPath = path.join(migrationsDir, folder, "down.sql");
  const migration = await readFile(migrationPath, "utf8");
  const down = await readFile(downPath, "utf8");

  if (!migration.trim()) throw new Error(`${folder}/migration.sql is empty`);
  if (!down.trim()) throw new Error(`${folder}/down.sql is empty`);
}

console.log(`Checked ${folders.length} migration folders`);
```

- [ ] **Step 9: Verify migrations without touching DB**

Run:

```bash
bun --cwd packages/db run check
bun --cwd packages/db run typecheck
```

Expected:

```text
Checked 1 migration folders
typecheck exits 0
```

- [ ] **Step 10: Commit database foundation**

```bash
git add packages/db
git commit -m "feat: add drizzle schema and migrations"
```

---

## Task 4: Core DB Queries

**Files:**
- Modify: `packages/db/src/queries/projects.ts`
- Modify: `packages/db/src/queries/scenes.ts`
- Modify: `packages/db/src/queries/assets.ts`
- Modify: `packages/db/src/queries/jobs.ts`
- Modify: `packages/db/src/queries/renders.ts`
- Modify: `packages/db/src/queries/promptVersions.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Add project query API**

Create `packages/db/src/queries/projects.ts` with exported functions:

```ts
export async function createProject(db: DbClient, input: { title: string; topic: string; targetDurationSeconds: 30 | 45 | 60 }) {}
export async function getProject(db: DbClient, projectId: string) {}
export async function listProjects(db: DbClient) {}
export async function updateProject(db: DbClient, projectId: string, input: { title?: string; topic?: string }) {}
export async function deleteProjectRows(db: DbClient, projectId: string) {}
export async function setProjectStatus(db: DbClient, projectId: string, status: "draft" | "ready" | "rendering" | "done" | "failed") {}
```

Implement them with Drizzle queries. Return camelCase objects matching `packages/shared` schemas.

- [ ] **Step 2: Add scene query API**

Create `packages/db/src/queries/scenes.ts` with:

```ts
export function computeSceneStatus(input: { narration: string; caption: string; imagePrompt: string; ssml: string }) {
  return input.narration.trim() && input.caption.trim() && input.imagePrompt.trim() && input.ssml.trim() ? "ready" : "draft";
}
```

Add `replaceProjectScenes(db, projectId, scenes)` that updates rows by position inside a transaction. It must keep scene ids stable when rows already exist for a position and must update `content_updated_at` only when normalized content changes.

- [ ] **Step 3: Add asset query API**

Create `packages/db/src/queries/assets.ts` with:

```ts
export async function createPendingAsset(db: DbClient, input: CreatePendingAssetInput) {}
export async function markAssetReady(db: DbClient, assetId: string, input: ReadyAssetInput) {}
export async function markAssetFailed(db: DbClient, assetId: string, errorMessage: string) {}
export async function listProjectAssets(db: DbClient, projectId: string) {}
export async function getCurrentReadySceneAsset(db: DbClient, input: { sceneId: string; kind: "image" | "audio" }) {}
```

Use `asset.created_at >= scene.content_updated_at` when selecting current ready scene assets.

- [ ] **Step 4: Add job query API**

Create `packages/db/src/queries/jobs.ts` with:

```ts
export async function createJobIdempotent(db: DbClient, input: CreateJobInput) {}
export async function claimNextJob(db: DbClient) {}
export async function markJobSucceeded(db: DbClient, jobId: string, output: Record<string, unknown>) {}
export async function markJobFailedOrRetry(db: DbClient, job: JobRow, errorMessage: string) {}
export async function retryFailedJob(db: DbClient, jobId: string) {}
export async function recoverStaleJobs(db: DbClient, olderThanMinutes = 10) {}
export async function listProjectJobs(db: DbClient, projectId: string, status?: "active") {}
```

`markJobFailedOrRetry` must use:

```ts
export function retryDelaySeconds(attempts: number) {
  return Math.min(300, 30 * 2 ** Math.max(0, attempts - 1));
}
```

- [ ] **Step 5: Add render and prompt query APIs**

Create render functions:

```ts
export async function createRenderAttempt(db: DbClient, input: CreateRenderAttemptInput) {}
export async function markRenderSucceeded(db: DbClient, renderId: string, inputAssetId: string, outputAssetId: string) {}
export async function markRenderFailed(db: DbClient, renderId: string, errorMessage: string) {}
export async function acknowledgeRenderDisclosure(db: DbClient, renderId: string) {}
```

Create prompt version functions:

```ts
export async function insertPromptVersion(db: DbClient, input: InsertPromptVersionInput) {}
export async function nextPromptRevision(db: DbClient, input: { projectId: string; sceneId: string | null; purpose: PromptPurpose }) {}
```

- [ ] **Step 6: Add focused query tests**

Add `packages/db/src/queries/jobs.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { retryDelaySeconds } from "./jobs";

describe("job retry delay", () => {
  it("uses capped exponential delay", () => {
    expect(retryDelaySeconds(1)).toBe(30);
    expect(retryDelaySeconds(2)).toBe(60);
    expect(retryDelaySeconds(3)).toBe(120);
    expect(retryDelaySeconds(4)).toBe(240);
    expect(retryDelaySeconds(5)).toBe(300);
  });
});
```

- [ ] **Step 7: Verify DB package**

Run:

```bash
bun --cwd packages/db test
bun --cwd packages/db run typecheck
```

Expected:

```text
1 pass
typecheck exits 0
```

- [ ] **Step 8: Commit core queries**

```bash
git add packages/db
git commit -m "feat: add database query layer"
```

---

## Task 5: API Server And Project Endpoints

**Files:**
- Modify: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/env.ts`
- Create: `apps/api/src/http.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/routes/health.ts`
- Create: `apps/api/src/routes/projects.ts`
- Create: `apps/api/src/services/projects.ts`
- Create: `apps/api/src/services/jobs.ts`

- [ ] **Step 1: Add API dependencies**

Set `apps/api/package.json`:

```json
{
  "name": "@short-workflow/api",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "check": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@elysiajs/cors": "latest",
    "@short-workflow/db": "workspace:*",
    "@short-workflow/shared": "workspace:*",
    "elysia": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "typescript": "latest"
  }
}
```

- [ ] **Step 2: Create env parser**

Create `apps/api/src/env.ts`:

```ts
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  LOCAL_ASSET_ROOT: z.string().min(1),
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().int().positive().default(3001)
});

export const env = envSchema.parse(process.env);
```

- [ ] **Step 3: Create app factory**

Create `apps/api/src/app.ts`:

```ts
import cors from "@elysiajs/cors";
import { Elysia } from "elysia";
import { createDbClient } from "@short-workflow/db";
import { healthRoutes } from "./routes/health";
import { projectRoutes } from "./routes/projects";

export function createApp() {
  const { db } = createDbClient();

  return new Elysia()
    .use(cors({ origin: "http://localhost:5173" }))
    .decorate("db", db)
    .use(healthRoutes)
    .use(projectRoutes);
}
```

- [ ] **Step 4: Create health route**

Create `apps/api/src/routes/health.ts`:

```ts
import { Elysia } from "elysia";

export const healthRoutes = new Elysia().get("/health", () => ({
  ok: true,
  service: "short-workflow-api"
}));
```

- [ ] **Step 5: Create project endpoints**

Create `apps/api/src/routes/projects.ts` with endpoints:

```ts
GET /projects
POST /projects
GET /projects/:projectId
PATCH /projects/:projectId
DELETE /projects/:projectId
GET /projects/:projectId/scenes
GET /projects/:projectId/assets
GET /projects/:projectId/renders
GET /projects/:projectId/jobs
```

Validate request bodies with shared Zod schemas. Convert validation errors to `400` JSON responses:

```json
{ "error": "validation_failed", "details": [] }
```

- [ ] **Step 6: Implement destructive delete precondition**

In `apps/api/src/services/projects.ts`, implement:

```ts
export async function assertProjectCanDelete(db: DbClient, projectId: string) {
  const activeJobs = await listProjectJobs(db, projectId, "active");
  if (activeJobs.length > 0) {
    return { ok: false as const, status: 409, error: "project_has_active_jobs" };
  }
  return { ok: true as const };
}
```

Delete local files only after active jobs check passes.

- [ ] **Step 7: Verify API typecheck**

Run:

```bash
bun --cwd apps/api run typecheck
```

Expected:

```text
typecheck exits 0
```

- [ ] **Step 8: Manually verify health**

Run:

```bash
bun run dev:api
curl http://127.0.0.1:3001/health
```

Expected:

```json
{"ok":true,"service":"short-workflow-api"}
```

- [ ] **Step 9: Commit API foundation**

```bash
git add apps/api
git commit -m "feat: add api project endpoints"
```

---

## Task 6: Job Endpoints And Render Preconditions

**Files:**
- Modify: `apps/api/src/routes/projects.ts`
- Modify: `apps/api/src/services/jobs.ts`
- Modify: `apps/api/src/services/projects.ts`
- Modify: `packages/shared/src/api.ts`

- [ ] **Step 1: Add job trigger endpoints**

Add endpoints:

```ts
POST /projects/:projectId/generate-script
POST /scenes/:sceneId/generate-image
POST /scenes/:sceneId/generate-audio
POST /projects/:projectId/render
POST /jobs/:jobId/retry
POST /renders/:renderId/acknowledge
```

Each generation endpoint must return an existing active job when the idempotency scope already has one.

- [ ] **Step 2: Add render precondition function**

Implement `buildRenderPreconditionReport` in `apps/api/src/services/projects.ts`:

```ts
export async function buildRenderPreconditionReport(db: DbClient, projectId: string) {
  const scenes = await listProjectScenes(db, projectId);
  const assets = await listProjectAssets(db, projectId);

  return {
    scenesNotReady: scenes.filter((scene) => scene.status !== "ready").map((scene) => scene.id),
    scenesMissingImage: [],
    scenesMissingAudio: [],
    scenesStaleImage: [],
    scenesStaleAudio: []
  };
}
```

Complete missing/stale lists by comparing current ready assets with each scene's `contentUpdatedAt`.

- [ ] **Step 3: Return 422 for failed render preconditions**

`POST /projects/:projectId/render` must return:

```json
{
  "error": "render_preconditions_failed",
  "details": {
    "scenesNotReady": [],
    "scenesMissingImage": [],
    "scenesMissingAudio": [],
    "scenesStaleImage": [],
    "scenesStaleAudio": []
  }
}
```

Use HTTP `422`.

- [ ] **Step 4: Add retry constraints**

`POST /jobs/:jobId/retry` must:

```ts
if (job.status !== "failed") {
  return new Response(JSON.stringify({ error: "retry_requires_failed_job" }), { status: 409 });
}
```

User retry creates a new job with `attempts = 0`, `nextRetryAt = null`, and `parentJobId` set to the failed job id.

- [ ] **Step 5: Verify API job typecheck**

Run:

```bash
bun --cwd apps/api run typecheck
```

Expected:

```text
typecheck exits 0
```

- [ ] **Step 6: Commit job endpoints**

```bash
git add apps/api packages/shared
git commit -m "feat: add job trigger endpoints"
```

---

## Task 7: AI Provider Package

**Files:**
- Modify: `packages/ai/package.json`
- Create: `packages/ai/tsconfig.json`
- Create: `packages/ai/src/types.ts`
- Create: `packages/ai/src/openai.ts`
- Create: `packages/ai/src/googleImage.ts`
- Create: `packages/ai/src/googleTts.ts`
- Create: `packages/ai/src/index.ts`

- [ ] **Step 1: Add AI dependencies**

Set `packages/ai/package.json`:

```json
{
  "name": "@short-workflow/ai",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "check": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@google-cloud/text-to-speech": "latest",
    "openai": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "typescript": "latest"
  }
}
```

- [ ] **Step 2: Define provider-neutral types**

Create `packages/ai/src/types.ts`:

```ts
export type ScriptScene = {
  position: number;
  role: "hook" | "context" | "point" | "payoff" | "cta";
  durationSeconds: number;
  narration: string;
  caption: string;
  imagePrompt: string;
  ssml: string;
};

export type GenerateScriptInput = {
  topic: string;
  targetDurationSeconds: 30 | 45 | 60;
};

export type GenerateScriptOutput = {
  title: string;
  scenes: ScriptScene[];
  responseText: string;
  responseMetadata: Record<string, unknown>;
};

export type GenerateImageOutput = {
  bytes: Uint8Array;
  mimeType: "image/png";
  model: string;
  responseMetadata: Record<string, unknown>;
};

export type GenerateAudioOutput = {
  bytes: Uint8Array;
  mimeType: "audio/mpeg";
  model: string;
  responseMetadata: Record<string, unknown>;
};
```

- [ ] **Step 3: Implement OpenAI script client**

Create `packages/ai/src/openai.ts` with `generateScript(input)`. It must request structured JSON with the exact scene count and roles for 30, 45, and 60 seconds. Use `gpt-5.5` as the model id from the design unless provider availability requires an env override named `OPENAI_MODEL`.

- [ ] **Step 4: Implement Google image and TTS clients**

Create `generateImage({ prompt })` in `googleImage.ts` and `generateSpeech({ ssml })` in `googleTts.ts`. Both functions return bytes and compact metadata only. They must never return base64 strings to callers.

- [ ] **Step 5: Export provider package**

Create `packages/ai/src/index.ts`:

```ts
export * from "./googleImage";
export * from "./googleTts";
export * from "./openai";
export * from "./types";
```

- [ ] **Step 6: Verify AI package**

Run:

```bash
bun --cwd packages/ai run typecheck
```

Expected:

```text
typecheck exits 0
```

- [ ] **Step 7: Commit AI package**

```bash
git add packages/ai
git commit -m "feat: add ai provider clients"
```

---

## Task 8: Worker Core And Asset Utilities

**Files:**
- Modify: `apps/worker/package.json`
- Create: `apps/worker/tsconfig.json`
- Create: `apps/worker/src/env.ts`
- Create: `apps/worker/src/assets.ts`
- Create: `apps/worker/src/retry.ts`
- Create: `apps/worker/src/loop.ts`
- Create: `apps/worker/src/index.ts`
- Create: `apps/worker/src/handlers/index.ts`

- [ ] **Step 1: Add worker dependencies**

Set dependencies:

```json
{
  "dependencies": {
    "@short-workflow/ai": "workspace:*",
    "@short-workflow/db": "workspace:*",
    "@short-workflow/shared": "workspace:*",
    "zod": "latest"
  }
}
```

- [ ] **Step 2: Add env parser**

Create `apps/worker/src/env.ts`:

```ts
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  LOCAL_ASSET_ROOT: z.string().min(1),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(2)
});

export const env = envSchema.parse(process.env);
```

- [ ] **Step 3: Add asset utilities**

Create `apps/worker/src/assets.ts` with:

```ts
import { createHash } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export function absoluteAssetPath(root: string, relativePath: string) {
  return path.join(root, relativePath);
}

export async function writeAssetFile(root: string, relativePath: string, bytes: Uint8Array) {
  const absolutePath = absoluteAssetPath(root, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, bytes);
  const info = await stat(absolutePath);
  const checksum = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  return { absolutePath, sizeBytes: info.size, checksum };
}
```

- [ ] **Step 4: Add worker loop**

Create `apps/worker/src/loop.ts`:

```ts
import { createDbClient } from "@short-workflow/db";
import { env } from "./env";
import { handleJob } from "./handlers";

export async function runWorker() {
  const { db, client } = createDbClient();

  await Promise.all(
    Array.from({ length: env.WORKER_CONCURRENCY }, async () => {
      while (true) {
        const job = await claimNextJob(db);
        if (!job) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        }
        await handleJob(db, job);
      }
    })
  );

  await client.end();
}
```

Import `claimNextJob` from `@short-workflow/db` after Task 4 exports it.

- [ ] **Step 5: Verify worker typecheck**

Run:

```bash
bun --cwd apps/worker run typecheck
```

Expected:

```text
typecheck exits 0
```

- [ ] **Step 6: Commit worker core**

```bash
git add apps/worker
git commit -m "feat: add worker core loop"
```

---

## Task 9: Worker Job Handlers

**Files:**
- Create: `apps/worker/src/handlers/generateScript.ts`
- Create: `apps/worker/src/handlers/generateSceneImage.ts`
- Create: `apps/worker/src/handlers/generateSceneAudio.ts`
- Create: `apps/worker/src/handlers/renderVideo.ts`
- Modify: `apps/worker/src/handlers/index.ts`

- [ ] **Step 1: Add handler dispatch**

Create `apps/worker/src/handlers/index.ts`:

```ts
import type { DbClient, JobRow } from "@short-workflow/db";
import { handleGenerateSceneAudio } from "./generateSceneAudio";
import { handleGenerateSceneImage } from "./generateSceneImage";
import { handleGenerateScript } from "./generateScript";
import { handleRenderVideo } from "./renderVideo";

export async function handleJob(db: DbClient, job: JobRow) {
  switch (job.type) {
    case "generate_script":
      return handleGenerateScript(db, job);
    case "generate_scene_image":
      return handleGenerateSceneImage(db, job);
    case "generate_scene_audio":
      return handleGenerateSceneAudio(db, job);
    case "render_video":
      return handleRenderVideo(db, job);
  }
}
```

- [ ] **Step 2: Implement script handler**

`handleGenerateScript` must:

1. Load project by `job.projectId`.
2. Call `generateScript`.
3. Insert `prompt_versions` row with purpose `script`.
4. Replace scenes by position.
5. Mark project `ready`.
6. Mark job succeeded with `{ sceneIds }`.
7. On failure call `markJobFailedOrRetry`.

- [ ] **Step 3: Implement image handler**

`handleGenerateSceneImage` must:

1. Load scene and project.
2. Create pending `image` asset.
3. Call Google image client with `scene.imagePrompt`.
4. Write `projects/{projectId}/scenes/{sceneId}/images/{assetId}.png`.
5. Mark asset ready with `mimeType`, `sizeBytes`, `checksum`, provider `google_gemini`.
6. Mark job succeeded with `{ assetId }`.

- [ ] **Step 4: Implement audio handler**

`handleGenerateSceneAudio` must:

1. Load scene and project.
2. Create pending `audio` asset.
3. Call Google TTS with `scene.ssml`.
4. Write `projects/{projectId}/scenes/{sceneId}/audio/{assetId}.mp3`.
5. Mark asset ready with provider `google_tts`.
6. Mark job succeeded with `{ assetId }`.

- [ ] **Step 5: Implement render handler**

`handleRenderVideo` must:

1. Create render attempt row with `processing`.
2. Build render input from current ready scene image/audio assets.
3. Write render input JSON to `projects/{projectId}/input/{renderId}.json` as a `render_input` asset.
4. Run `bun --cwd apps/render run render:project -- --input <absoluteInputPath> --output <absoluteOutputPath>` through `Bun.spawn`.
5. Mark MP4 output as a `render` asset at `projects/{projectId}/renders/{renderId}.mp4`.
6. Mark render and job succeeded.
7. Mark project `done`.

- [ ] **Step 6: Verify worker handlers**

Run:

```bash
bun --cwd apps/worker run typecheck
```

Expected:

```text
typecheck exits 0
```

- [ ] **Step 7: Commit worker handlers**

```bash
git add apps/worker
git commit -m "feat: add worker job handlers"
```

---

## Task 10: Remotion Renderer

**Files:**
- Modify: `apps/render/package.json`
- Create: `apps/render/tsconfig.json`
- Create: `apps/render/src/schema.ts`
- Create: `apps/render/src/Root.tsx`
- Create: `apps/render/src/ShortVideo.tsx`
- Create: `apps/render/src/render.ts`

- [ ] **Step 1: Add Remotion dependencies**

Set `apps/render/package.json`:

```json
{
  "name": "@short-workflow/render",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "remotion studio src/Root.tsx",
    "render:project": "node --loader tsx src/render.ts",
    "check": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@remotion/cli": "latest",
    "remotion": "latest",
    "@short-workflow/shared": "workspace:*",
    "tsx": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "typescript": "latest"
  }
}
```

- [ ] **Step 2: Register composition**

Create `apps/render/src/Root.tsx`:

```tsx
import { Composition } from "remotion";
import { RENDER_FPS, RENDER_HEIGHT, RENDER_WIDTH } from "@short-workflow/shared";
import { ShortVideo } from "./ShortVideo";

export function RemotionRoot() {
  return (
    <Composition
      id="ShortVideo"
      component={ShortVideo}
      durationInFrames={45 * RENDER_FPS}
      fps={RENDER_FPS}
      width={RENDER_WIDTH}
      height={RENDER_HEIGHT}
      defaultProps={{ scenes: [], projectId: "", renderId: "", durationSeconds: 45 }}
    />
  );
}
```

- [ ] **Step 3: Implement composition**

Create `apps/render/src/ShortVideo.tsx`. It should render one full-screen scene at a time using image path, audio, and caption:

```tsx
import { AbsoluteFill, Audio, Img, Sequence, staticFile } from "remotion";
import type { RenderInput } from "@short-workflow/shared";

export function ShortVideo(props: RenderInput) {
  let frameStart = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#09090b" }}>
      {props.scenes.map((scene) => {
        const from = frameStart;
        const durationInFrames = scene.durationSeconds * props.fps;
        frameStart += durationInFrames;

        return (
          <Sequence key={scene.id} from={from} durationInFrames={durationInFrames}>
            <AbsoluteFill>
              <Img src={staticFile(scene.imagePath)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <Audio src={staticFile(scene.audioPath)} />
              <div style={{
                position: "absolute",
                left: 72,
                right: 72,
                bottom: 160,
                color: "white",
                fontFamily: "Inter, sans-serif",
                fontSize: 72,
                fontWeight: 800,
                lineHeight: 1.05,
                textShadow: "0 4px 24px rgba(0,0,0,.75)"
              }}>
                {scene.caption}
              </div>
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
```

- [ ] **Step 4: Implement render CLI**

Create `apps/render/src/render.ts` that reads `--input` and `--output`, validates with `renderInputSchema`, and calls Remotion `renderMedia`.

- [ ] **Step 5: Add fixture render verification**

Create a tiny fixture JSON under `apps/render/fixtures/smoke.json` after sample image/audio assets exist. For the first smoke without assets, run typecheck only.

Run:

```bash
bun --cwd apps/render run typecheck
```

Expected:

```text
typecheck exits 0
```

- [ ] **Step 6: Commit renderer**

```bash
git add apps/render
git commit -m "feat: add remotion renderer"
```

---

## Task 11: Web App Foundation

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/index.html`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/router.tsx`
- Create: `apps/web/src/routes/__root.tsx`
- Create: `apps/web/src/routes/index.tsx`
- Create: `apps/web/src/routes/projects.$projectId.tsx`
- Create: `apps/web/src/api/client.ts`
- Create: `apps/web/src/api/queryKeys.ts`
- Create: `apps/web/src/styles/globals.css`
- Create: `apps/web/src/components/layout/AppShell.tsx`

- [ ] **Step 1: Add web dependencies**

Use dependencies:

```json
{
  "dependencies": {
    "@hookform/resolvers": "latest",
    "@short-workflow/shared": "workspace:*",
    "@tanstack/react-query": "latest",
    "@tanstack/react-query-devtools": "latest",
    "@tanstack/react-router": "latest",
    "class-variance-authority": "latest",
    "clsx": "latest",
    "lucide-react": "latest",
    "react": "latest",
    "react-dom": "latest",
    "react-hook-form": "latest",
    "tailwind-merge": "latest",
    "tailwindcss": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@tanstack/router-plugin": "latest",
    "@tailwindcss/vite": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "@vitejs/plugin-react": "latest",
    "typescript": "latest",
    "vite": "latest"
  }
}
```

- [ ] **Step 2: Configure Vite with TanStack Router and Tailwind**

Create `apps/web/vite.config.ts`:

```ts
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss()
  ],
  server: {
    host: "127.0.0.1",
    port: 5173
  }
});
```

- [ ] **Step 3: Create query client and router root**

Create `apps/web/src/main.tsx` with `QueryClientProvider` and conservative defaults:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import "./styles/globals.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      gcTime: 5 * 60 * 1000,
      retry: 1
    },
    mutations: {
      retry: false
    }
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} context={{ queryClient }} />
    </QueryClientProvider>
  </React.StrictMode>
);
```

- [ ] **Step 4: Create API client**

Create `apps/web/src/api/client.ts`:

```ts
export class ApiError extends Error {
  constructor(public status: number, public payload: unknown) {
    super(`API request failed with status ${status}`);
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers
    }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, payload);
  return payload as T;
}
```

- [ ] **Step 5: Create query key factory**

Create `apps/web/src/api/queryKeys.ts`:

```ts
export const queryKeys = {
  projects: {
    all: ["projects"] as const,
    detail: (projectId: string) => ["projects", projectId] as const,
    scenes: (projectId: string) => ["projects", projectId, "scenes"] as const,
    assets: (projectId: string) => ["projects", projectId, "assets"] as const,
    renders: (projectId: string) => ["projects", projectId, "renders"] as const,
    jobs: (projectId: string, status?: string) => ["projects", projectId, "jobs", status ?? "all"] as const
  }
};
```

- [ ] **Step 6: Verify web foundation**

Run:

```bash
bun --cwd apps/web run typecheck
```

Expected:

```text
typecheck exits 0
```

- [ ] **Step 7: Commit web foundation**

```bash
git add apps/web
git commit -m "feat: add web app foundation"
```

---

## Task 12: Web Project Workflow UI

**Files:**
- Create: `apps/web/src/features/projects/hooks.ts`
- Create: `apps/web/src/features/projects/ProjectCreateForm.tsx`
- Create: `apps/web/src/features/projects/ProjectWorkflow.tsx`
- Create: `apps/web/src/features/projects/SceneEditor.tsx`
- Create: `apps/web/src/features/projects/AssetPanel.tsx`
- Create: `apps/web/src/features/projects/RenderPanel.tsx`
- Modify: `apps/web/src/routes/index.tsx`
- Modify: `apps/web/src/routes/projects.$projectId.tsx`

- [ ] **Step 1: Add query hooks**

Create hooks:

```ts
export function useProjectsQuery() {}
export function useProjectQuery(projectId: string) {}
export function useProjectJobsQuery(projectId: string, status?: "active") {}
export function useCreateProjectMutation() {}
export function useUpdateSceneMutation(projectId: string, sceneId: string) {}
export function useGenerateScriptMutation(projectId: string) {}
export function useGenerateSceneImageMutation(projectId: string, sceneId: string) {}
export function useGenerateSceneAudioMutation(projectId: string, sceneId: string) {}
export function useRenderProjectMutation(projectId: string) {}
```

Use `queryKeys` and `apiFetch`. Scene patch `onMutate` must invalidate or mark scene assets stale before `onSuccess`.

- [ ] **Step 2: Add project create form**

Use `react-hook-form` with `zodResolver(createProjectRequestSchema)`. Submit calls `useCreateProjectMutation`.

- [ ] **Step 3: Add project workflow shell**

`ProjectWorkflow` layout:

- left rail: project status and steps
- center: scene list and selected scene editor
- right panel: asset controls, job progress, render controls

Use app text in English only.

- [ ] **Step 4: Add scene editor**

`SceneEditor` fields:

- narration textarea
- caption textarea
- image prompt textarea
- SSML textarea
- duration seconds read-only for MVP unless scene exists before generation

Submit calls `PATCH /scenes/:sceneId`.

- [ ] **Step 5: Add asset and render panels**

`AssetPanel` shows current/stale image/audio status and generation buttons.

`RenderPanel` shows 422 render precondition errors inline with scene ids and asset kinds, and requires disclosure acknowledgement before export confirmation.

- [ ] **Step 6: Add polling behavior**

`useProjectJobsQuery(projectId, "active")` polls every 2 seconds while active jobs exist. When active jobs become empty, invalidate project detail, scenes, assets, and renders.

- [ ] **Step 7: Verify web workflow**

Run:

```bash
bun --cwd apps/web run typecheck
```

Expected:

```text
typecheck exits 0
```

- [ ] **Step 8: Commit web workflow**

```bash
git add apps/web
git commit -m "feat: add project workflow ui"
```

---

## Task 13: Local End-To-End Smoke Flow

**Files:**
- Modify: `README.md`
- Create: `scripts/smoke/create-project.sh`
- Create: `scripts/smoke/run-local-flow.md`

- [ ] **Step 1: Document environment setup**

Update `README.md` with:

```md
## Local MVP Setup

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL` to the Supabase pooled connection string.
3. Set `DATABASE_DIRECT_URL` to the Supabase direct connection string.
4. Set `LOCAL_ASSET_ROOT` to an absolute directory on this machine.
5. Set provider keys for OpenAI, Google image generation, and Google Text-to-Speech.
6. Run `bun install`.
7. Run `bun run db:check`.
8. Run `bun run db:migrate:up`.
9. Run `bun run dev`.
```

- [ ] **Step 2: Add smoke curl script**

Create `scripts/smoke/create-project.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

curl -sS http://127.0.0.1:3001/projects \
  -H 'content-type: application/json' \
  -d '{"title":"Test Short","topic":"Why tiny habits compound","targetDurationSeconds":45}'
```

- [ ] **Step 3: Add manual smoke checklist**

Create `scripts/smoke/run-local-flow.md`:

```md
# Local Smoke Flow

- [ ] Run `bun run db:check`.
- [ ] Run `bun run db:migrate:up`.
- [ ] Run `bun run dev:api`.
- [ ] Run `curl http://127.0.0.1:3001/health` and confirm `{"ok":true,"service":"short-workflow-api"}`.
- [ ] Run `scripts/smoke/create-project.sh`.
- [ ] Run `bun run dev:worker`.
- [ ] In the web app, create or open the project.
- [ ] Generate script.
- [ ] Generate scene images.
- [ ] Generate scene audio.
- [ ] Render MP4.
- [ ] Confirm output MP4 exists under `{LOCAL_ASSET_ROOT}/projects/{projectId}/renders/{renderId}.mp4`.
```

- [ ] **Step 4: Run final checks**

Run:

```bash
bun run check
bun run typecheck
```

Expected:

```text
all package checks exit 0
all package typechecks exit 0
```

- [ ] **Step 5: Commit smoke docs**

```bash
git add README.md scripts/smoke
git commit -m "docs: add local smoke flow"
```

---

## Self-Review

Spec coverage:

- Monorepo, Bun workspaces, Turborepo: Tasks 1 and 13.
- Shared Zod contracts: Task 2.
- Hosted Supabase, Drizzle, reversible migrations, direct vs pooled URLs: Tasks 3 and 4.
- Elysia API and endpoints: Tasks 5 and 6.
- Worker, atomic claim, retry, local asset writes: Tasks 8 and 9.
- AI clients: Task 7.
- Remotion Node renderer: Task 10.
- React/TanStack/Tailwind/shadcn frontend: Tasks 11 and 12.
- Manual MVP verification: Task 13.

Plan checks:

- No production DB access goes through `drizzle-kit push`.
- `DATABASE_DIRECT_URL` is used for migration tooling.
- `DATABASE_URL` is used for runtime.
- `apps/web` never imports `packages/db`.
- Local assets remain under `LOCAL_ASSET_ROOT`.
- Render input generation stays an internal worker sub-step.
