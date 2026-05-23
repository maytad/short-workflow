import { describe, expect, spyOn, test } from "bun:test";

import { formatAge, formatMetric, formatPercent, statusLabel } from "./analyticsFormat";

describe("analytics formatting", () => {
  test("formats missing metrics as a dash", () => {
    expect(formatMetric(null)).toBe("-");
    expect(formatMetric(undefined)).toBe("-");
  });

  test("formats integer metrics with grouping", () => {
    expect(formatMetric(1144)).toBe("1,144");
  });

  test("formats percentages with one decimal place", () => {
    expect(formatPercent(83.73)).toBe("83.7%");
  });

  test("formats YouTube link status labels", () => {
    expect(statusLabel("linked")).toBe("Linked");
    expect(statusLabel("unlinked")).toBe("Unlinked");
  });

  test("formats relative publish age", () => {
    const nowSpy = spyOn(Date, "now").mockReturnValue(
      new Date("2026-05-21T12:00:00.000Z").getTime(),
    );

    expect(formatAge("2026-05-21T11:30:00.000Z")).toBe("30m");
    expect(formatAge("2026-05-21T08:00:00.000Z")).toBe("4h");
    expect(formatAge("2026-05-18T12:00:00.000Z")).toBe("3d");

    nowSpy.mockRestore();
  });
});
