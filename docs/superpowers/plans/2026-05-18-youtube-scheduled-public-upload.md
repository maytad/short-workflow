# YouTube Scheduled Public Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manual YouTube upload mode that automatically reserves the next available public publish slot from the database and uploads the video as private with `publishAt`.

**Architecture:** Keep `upload_youtube` as the project-level worker job. Add a `youtube_upload_schedules` table for DB-backed slot reservation, extend shared contracts to distinguish private versus scheduled public uploads, and update API, worker, and web UI around the existing upload flow.

**Tech Stack:** Bun, TypeScript, ElysiaJS, Drizzle ORM, Postgres migrations, React, TanStack Query, Tailwind, YouTube Data API resumable upload.

---

## Source Spec

Implement the approved spec:

`docs/superpowers/specs/2026-05-18-youtube-scheduled-public-upload-design.md`

Do not add new runtime dependencies. Do not add automated upload after render. The user still clicks upload manually.

## Dirty Worktree Warning

The current workspace already has unrelated uncommitted work from prior tasks. When committing implementation tasks, stage only the files listed in the task being committed. Do not stage:

- `.claude/settings.local.json`
- `.DS_Store`
- unrelated dirty files outside the current task

## File Structure

- Modify `packages/shared/src/schemas.ts`
  - Add upload mode, request, response, schedule, and extended job input/output schemas.
- Modify `packages/shared/src/api.ts`
  - Export upload request/response schemas for the API route and web hook.
- Add `packages/shared/src/youtubeUpload.test.ts`
  - Validate private and scheduled public contracts.
- Modify `packages/db/src/schema.ts`
  - Add `youtubeUploadSchedules` table and row type.
- Add `packages/db/src/queries/youtubeSchedules.ts`
  - Own schedule slot generation, reservation, schedule status updates, and latest schedule lookup.
- Modify `packages/db/src/index.ts`
  - Export the new query module.
- Add `packages/db/src/queries/youtubeSchedules.test.ts`
  - Test pure candidate generation and dependency-injected reservation behavior.
- Add `packages/db/migrations/0005_add_youtube_upload_schedules/migration.sql`
  - Create the schedule table and indexes.
- Add `packages/db/migrations/0005_add_youtube_upload_schedules/down.sql`
  - Drop table only when no rows exist.
- Modify `apps/api/src/env.ts`
  - Add schedule defaults.
- Modify `apps/api/src/services/projects.ts`
  - Build private or scheduled upload job input and expose upload summaries with schedule fields.
- Modify `apps/api/src/routes/projects.ts`
  - Parse upload body, reserve schedule slot inside a transaction lock, and return `{ job, schedule }`.
- Modify `apps/api/src/app.test.ts`
  - Route tests for private upload, scheduled upload, active upload, and full schedule error.
- Modify `apps/worker/src/youtube/upload.ts`
  - Rename upload function and send `publishAt` only for scheduled mode.
- Modify `apps/worker/src/youtube/upload.test.ts`
  - Verify scheduled request body includes `publishAt`.
- Modify `apps/worker/src/handlers/uploadYoutube.ts`
  - Update schedule status around upload success/failure.
- Modify `apps/web/src/features/projects/hooks.ts`
  - Send upload mode request and consume response.
- Modify `apps/web/src/features/projects/YoutubeUploadDialog.tsx`
  - Add private/scheduled mode selector and scheduled copy.
- Modify `apps/web/src/features/projects/RenderPanel.tsx`
  - Display scheduled public status and local publish time.
- Modify `apps/web/src/features/projects/workflow.test.ts`
  - Test schedule time formatting helper.

---

## Task 1: Shared YouTube Upload Contracts

**Files:**
- Modify: `packages/shared/src/schemas.ts`
- Modify: `packages/shared/src/api.ts`
- Add: `packages/shared/src/youtubeUpload.test.ts`

- [ ] **Step 1: Add failing shared contract tests**

Create `packages/shared/src/youtubeUpload.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import {
  youtubeUploadJobInputSchema,
  youtubeUploadRequestSchema,
  youtubeUploadResponseSchema,
} from "./index";

const renderId = "11111111-1111-4111-8111-111111111111";
const outputAssetId = "22222222-2222-4222-8222-222222222222";
const scheduleId = "33333333-3333-4333-8333-333333333333";
const publishAt = "2026-05-19T02:00:00.000Z";

function baseUploadInput() {
  return {
    renderId,
    outputAssetId,
    title: "Why cold batteries fade fast",
    description: "A compact explanation.\n\n#Shorts",
    tags: ["Shorts", "Engineering"],
    privacyStatus: "private",
    selfDeclaredMadeForKids: false,
    containsSyntheticMedia: true,
  };
}

describe("youtube upload contracts", () => {
  test("accepts private upload requests", () => {
    expect(youtubeUploadRequestSchema.parse({ mode: "private" })).toEqual({
      mode: "private",
    });
  });

  test("defaults upload requests to scheduled public mode", () => {
    expect(youtubeUploadRequestSchema.parse({})).toEqual({
      mode: "scheduled_public",
    });
  });

  test("accepts scheduled public upload job input with publishAt", () => {
    expect(
      youtubeUploadJobInputSchema.parse({
        ...baseUploadInput(),
        mode: "scheduled_public",
        scheduleId,
        publishAt,
      }),
    ).toMatchObject({
      mode: "scheduled_public",
      scheduleId,
      publishAt,
      privacyStatus: "private",
    });
  });

  test("rejects scheduled public upload job input without publishAt", () => {
    expect(() =>
      youtubeUploadJobInputSchema.parse({
        ...baseUploadInput(),
        mode: "scheduled_public",
        scheduleId,
      }),
    ).toThrow();
  });

  test("accepts upload responses with nullable schedule", () => {
    expect(
      youtubeUploadResponseSchema.parse({
        job: {
          id: "44444444-4444-4444-8444-444444444444",
          projectId: "55555555-5555-4555-8555-555555555555",
          sceneId: null,
          type: "upload_youtube",
          status: "pending",
          attempts: 0,
          maxAttempts: 1,
          parentJobId: null,
          errorMessage: null,
          input: {},
          output: null,
          nextRetryAt: null,
          createdAt: "2026-05-18T00:00:00.000Z",
          startedAt: null,
          finishedAt: null,
          updatedAt: "2026-05-18T00:00:00.000Z",
        },
        schedule: null,
      }).schedule,
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run shared tests to confirm failure**

Run:

```bash
bun test packages/shared/src/youtubeUpload.test.ts
```

Expected before implementation: fails because `youtubeUploadRequestSchema` and `youtubeUploadResponseSchema` are not exported.

- [ ] **Step 3: Extend shared schemas**

In `packages/shared/src/schemas.ts`, replace the current upload schemas with this shape:

```ts
export const youtubeUploadModeSchema = z.enum(["private", "scheduled_public"]);
export const youtubeUploadScheduleStatusSchema = z.enum([
  "reserved",
  "uploading",
  "scheduled",
  "failed",
  "cancelled",
]);

export const youtubeUploadScheduleSchema = z
  .object({
    id: uuidSchema,
    projectId: uuidSchema,
    jobId: nullableUuidSchema,
    renderId: uuidSchema,
    outputAssetId: uuidSchema,
    scheduledPublishAt: isoDateSchema,
    timezone: z.string().min(1),
    status: youtubeUploadScheduleStatusSchema,
    youtubeVideoId: z.string().min(1).nullable(),
    errorMessage: nullableStringSchema,
    createdAt: isoDateSchema,
    updatedAt: isoDateSchema,
  })
  .strict();

export const youtubeUploadRequestSchema = z
  .object({
    mode: youtubeUploadModeSchema.default("scheduled_public"),
  })
  .strict();

const baseYoutubeUploadJobInputSchema = z.object({
  renderId: uuidSchema,
  outputAssetId: uuidSchema,
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1),
  tags: z.array(z.string().trim().min(1)).max(20),
  privacyStatus: z.literal("private"),
  selfDeclaredMadeForKids: z.literal(false),
  containsSyntheticMedia: z.literal(true),
});

export const youtubeUploadJobInputSchema = z.discriminatedUnion("mode", [
  baseYoutubeUploadJobInputSchema
    .extend({
      mode: z.literal("private"),
      publishAt: z.never().optional(),
      scheduleId: z.never().optional(),
    })
    .strict(),
  baseYoutubeUploadJobInputSchema
    .extend({
      mode: z.literal("scheduled_public"),
      publishAt: isoDateSchema,
      scheduleId: uuidSchema,
    })
    .strict(),
]);

export const youtubeUploadJobOutputSchema = z
  .object({
    youtubeVideoId: z.string().min(1),
    youtubeStudioUrl: z.url(),
    mode: youtubeUploadModeSchema,
    privacyStatus: z.literal("private"),
    publishAt: nullableIsoDateSchema,
    scheduleId: nullableUuidSchema,
    uploadedAt: isoDateSchema,
  })
  .strict();

export const youtubeUploadSummarySchema = z
  .object({
    jobId: uuidSchema,
    status: jobStatusSchema,
    mode: youtubeUploadModeSchema.nullable(),
    youtubeVideoId: z.string().min(1).nullable(),
    youtubeStudioUrl: z.url().nullable(),
    privacyStatus: z.literal("private").nullable(),
    publishAt: nullableIsoDateSchema,
    scheduledPublishAt: nullableIsoDateSchema,
    scheduleStatus: youtubeUploadScheduleStatusSchema.nullable(),
    timezone: z.string().min(1).nullable(),
    uploadedAt: nullableIsoDateSchema,
    errorMessage: nullableStringSchema,
    createdAt: isoDateSchema,
    updatedAt: isoDateSchema,
  })
  .strict();
```

At the bottom of `packages/shared/src/schemas.ts`, add these exported types:

```ts
export type YoutubeUploadMode = z.infer<typeof youtubeUploadModeSchema>;
export type YoutubeUploadRequest = z.infer<typeof youtubeUploadRequestSchema>;
export type YoutubeUploadSchedule = z.infer<typeof youtubeUploadScheduleSchema>;
export type YoutubeUploadScheduleStatus = z.infer<typeof youtubeUploadScheduleStatusSchema>;
```

- [ ] **Step 4: Add upload response schema**

In `packages/shared/src/api.ts`, import `youtubeUploadScheduleSchema`:

```ts
  youtubeUploadScheduleSchema,
```

Then add:

```ts
export const youtubeUploadResponseSchema = z
  .object({
    job: jobSchema,
    schedule: youtubeUploadScheduleSchema.nullable(),
  })
  .strict();
```

Add the type export:

```ts
export type YoutubeUploadResponse = z.infer<typeof youtubeUploadResponseSchema>;
```

- [ ] **Step 5: Run focused shared checks**

Run:

```bash
bun test packages/shared/src/youtubeUpload.test.ts
bun run --cwd packages/shared typecheck
```

Expected: both commands exit `0`.

- [ ] **Step 6: Commit shared contracts**

Stage only:

```bash
git add packages/shared/src/schemas.ts packages/shared/src/api.ts packages/shared/src/youtubeUpload.test.ts
git commit -m "feat: add scheduled youtube upload contracts"
```

---

## Task 2: Database Schedule Table And Reservation Helpers

**Files:**
- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/index.ts`
- Add: `packages/db/src/queries/youtubeSchedules.ts`
- Add: `packages/db/src/queries/youtubeSchedules.test.ts`
- Add: `packages/db/migrations/0005_add_youtube_upload_schedules/migration.sql`
- Add: `packages/db/migrations/0005_add_youtube_upload_schedules/down.sql`

- [ ] **Step 1: Add failing schedule query tests**

Create `packages/db/src/queries/youtubeSchedules.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import {
  buildYoutubeScheduleCandidates,
  parseDailyPublishTimes,
  reserveNextYoutubeScheduleSlot,
  type YoutubeScheduleDeps,
} from "./youtubeSchedules";

const projectId = "11111111-1111-4111-8111-111111111111";
const renderId = "22222222-2222-4222-8222-222222222222";
const outputAssetId = "33333333-3333-4333-8333-333333333333";

function scheduleRow(scheduledPublishAt: Date) {
  return {
    id: crypto.randomUUID(),
    projectId,
    jobId: null,
    renderId,
    outputAssetId,
    scheduledPublishAt,
    timezone: "Asia/Bangkok",
    status: "reserved",
    youtubeVideoId: null,
    errorMessage: null,
    createdAt: new Date("2026-05-18T00:00:00.000Z"),
    updatedAt: new Date("2026-05-18T00:00:00.000Z"),
  } as const;
}

describe("parseDailyPublishTimes", () => {
  test("parses and sorts HH:mm values", () => {
    expect(parseDailyPublishTimes("21:00,09:00,12:00")).toEqual([
      { hour: 9, minute: 0 },
      { hour: 12, minute: 0 },
      { hour: 21, minute: 0 },
    ]);
  });
});

describe("buildYoutubeScheduleCandidates", () => {
  test("skips slots inside the lead window in Asia/Bangkok", () => {
    const candidates = buildYoutubeScheduleCandidates({
      now: new Date("2026-05-18T01:45:00.000Z"),
      timezone: "Asia/Bangkok",
      dailyPublishTimes: parseDailyPublishTimes("09:00,12:00,17:00,21:00"),
      minLeadMinutes: 30,
      scheduleWindowDays: 1,
    });

    expect(candidates.map((date) => date.toISOString())).toEqual([
      "2026-05-18T05:00:00.000Z",
      "2026-05-18T10:00:00.000Z",
      "2026-05-18T14:00:00.000Z",
    ]);
  });
});

describe("reserveNextYoutubeScheduleSlot", () => {
  test("skips existing active reservations and inserts the next open slot", async () => {
    const firstCandidate = new Date("2026-05-18T05:00:00.000Z");
    const secondCandidate = new Date("2026-05-18T10:00:00.000Z");
    const created: Date[] = [];
    const deps: YoutubeScheduleDeps = {
      createScheduleReservation: async (_db, input) => {
        created.push(input.scheduledPublishAt);
        return scheduleRow(input.scheduledPublishAt);
      },
      listActiveSchedulesByPublishAt: async () => [scheduleRow(firstCandidate)],
    };

    const reserved = await reserveNextYoutubeScheduleSlot({} as never, {
      projectId,
      renderId,
      outputAssetId,
      now: new Date("2026-05-18T01:00:00.000Z"),
      timezone: "Asia/Bangkok",
      dailyPublishTimes: parseDailyPublishTimes("12:00,17:00"),
      minLeadMinutes: 30,
      scheduleWindowDays: 1,
    }, deps);

    expect(created).toEqual([secondCandidate]);
    expect(reserved.scheduledPublishAt.toISOString()).toBe("2026-05-18T10:00:00.000Z");
  });

  test("throws when all slots are reserved", async () => {
    const deps: YoutubeScheduleDeps = {
      createScheduleReservation: async () => {
        throw new Error("should_not_insert_reserved_slot");
      },
      listActiveSchedulesByPublishAt: async (candidates) =>
        candidates.map((scheduledPublishAt) => scheduleRow(scheduledPublishAt)),
    };

    await expect(
      reserveNextYoutubeScheduleSlot({} as never, {
        projectId,
        renderId,
        outputAssetId,
        now: new Date("2026-05-18T01:00:00.000Z"),
        timezone: "Asia/Bangkok",
        dailyPublishTimes: parseDailyPublishTimes("12:00"),
        minLeadMinutes: 30,
        scheduleWindowDays: 1,
      }, deps),
    ).rejects.toThrow("youtube_schedule_full");
  });
});
```

- [ ] **Step 2: Run DB tests to confirm failure**

Run:

```bash
bun test packages/db/src/queries/youtubeSchedules.test.ts
```

Expected before implementation: fails because the module does not exist.

- [ ] **Step 3: Add Drizzle table**

In `packages/db/src/schema.ts`, after `renders`, add:

```ts
export const youtubeUploadSchedules = pgTable(
  "youtube_upload_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    renderId: uuid("render_id")
      .notNull()
      .references(() => renders.id, { onDelete: "cascade" }),
    outputAssetId: uuid("output_asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    scheduledPublishAt: timestamp("scheduled_publish_at", { withTimezone: true }).notNull(),
    timezone: text("timezone").notNull(),
    status: text("status").notNull().default("reserved"),
    youtubeVideoId: text("youtube_video_id"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(now),
  },
  (table) => [
    check(
      "youtube_upload_schedules_status_check",
      sql`${table.status} in ('reserved', 'uploading', 'scheduled', 'failed', 'cancelled')`,
    ),
    index("youtube_upload_schedules_project_created_at_idx").on(
      table.projectId,
      table.createdAt.desc(),
    ),
    index("youtube_upload_schedules_publish_at_idx").on(table.scheduledPublishAt),
    uniqueIndex("youtube_upload_schedules_one_active_publish_slot")
      .on(table.scheduledPublishAt)
      .where(sql`${table.status} in ('reserved', 'uploading', 'scheduled')`),
  ],
);
```

Add the row type:

```ts
export type YoutubeUploadScheduleRow = typeof youtubeUploadSchedules.$inferSelect;
```

- [ ] **Step 4: Add migration**

Create `packages/db/migrations/0005_add_youtube_upload_schedules/migration.sql`:

```sql
create table youtube_upload_schedules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  job_id uuid references jobs(id) on delete set null,
  render_id uuid not null references renders(id) on delete cascade,
  output_asset_id uuid not null references assets(id) on delete cascade,
  scheduled_publish_at timestamptz not null,
  timezone text not null,
  status text not null default 'reserved',
  youtube_video_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint youtube_upload_schedules_status_check check (
    status in ('reserved', 'uploading', 'scheduled', 'failed', 'cancelled')
  )
);

create index youtube_upload_schedules_project_created_at_idx
on youtube_upload_schedules (project_id, created_at desc);

create index youtube_upload_schedules_publish_at_idx
on youtube_upload_schedules (scheduled_publish_at);

create unique index youtube_upload_schedules_one_active_publish_slot
on youtube_upload_schedules (scheduled_publish_at)
where status in ('reserved', 'uploading', 'scheduled');
```

Create `packages/db/migrations/0005_add_youtube_upload_schedules/down.sql`:

```sql
do $$
begin
  if exists (select 1 from youtube_upload_schedules) then
    raise exception 'down_blocked_youtube_upload_schedules_has_rows';
  end if;
end $$;

drop table youtube_upload_schedules;
```

- [ ] **Step 5: Add schedule queries and time helpers**

Create `packages/db/src/queries/youtubeSchedules.ts`:

```ts
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type { DbClient } from "../client";
import { youtubeUploadSchedules, type YoutubeUploadScheduleRow } from "../schema";

export type { YoutubeUploadScheduleRow };

type ScheduleTime = { hour: number; minute: number };
type ReserveInput = {
  projectId: string;
  renderId: string;
  outputAssetId: string;
  now: Date;
  timezone: string;
  dailyPublishTimes: ScheduleTime[];
  minLeadMinutes: number;
  scheduleWindowDays?: number;
};

type CreateReservationInput = Pick<
  ReserveInput,
  "projectId" | "renderId" | "outputAssetId" | "timezone"
> & {
  scheduledPublishAt: Date;
};

export type YoutubeScheduleDeps = {
  createScheduleReservation: typeof createScheduleReservation;
  listActiveSchedulesByPublishAt: typeof listActiveSchedulesByPublishAt;
};

const activeScheduleStatuses = ["reserved", "uploading", "scheduled"] as const;
const defaultYoutubeScheduleDeps: YoutubeScheduleDeps = {
  createScheduleReservation,
  listActiveSchedulesByPublishAt,
};

export function parseDailyPublishTimes(value: string) {
  const times = value
    .split(",")
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      const match = /^(\\d{2}):(\\d{2})$/.exec(raw);
      if (!match) {
        throw new Error("youtube_schedule_time_invalid");
      }

      const hour = Number(match[1]);
      const minute = Number(match[2]);
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        throw new Error("youtube_schedule_time_invalid");
      }

      return { hour, minute };
    });

  if (times.length === 0) {
    throw new Error("youtube_schedule_times_empty");
  }

  return times.sort((a, b) => a.hour - b.hour || a.minute - b.minute);
}

function zonedParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const values = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function timezoneOffsetMinutes(date: Date, timezone: string) {
  const parts = zonedParts(date, timezone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return (asUtc - date.getTime()) / 60_000;
}

function localTimeToUtc(input: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  timezone: string;
}) {
  const guess = new Date(Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute));
  const offset = timezoneOffsetMinutes(guess, input.timezone);
  return new Date(guess.getTime() - offset * 60_000);
}

function addLocalDays(
  local: Pick<ReturnType<typeof zonedParts>, "year" | "month" | "day">,
  days: number,
) {
  const date = new Date(Date.UTC(local.year, local.month - 1, local.day + days));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

export function buildYoutubeScheduleCandidates(input: {
  now: Date;
  timezone: string;
  dailyPublishTimes: ScheduleTime[];
  minLeadMinutes: number;
  scheduleWindowDays?: number;
}) {
  const minPublishAt = new Date(input.now.getTime() + input.minLeadMinutes * 60_000);
  const startLocal = zonedParts(minPublishAt, input.timezone);
  const candidates: Date[] = [];

  for (let dayOffset = 0; dayOffset < (input.scheduleWindowDays ?? 30); dayOffset += 1) {
    const localDate = addLocalDays(startLocal, dayOffset);

    for (const time of input.dailyPublishTimes) {
      const candidate = localTimeToUtc({
        ...localDate,
        hour: time.hour,
        minute: time.minute,
        timezone: input.timezone,
      });

      if (candidate.getTime() >= minPublishAt.getTime()) {
        candidates.push(candidate);
      }
    }
  }

  return candidates;
}

export async function listActiveSchedulesByPublishAt(db: DbClient, publishAt: Date[]) {
  if (publishAt.length === 0) {
    return [];
  }

  return db
    .select()
    .from(youtubeUploadSchedules)
    .where(
      and(
        inArray(youtubeUploadSchedules.status, activeScheduleStatuses),
        inArray(youtubeUploadSchedules.scheduledPublishAt, publishAt),
      ),
    );
}

export async function createScheduleReservation(db: DbClient, input: CreateReservationInput) {
  try {
    const [schedule] = await db
      .insert(youtubeUploadSchedules)
      .values({
        projectId: input.projectId,
        renderId: input.renderId,
        outputAssetId: input.outputAssetId,
        scheduledPublishAt: input.scheduledPublishAt,
        timezone: input.timezone,
        status: "reserved",
      })
      .returning();

    return schedule ?? null;
  } catch (error) {
    if (isScheduleSlotConflict(error)) {
      return null;
    }

    throw error;
  }
}

function isScheduleSlotConflict(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

export async function reserveNextYoutubeScheduleSlot(
  db: DbClient,
  input: ReserveInput,
  deps: YoutubeScheduleDeps = defaultYoutubeScheduleDeps,
) {
  const candidates = buildYoutubeScheduleCandidates(input);
  const activeSchedules = await deps.listActiveSchedulesByPublishAt(db, candidates);
  const activeTimes = new Set(
    activeSchedules.map((schedule) => schedule.scheduledPublishAt.getTime()),
  );

  for (const scheduledPublishAt of candidates) {
    if (activeTimes.has(scheduledPublishAt.getTime())) {
      continue;
    }

    const schedule = await deps.createScheduleReservation(db, {
      projectId: input.projectId,
      renderId: input.renderId,
      outputAssetId: input.outputAssetId,
      scheduledPublishAt,
      timezone: input.timezone,
    });

    if (schedule) {
      return schedule;
    }
  }

  throw new Error("youtube_schedule_full");
}

export async function attachYoutubeScheduleJob(db: DbClient, scheduleId: string, jobId: string) {
  const [schedule] = await db
    .update(youtubeUploadSchedules)
    .set({ jobId, updatedAt: sql`now()` })
    .where(eq(youtubeUploadSchedules.id, scheduleId))
    .returning();

  return schedule ?? null;
}

export async function markYoutubeScheduleUploading(db: DbClient, scheduleId: string) {
  const [schedule] = await db
    .update(youtubeUploadSchedules)
    .set({ status: "uploading", updatedAt: sql`now()` })
    .where(eq(youtubeUploadSchedules.id, scheduleId))
    .returning();

  return schedule ?? null;
}

export async function markYoutubeScheduleScheduled(
  db: DbClient,
  scheduleId: string,
  youtubeVideoId: string,
) {
  const [schedule] = await db
    .update(youtubeUploadSchedules)
    .set({
      status: "scheduled",
      youtubeVideoId,
      errorMessage: null,
      updatedAt: sql`now()`,
    })
    .where(eq(youtubeUploadSchedules.id, scheduleId))
    .returning();

  return schedule ?? null;
}

export async function markYoutubeScheduleFailed(
  db: DbClient,
  scheduleId: string,
  errorMessage: string,
) {
  const [schedule] = await db
    .update(youtubeUploadSchedules)
    .set({
      status: "failed",
      errorMessage,
      updatedAt: sql`now()`,
    })
    .where(eq(youtubeUploadSchedules.id, scheduleId))
    .returning();

  return schedule ?? null;
}

export async function getYoutubeScheduleForJob(db: DbClient, jobId: string) {
  const [schedule] = await db
    .select()
    .from(youtubeUploadSchedules)
    .where(eq(youtubeUploadSchedules.jobId, jobId))
    .limit(1);

  return schedule ?? null;
}

export async function getLatestYoutubeScheduleForProject(db: DbClient, projectId: string) {
  const [schedule] = await db
    .select()
    .from(youtubeUploadSchedules)
    .where(eq(youtubeUploadSchedules.projectId, projectId))
    .orderBy(desc(youtubeUploadSchedules.createdAt))
    .limit(1);

  return schedule ?? null;
}
```

Update `packages/db/src/index.ts`:

```ts
export * from "./queries/youtubeSchedules";
```

- [ ] **Step 6: Run DB checks**

Run:

```bash
bun test packages/db/src/queries/youtubeSchedules.test.ts
bun run --cwd packages/db typecheck
```

Expected: both commands exit `0`.

- [ ] **Step 7: Commit DB schedule layer**

Stage only:

```bash
git add packages/db/src/schema.ts packages/db/src/index.ts packages/db/src/queries/youtubeSchedules.ts packages/db/src/queries/youtubeSchedules.test.ts packages/db/migrations/0005_add_youtube_upload_schedules
git commit -m "feat: add youtube upload schedule reservations"
```

---

## Task 3: API Upload Scheduling

**Files:**
- Modify: `apps/api/src/env.ts`
- Modify: `apps/api/src/services/projects.ts`
- Modify: `apps/api/src/routes/projects.ts`
- Modify: `apps/api/src/app.test.ts`

- [ ] **Step 1: Add failing API route tests**

In `apps/api/src/app.test.ts`, update imports if needed:

```ts
import type { ProjectRouteServices } from "./routes/projects";
```

Add schedule fixture near `youtubeJob`:

```ts
// Also add `mode: "private"` to `youtubeJob.input` so the fixture matches
// the new discriminated upload job schema.
const youtubeSchedule = {
  id: "88888888-8888-4888-8888-888888888888",
  projectId: project.id,
  jobId: null,
  renderId: youtubeJob.input.renderId,
  outputAssetId: renderAsset.id,
  scheduledPublishAt: new Date("2026-05-19T02:00:00.000Z"),
  timezone: "Asia/Bangkok",
  status: "reserved",
  youtubeVideoId: null,
  errorMessage: null,
  createdAt: new Date("2026-05-18T00:00:00.000Z"),
  updatedAt: new Date("2026-05-18T00:00:00.000Z"),
} as const;
```

In `createServices`, add defaults:

```ts
reserveNextYoutubeScheduleSlot: async () => youtubeSchedule,
attachYoutubeScheduleJob: async () => ({ ...youtubeSchedule, jobId: youtubeJob.id }),
getYoutubeScheduleForJob: async () => null,
```

Update the existing active upload route test expectation to the new response envelope:

```ts
expect(await response.json()).toMatchObject({
  job: {
    id: youtubeJob.id,
    type: "upload_youtube",
  },
  schedule: null,
});
```

Update the existing private upload route test so it sends a body:

```ts
body: JSON.stringify({ mode: "private" }),
headers: { "content-type": "application/json" },
```

Add this test near the existing YouTube upload tests:

```ts
test("queues a scheduled public YouTube upload job", async () => {
  let receivedInput: unknown;
  let reservedProjectId: string | undefined;
  const app = createApp({
    db: {} as never,
    projectServices: createServices({
      getYoutubeAuthStatus: async () => ({ connected: true }),
      reserveNextYoutubeScheduleSlot: async (_db, input) => {
        reservedProjectId = input.projectId;
        return youtubeSchedule;
      },
      createJobIdempotent: async (_db, input) => {
        receivedInput = input;
        return youtubeJob;
      },
    }),
  });

  const response = await app.handle(
    request(`/projects/${project.id}/youtube-upload`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "scheduled_public" }),
    }),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    job: { id: youtubeJob.id, type: "upload_youtube" },
    schedule: {
      id: youtubeSchedule.id,
      scheduledPublishAt: youtubeSchedule.scheduledPublishAt.toISOString(),
      timezone: "Asia/Bangkok",
      status: "reserved",
    },
  });
  expect(reservedProjectId).toBe(project.id);
  expect(receivedInput).toMatchObject({
    projectId: project.id,
    sceneId: null,
    type: "upload_youtube",
    input: {
      mode: "scheduled_public",
      scheduleId: youtubeSchedule.id,
      publishAt: youtubeSchedule.scheduledPublishAt.toISOString(),
      privacyStatus: "private",
    },
    maxAttempts: 1,
  });
});
```

Add schedule-full mapping:

```ts
test("maps full YouTube schedule to conflict", async () => {
  const app = createApp({
    db: {} as never,
    projectServices: createServices({
      getYoutubeAuthStatus: async () => ({ connected: true }),
      reserveNextYoutubeScheduleSlot: async () => {
        throw new Error("youtube_schedule_full");
      },
    }),
  });

  const response = await app.handle(
    request(`/projects/${project.id}/youtube-upload`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "scheduled_public" }),
    }),
  );

  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: "youtube_schedule_full" });
});
```

- [ ] **Step 2: Run API tests to confirm failure**

Run:

```bash
bun test apps/api/src/app.test.ts
```

Expected before implementation: fails because route services and response shape do not support schedules.

- [ ] **Step 3: Add API env defaults**

In `apps/api/src/env.ts`, extend `envSchema`:

```ts
YOUTUBE_SCHEDULE_TIMEZONE: z.string().min(1).default("Asia/Bangkok"),
YOUTUBE_DAILY_PUBLISH_TIMES: z.string().min(1).default("09:00,12:00,17:00,21:00"),
YOUTUBE_SCHEDULE_MIN_LEAD_MINUTES: z.coerce.number().int().min(1).default(30),
```

Add these keys to the `Env` type and `parseEnv` return object.

- [ ] **Step 4: Extend project services**

In `apps/api/src/services/projects.ts`, add imports:

```ts
import {
  getLatestYoutubeScheduleForProject,
  type YoutubeUploadScheduleRow,
} from "@short-workflow/db";
import {
  type YoutubeUploadMode,
  youtubeUploadJobInputSchema,
} from "@short-workflow/shared";
```

Change `latestYoutubeUpload` to accept the latest schedule:

```ts
function latestYoutubeUpload(jobs: JobRow[], schedule: YoutubeUploadScheduleRow | null) {
  const job = jobs.find((candidate) => candidate.type === "upload_youtube");
  if (!job) {
    return null;
  }

  const parsedOutput = youtubeUploadJobOutputSchema.safeParse(job.output);
  const parsedInput = youtubeUploadJobInputSchema.safeParse(job.input);

  return {
    jobId: job.id,
    status: job.status,
    mode: parsedOutput.success
      ? parsedOutput.data.mode
      : parsedInput.success
        ? parsedInput.data.mode
        : null,
    youtubeVideoId: parsedOutput.success ? parsedOutput.data.youtubeVideoId : schedule?.youtubeVideoId ?? null,
    youtubeStudioUrl: parsedOutput.success ? parsedOutput.data.youtubeStudioUrl : null,
    privacyStatus: parsedOutput.success ? parsedOutput.data.privacyStatus : parsedInput.success ? parsedInput.data.privacyStatus : null,
    publishAt: parsedOutput.success ? parsedOutput.data.publishAt : parsedInput.success && parsedInput.data.mode === "scheduled_public" ? parsedInput.data.publishAt : null,
    scheduledPublishAt: schedule?.scheduledPublishAt.toISOString() ?? null,
    scheduleStatus: schedule?.status ?? null,
    timezone: schedule?.timezone ?? null,
    uploadedAt: parsedOutput.success ? parsedOutput.data.uploadedAt : null,
    errorMessage: job.errorMessage ?? schedule?.errorMessage ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}
```

Update `getProjectDetail` to load latest schedule:

```ts
const [scenes, assets, renders, jobs, youtubeSchedule] = await Promise.all([
  listProjectScenes(db, projectId),
  listProjectAssets(db, projectId),
  listProjectRenders(db, projectId),
  listProjectJobs(db, projectId),
  getLatestYoutubeScheduleForProject(db, projectId),
]);
```

Return:

```ts
youtubeUpload: latestYoutubeUpload(jobs, youtubeSchedule),
```

Change `buildYoutubeUploadJobInput` to include mode:

```ts
export async function buildYoutubeUploadJobInput(
  db: DbClient,
  projectId: string,
  mode: YoutubeUploadMode = "private",
) {
  const [renders, assets, jobs] = await Promise.all([
    listProjectRenders(db, projectId),
    listProjectAssets(db, projectId),
    listProjectJobs(db, projectId),
  ]);

  const metadata = latestYoutubeMetadata(jobs);
  if (!metadata) {
    throw new Error("youtube_upload_preconditions_failed:metadata");
  }

  const latestSucceededRender = renders.find((render) => render.status === "succeeded");
  if (!latestSucceededRender?.outputAssetId) {
    throw new Error("youtube_upload_preconditions_failed:render");
  }

  const outputAsset = assets.find(
    (asset) =>
      asset.id === latestSucceededRender.outputAssetId &&
      asset.kind === "render" &&
      asset.status === "ready" &&
      asset.storageDriver === "local",
  );
  if (!outputAsset) {
    throw new Error("youtube_upload_preconditions_failed:render_asset");
  }

  return {
    mode,
    renderId: latestSucceededRender.id,
    outputAssetId: outputAsset.id,
    title: metadata.youtubeTitle,
    description: buildYoutubeUploadDescription(metadata),
    tags: youtubeTagKeywords(metadata.hashtags),
    privacyStatus: "private" as const,
    selfDeclaredMadeForKids: false as const,
    containsSyntheticMedia: true as const,
  };
}
```

- [ ] **Step 5: Wire route services and upload route**

In `apps/api/src/routes/projects.ts`, import:

```ts
import { youtubeUploadRequestSchema } from "@short-workflow/shared";
import {
  attachYoutubeScheduleJob,
  getYoutubeScheduleForJob,
  parseDailyPublishTimes,
  reserveNextYoutubeScheduleSlot,
  withAdvisoryTransactionLock,
} from "@short-workflow/db";

import { parseEnv } from "../env";
```

Add route service fields:

```ts
reserveNextYoutubeScheduleSlot: typeof reserveNextYoutubeScheduleSlot;
attachYoutubeScheduleJob: typeof attachYoutubeScheduleJob;
getYoutubeScheduleForJob: typeof getYoutubeScheduleForJob;
```

In `defaultServices`, add the matching functions.

Replace the YouTube upload route body with:

```ts
.post("/:projectId/youtube-upload", async (context) => {
  const { body, db, params, set } = withRouteContext(context);
  const projectId = requireRouteParam(params.projectId, "projectId");
  const parsedBody = youtubeUploadRequestSchema.safeParse(body ?? {});

  if (!parsedBody.success) {
    return validationFailed(set, parsedBody.error);
  }

  const project = await services.getProject(db, projectId);
  if (!project) {
    return notFound(set);
  }

  const activeUploadJob = (
    await services.listProjectJobs(db, project.id, "active")
  ).find((job) => job.type === "upload_youtube");
  if (activeUploadJob) {
    return {
      job: activeUploadJob,
      schedule: await services.getYoutubeScheduleForJob(db, activeUploadJob.id),
    };
  }

  const authStatus = await (services.getYoutubeAuthStatus ?? defaultYoutubeAuthStatus)();
  if (!authStatus.connected) {
    return conflict(set, "youtube_not_connected");
  }

  try {
    return await withAdvisoryTransactionLock(db, `youtube-upload:${project.id}`, async (tx) => {
      const uploadInput = await services.buildYoutubeUploadJobInput(
        tx,
        project.id,
        parsedBody.data.mode,
      );
      let schedule = null;
      let input = uploadInput;

      if (parsedBody.data.mode === "scheduled_public") {
        const env = parseEnv();
        schedule = await services.reserveNextYoutubeScheduleSlot(tx, {
          projectId: project.id,
          renderId: uploadInput.renderId,
          outputAssetId: uploadInput.outputAssetId,
          now: new Date(),
          timezone: env.YOUTUBE_SCHEDULE_TIMEZONE,
          dailyPublishTimes: parseDailyPublishTimes(env.YOUTUBE_DAILY_PUBLISH_TIMES),
          minLeadMinutes: env.YOUTUBE_SCHEDULE_MIN_LEAD_MINUTES,
        });
        input = {
          ...uploadInput,
          mode: "scheduled_public",
          scheduleId: schedule.id,
          publishAt: schedule.scheduledPublishAt.toISOString(),
        };
      }

      const job = await services.createJobIdempotent(tx, {
        projectId: project.id,
        sceneId: null,
        type: "upload_youtube",
        input,
        maxAttempts: 1,
      });

      if (schedule) {
        schedule = await services.attachYoutubeScheduleJob(tx, schedule.id, job.id);
      }

      return { job, schedule };
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("youtube_upload_preconditions_failed")
    ) {
      return jsonError(set, 422, "youtube_upload_preconditions_failed");
    }

    if (error instanceof Error && error.message === "youtube_schedule_full") {
      return conflict(set, "youtube_schedule_full");
    }

    throw error;
  }
})
```

- [ ] **Step 6: Run API checks**

Run:

```bash
bun test apps/api/src/app.test.ts
bun run --cwd apps/api typecheck
```

Expected: both commands exit `0`.

- [ ] **Step 7: Commit API scheduling**

Stage only:

```bash
git add apps/api/src/env.ts apps/api/src/services/projects.ts apps/api/src/routes/projects.ts apps/api/src/app.test.ts
git commit -m "feat: reserve scheduled youtube upload slots"
```

---

## Task 4: Worker Scheduled Upload Execution

**Files:**
- Modify: `apps/worker/src/youtube/upload.ts`
- Modify: `apps/worker/src/youtube/upload.test.ts`
- Modify: `apps/worker/src/handlers/uploadYoutube.ts`

- [ ] **Step 1: Add failing worker upload test**

In `apps/worker/src/youtube/upload.test.ts`, rename imports:

```ts
import { uploadYoutubeVideo } from "./upload";
```

Add this test in the upload describe block:

```ts
test("sends publishAt for scheduled public uploads", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "youtube-upload-scheduled-"));
  const filePath = path.join(root, "video.mp4");
  await writeFile(filePath, new Uint8Array([0, 1]));
  const requests: Request[] = [];

  try {
    await uploadYoutubeVideo({
      accessToken: "access-token",
      filePath,
      upload: {
        mode: "scheduled_public",
        renderId: "123e4567-e89b-12d3-a456-426614174000",
        outputAssetId: "123e4567-e89b-12d3-a456-426614174001",
        scheduleId: "123e4567-e89b-12d3-a456-426614174002",
        publishAt: "2026-05-19T02:00:00.000Z",
        title: "Scheduled upload",
        description: "A short description",
        tags: ["shorts"],
        privacyStatus: "private",
        selfDeclaredMadeForKids: false,
        containsSyntheticMedia: true,
      },
      fetchFn: async (url, init) => {
        requests.push(new Request(url, init));
        if (requests.length === 1) {
          return new Response(null, {
            status: 200,
            headers: { location: "https://upload.youtube.test/session" },
          });
        }

        return Response.json({ id: "yt-video-456" });
      },
    });

    expect(await requests[0]?.json()).toMatchObject({
      status: {
        privacyStatus: "private",
        publishAt: "2026-05-19T02:00:00.000Z",
        selfDeclaredMadeForKids: false,
        containsSyntheticMedia: true,
      },
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run worker upload tests to confirm failure**

Run:

```bash
bun test apps/worker/src/youtube/upload.test.ts
```

Expected before implementation: fails because `uploadYoutubeVideo` does not exist.

- [ ] **Step 3: Rename upload function and include publishAt**

In `apps/worker/src/youtube/upload.ts`, rename:

```ts
export async function uploadPrivateYoutubeVideo(...)
```

to:

```ts
export async function uploadYoutubeVideo(...)
```

Build status body as:

```ts
const status = {
  privacyStatus: "private" as const,
  selfDeclaredMadeForKids: false,
  containsSyntheticMedia: true,
  ...(input.upload.mode === "scheduled_public" ? { publishAt: input.upload.publishAt } : {}),
};
```

Use it in the start request body:

```ts
status,
```

Return:

```ts
return youtubeUploadJobOutputSchema.parse({
  youtubeVideoId: parsed.id,
  youtubeStudioUrl: `https://studio.youtube.com/video/${parsed.id}/edit`,
  mode: input.upload.mode,
  privacyStatus: "private",
  publishAt: input.upload.mode === "scheduled_public" ? input.upload.publishAt : null,
  scheduleId: input.upload.mode === "scheduled_public" ? input.upload.scheduleId : null,
  uploadedAt: new Date().toISOString(),
});
```

- [ ] **Step 4: Update worker handler schedule status**

In `apps/worker/src/handlers/uploadYoutube.ts`, import:

```ts
import {
  getAsset,
  markJobSucceeded,
  markYoutubeScheduleFailed,
  markYoutubeScheduleScheduled,
  markYoutubeScheduleUploading,
  type DbClient,
  type JobRow,
} from "@short-workflow/db";
```

Replace `uploadPrivateYoutubeVideo` with `uploadYoutubeVideo`.

Add helper:

```ts
function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
```

Wrap the upload section:

```ts
try {
  if (uploadInput.mode === "scheduled_public") {
    await markYoutubeScheduleUploading(db, uploadInput.scheduleId);
  }

  const output = await uploadYoutubeVideo({
    accessToken: token.access_token,
    filePath: absoluteAssetPath(env.LOCAL_ASSET_ROOT, asset.path),
    upload: uploadInput,
    fetchFn,
  });

  await markJobSucceeded(db, job.id, output);

  if (uploadInput.mode === "scheduled_public") {
    await markYoutubeScheduleScheduled(db, uploadInput.scheduleId, output.youtubeVideoId);
  }
} catch (error) {
  if (uploadInput.mode === "scheduled_public") {
    await markYoutubeScheduleFailed(db, uploadInput.scheduleId, errorText(error));
  }

  throw error;
}
```

- [ ] **Step 5: Run worker checks**

Run:

```bash
bun test apps/worker/src/youtube/upload.test.ts
bun run --cwd apps/worker typecheck
```

Expected: both commands exit `0`.

- [ ] **Step 6: Commit worker scheduled upload**

Stage only:

```bash
git add apps/worker/src/youtube/upload.ts apps/worker/src/youtube/upload.test.ts apps/worker/src/handlers/uploadYoutube.ts
git commit -m "feat: send scheduled youtube publish times"
```

---

## Task 5: Web Scheduled Upload UI

**Files:**
- Modify: `apps/web/src/features/projects/hooks.ts`
- Modify: `apps/web/src/features/projects/YoutubeUploadDialog.tsx`
- Modify: `apps/web/src/features/projects/RenderPanel.tsx`
- Modify: `apps/web/src/features/projects/workflow.test.ts`

- [ ] **Step 1: Add failing UI helper tests**

In `apps/web/src/features/projects/workflow.test.ts`, update the `RenderPanel` import:

```ts
import {
  canUploadYoutube,
  formatYoutubePublishTime,
  getRenderPreconditionMessages,
} from "./RenderPanel";
```

Add:

```ts
describe("YouTube schedule helpers", () => {
  test("formats scheduled publish time in Bangkok time", () => {
    expect(formatYoutubePublishTime("2026-05-19T02:00:00.000Z", "Asia/Bangkok")).toContain(
      "May 19, 2026",
    );
    expect(formatYoutubePublishTime("2026-05-19T02:00:00.000Z", "Asia/Bangkok")).toContain(
      "09:00",
    );
  });
});
```

- [ ] **Step 2: Run web tests to confirm failure**

Run:

```bash
bun test apps/web/src/features/projects/workflow.test.ts
```

Expected before implementation: fails because `formatYoutubePublishTime` is not exported.

- [ ] **Step 3: Update upload mutation**

In `apps/web/src/features/projects/hooks.ts`, import:

```ts
  YoutubeUploadRequest,
  YoutubeUploadResponse,
```

Change `useUploadYoutubeMutation` to:

```ts
export function useUploadYoutubeMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: YoutubeUploadRequest) =>
      apiFetch<YoutubeUploadResponse>(`/projects/${projectId}/youtube-upload`, {
        body: JSON.stringify(input),
        method: "POST",
      }),
    onSuccess: () => invalidateProjectWorkflow(queryClient, projectId),
  });
}
```

- [ ] **Step 4: Add upload mode selector**

In `apps/web/src/features/projects/YoutubeUploadDialog.tsx`, import:

```ts
import { useState } from "react";
import type { YoutubeUploadMode } from "@short-workflow/shared";
```

Inside the component:

```ts
const [mode, setMode] = useState<YoutubeUploadMode>("scheduled_public");
```

Change `confirmUpload`:

```ts
async function confirmUpload() {
  await uploadYoutube.mutateAsync({ mode });
  onClose();
}
```

Replace the static privacy rows with a mode control:

```tsx
<div className="grid gap-2 rounded-md border border-border bg-background p-3 text-sm">
  <span className="text-xs font-medium uppercase text-muted-foreground">Upload mode</span>
  <div className="grid grid-cols-2 gap-2">
    <button
      className={`h-9 rounded-md border px-3 text-sm font-medium ${
        mode === "scheduled_public"
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:bg-muted"
      }`}
      onClick={() => setMode("scheduled_public")}
      type="button"
    >
      Schedule public
    </button>
    <button
      className={`h-9 rounded-md border px-3 text-sm font-medium ${
        mode === "private"
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:bg-muted"
      }`}
      onClick={() => setMode("private")}
      type="button"
    >
      Private now
    </button>
  </div>
  <p className="text-xs leading-5 text-muted-foreground">
    {mode === "scheduled_public"
      ? "The next available public slot will be reserved automatically: 09:00, 12:00, 17:00, or 21:00 Bangkok time."
      : "The video stays private after upload."}
  </p>
  <div className="flex items-center justify-between gap-3">
    <span className="text-muted-foreground">Audience</span>
    <span className="font-medium">Not made for kids</span>
  </div>
  <div className="flex items-center justify-between gap-3">
    <span className="text-muted-foreground">Disclosure</span>
    <span className="font-medium">Synthetic media enabled</span>
  </div>
</div>
```

Change the connected action label:

```tsx
{mode === "scheduled_public" ? "Schedule public upload" : "Confirm private upload"}
```

- [ ] **Step 5: Show scheduled upload state**

In `apps/web/src/features/projects/RenderPanel.tsx`, add:

```ts
export function formatYoutubePublishTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
```

In the upload summary card, compute:

```ts
const scheduledPublishLabel =
  youtubeUpload?.scheduledPublishAt && youtubeUpload.timezone
    ? formatYoutubePublishTime(youtubeUpload.scheduledPublishAt, youtubeUpload.timezone)
    : null;
```

Replace title/status text with:

```tsx
<span className="min-w-0 truncate font-medium">
  {youtubeUpload.mode === "scheduled_public"
    ? "Scheduled public on YouTube"
    : "Uploaded privately to YouTube"}
</span>
<span className="shrink-0 rounded bg-muted px-2 py-1 text-xs capitalize text-muted-foreground">
  {youtubeUpload.mode === "scheduled_public"
    ? youtubeUpload.scheduleStatus ?? "scheduled"
    : youtubeUpload.privacyStatus ?? "private"}
</span>
```

Below Video ID, add:

```tsx
{scheduledPublishLabel ? (
  <p className="mt-1 break-words text-xs text-muted-foreground">
    Publishes at {scheduledPublishLabel} {youtubeUpload.timezone}
  </p>
) : null}
```

- [ ] **Step 6: Run web checks**

Run:

```bash
bun test apps/web/src/features/projects/workflow.test.ts
bun run --cwd apps/web typecheck
```

Expected: both commands exit `0`.

- [ ] **Step 7: Commit web scheduled upload UI**

Stage only:

```bash
git add apps/web/src/features/projects/hooks.ts apps/web/src/features/projects/YoutubeUploadDialog.tsx apps/web/src/features/projects/RenderPanel.tsx apps/web/src/features/projects/workflow.test.ts
git commit -m "feat: add scheduled youtube upload UI"
```

---

## Task 6: Final Verification

**Files:**
- No production files unless failures require fixes.

- [ ] **Step 1: Run focused tests**

Run:

```bash
bun test packages/shared/src/youtubeUpload.test.ts
bun test packages/db/src/queries/youtubeSchedules.test.ts
bun test apps/api/src/app.test.ts
bun test apps/worker/src/youtube/upload.test.ts
bun test apps/web/src/features/projects/workflow.test.ts
```

Expected: all commands exit `0`.

- [ ] **Step 2: Run package typechecks**

Run:

```bash
bun run --cwd packages/shared typecheck
bun run --cwd packages/db typecheck
bun run --cwd apps/api typecheck
bun run --cwd apps/worker typecheck
bun run --cwd apps/web typecheck
```

Expected: all commands exit `0`.

- [ ] **Step 3: Run migration checks**

Run:

```bash
bun run db:check
```

Expected: exits `0`.

If a local database connection is available and the user approves applying migrations to the hosted database, run:

```bash
bun run db:migrate:up
```

Expected: `0005_add_youtube_upload_schedules` is recorded in `app_migrations`.

- [ ] **Step 4: Run diff whitespace check**

Run:

```bash
git diff --check
```

Expected: exits `0`.

- [ ] **Step 5: Manual smoke check**

Start local services:

```bash
bun run dev
```

Manual expected behavior:

- Open a rendered project with YouTube metadata.
- Open the upload dialog.
- Confirm `Schedule public` is selected by default.
- Click `Schedule public upload`.
- Confirm the active job panel shows an upload job.
- Confirm `youtube_upload_schedules` has one row with `status = 'reserved'` or `status = 'scheduled'`.
- Confirm YouTube Studio shows the video as scheduled/private until publish time.

- [ ] **Step 6: Record final status**

Run:

```bash
git status --short --branch
```

Expected: only intentional implementation changes and pre-existing unrelated dirty files are shown. Do not use `git add .`.

## Plan Self-Review

- Spec coverage: covered shared contracts, DB-backed reservation, API queueing, YouTube `publishAt`, worker status updates, UI mode selection, and verification.
- Red-flag scan: no incomplete sections; tasks contain exact files, commands, expected outcomes, and concrete snippets.
- Type consistency: shared names used across tasks are `YoutubeUploadMode`, `youtubeUploadRequestSchema`, `youtubeUploadResponseSchema`, `YoutubeUploadResponse`, `youtubeUploadSchedules`, and `reserveNextYoutubeScheduleSlot`.
