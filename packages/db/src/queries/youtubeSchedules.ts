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
  listActiveSchedulesByPublishAt: (
    publishAt: Date[],
  ) => Promise<Pick<YoutubeUploadScheduleRow, "scheduledPublishAt">[]>;
};

const activeScheduleStatuses = ["reserved", "uploading", "scheduled"] as const;

export function parseDailyPublishTimes(value: string) {
  const times = value
    .split(",")
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      const match = /^(\d{2}):(\d{2})$/.exec(raw);
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
  deps?: YoutubeScheduleDeps,
) {
  const scheduleDeps = deps ?? {
    createScheduleReservation,
    listActiveSchedulesByPublishAt: (publishAt: Date[]) =>
      listActiveSchedulesByPublishAt(db, publishAt),
  };
  const candidates = buildYoutubeScheduleCandidates(input);
  const activeSchedules = await scheduleDeps.listActiveSchedulesByPublishAt(candidates);
  const activeTimes = new Set(
    activeSchedules.map((schedule) => schedule.scheduledPublishAt.getTime()),
  );

  for (const scheduledPublishAt of candidates) {
    if (activeTimes.has(scheduledPublishAt.getTime())) {
      continue;
    }

    const schedule = await scheduleDeps.createScheduleReservation(db, {
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
