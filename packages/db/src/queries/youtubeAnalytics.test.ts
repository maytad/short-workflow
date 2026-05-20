import { describe, expect, test } from "bun:test";
import { normalizeYoutubeMetricNumber, youtubeVideoUrl } from "./youtubeAnalytics";

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
});
