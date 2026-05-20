import { describe, expect, test } from "bun:test";
import {
  latestYoutubeVideoDiagnoses,
  normalizeYoutubeMetricNumber,
  youtubeVideoUrl,
} from "./youtubeAnalytics";

describe("youtube analytics query helpers", () => {
  test("normalizes numeric API metrics", () => {
    expect(normalizeYoutubeMetricNumber("1144")).toBe(1144);
    expect(normalizeYoutubeMetricNumber(83.7)).toBe(83.7);
    expect(normalizeYoutubeMetricNumber(null)).toBeNull();
    expect(normalizeYoutubeMetricNumber(undefined)).toBeNull();
    expect(normalizeYoutubeMetricNumber("")).toBeNull();
    expect(normalizeYoutubeMetricNumber("not-a-number")).toBeNull();
  });

  test("builds a stable watch URL", () => {
    expect(youtubeVideoUrl("abc123def45")).toBe("https://www.youtube.com/watch?v=abc123def45");
  });

  test("selects latest diagnoses by update time", () => {
    const olderCreatedNewerUpdated = {
      id: "updated",
      youtubeVideoLinkId: "link-1",
      diagnosisType: "ai",
      createdAt: new Date("2026-05-20T10:00:00.000Z"),
      updatedAt: new Date("2026-05-20T12:00:00.000Z"),
    };
    const newerCreatedOlderUpdated = {
      id: "created",
      youtubeVideoLinkId: "link-1",
      diagnosisType: "ai",
      createdAt: new Date("2026-05-20T11:00:00.000Z"),
      updatedAt: new Date("2026-05-20T11:00:00.000Z"),
    };

    expect(
      latestYoutubeVideoDiagnoses([newerCreatedOlderUpdated, olderCreatedNewerUpdated]),
    ).toEqual([olderCreatedNewerUpdated]);
  });
});
