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

    const reserved = await reserveNextYoutubeScheduleSlot(
      {} as never,
      {
        projectId,
        renderId,
        outputAssetId,
        now: new Date("2026-05-18T01:00:00.000Z"),
        timezone: "Asia/Bangkok",
        dailyPublishTimes: parseDailyPublishTimes("12:00,17:00"),
        minLeadMinutes: 30,
        scheduleWindowDays: 1,
      },
      deps,
    );

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
      reserveNextYoutubeScheduleSlot(
        {} as never,
        {
          projectId,
          renderId,
          outputAssetId,
          now: new Date("2026-05-18T01:00:00.000Z"),
          timezone: "Asia/Bangkok",
          dailyPublishTimes: parseDailyPublishTimes("12:00"),
          minLeadMinutes: 30,
          scheduleWindowDays: 1,
        },
        deps,
      ),
    ).rejects.toThrow("youtube_schedule_full");
  });
});
