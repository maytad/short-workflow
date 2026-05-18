import { describe, expect, test } from "bun:test";

import { parseEnv, parseYoutubeScheduleEnv } from "./env";

describe("parseEnv", () => {
  test("requires runtime database and asset root while defaulting host and port", () => {
    expect(
      parseEnv({
        DATABASE_URL: "postgres://user:pass@example.com:5432/app",
        LOCAL_ASSET_ROOT: "/tmp/short-workflow-assets",
      }),
    ).toEqual({
      DATABASE_URL: "postgres://user:pass@example.com:5432/app",
      LOCAL_ASSET_ROOT: "/tmp/short-workflow-assets",
      API_HOST: "127.0.0.1",
      API_PORT: 3001,
      YOUTUBE_DAILY_PUBLISH_TIMES: "09:00,12:00,17:00,21:00",
      YOUTUBE_SCHEDULE_MIN_LEAD_MINUTES: 30,
      YOUTUBE_SCHEDULE_TIMEZONE: "Asia/Bangkok",
    });
  });

  test("coerces API_PORT when provided", () => {
    expect(
      parseEnv({
        DATABASE_URL: "postgres://user:pass@example.com:5432/app",
        LOCAL_ASSET_ROOT: "/tmp/short-workflow-assets",
        API_PORT: "3010",
      }).API_PORT,
    ).toBe(3010);
  });

  test("ignores unrelated process environment keys", () => {
    expect(
      parseEnv({
        DATABASE_URL: "postgres://user:pass@example.com:5432/app",
        LOCAL_ASSET_ROOT: "/tmp/short-workflow-assets",
        PATH: "/usr/bin",
      }).API_HOST,
    ).toBe("127.0.0.1");
  });
});

describe("parseYoutubeScheduleEnv", () => {
  test("defaults schedule config without requiring runtime database settings", () => {
    expect(parseYoutubeScheduleEnv({})).toEqual({
      YOUTUBE_DAILY_PUBLISH_TIMES: "09:00,12:00,17:00,21:00",
      YOUTUBE_SCHEDULE_MIN_LEAD_MINUTES: 30,
      YOUTUBE_SCHEDULE_TIMEZONE: "Asia/Bangkok",
    });
  });

  test("coerces schedule lead minutes", () => {
    expect(
      parseYoutubeScheduleEnv({
        YOUTUBE_SCHEDULE_MIN_LEAD_MINUTES: "45",
      }).YOUTUBE_SCHEDULE_MIN_LEAD_MINUTES,
    ).toBe(45);
  });
});
