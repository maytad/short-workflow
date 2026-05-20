import { describe, expect, test } from "bun:test";

import {
  buildRuleDiagnosis,
  deriveSnapshotMetrics,
  parseIso8601DurationSeconds,
  requiredScopeError,
} from "./youtubeAnalytics";

describe("parseIso8601DurationSeconds", () => {
  test("parses YouTube ISO-8601 video durations into seconds", () => {
    expect(parseIso8601DurationSeconds("PT37S")).toBe(37);
    expect(parseIso8601DurationSeconds("PT1M05S")).toBe(65);
    expect(parseIso8601DurationSeconds("PT2H03M04S")).toBe(7384);
  });
});

describe("deriveSnapshotMetrics", () => {
  test("derives views per hour and like rate from snapshot values", () => {
    const metrics = deriveSnapshotMetrics({
      likes: 25,
      now: new Date("2026-05-20T00:00:00.000Z"),
      publishedAt: new Date("2026-05-19T00:00:00.000Z"),
      views: 1000,
    });

    expect(metrics.viewsPerHour).toBeCloseTo(41.67, 2);
    expect(metrics.likeRate).toBe(2.5);
  });
});

describe("buildRuleDiagnosis", () => {
  test("labels strong retention with low distribution", () => {
    const diagnosis = buildRuleDiagnosis({
      ageHours: 48,
      likeRate: 2.4,
      medianLikeRate: 1.5,
      medianRetentionPercent: 75,
      medianViews: 900,
      medianViewsPerHour: 30,
      retentionPercent: 92,
      views: 150,
      viewsPerHour: 3,
    });

    expect(diagnosis.labels).toContain("strong_retention_low_distribution");
    expect(diagnosis.summaryTh).toContain("retention");
  });

  test("labels videos newer than three hours as too new", () => {
    const diagnosis = buildRuleDiagnosis({
      ageHours: 0.5,
      likeRate: 0,
      medianLikeRate: 1,
      medianRetentionPercent: 50,
      medianViews: 100,
      medianViewsPerHour: 10,
      retentionPercent: 0,
      views: 1,
      viewsPerHour: 2,
    });

    expect(diagnosis.labels).toEqual(["too_new"]);
  });
});

describe("requiredScopeError", () => {
  test("detects insufficient YouTube authentication scopes", () => {
    expect(requiredScopeError("Request had insufficient authentication scopes.")).toBe(true);
    expect(requiredScopeError("quotaExceeded")).toBe(false);
  });
});
