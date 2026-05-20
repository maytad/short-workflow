import { describe, expect, test } from "bun:test";

import { formatMetric, formatPercent, statusLabel } from "./analyticsFormat";

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
});
