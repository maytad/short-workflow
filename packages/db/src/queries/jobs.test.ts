import { describe, expect, test } from "bun:test";

import { isClaimedJobRow, retryDelaySeconds } from "./jobs";

describe("retryDelaySeconds", () => {
  test("caps exponential retry delays at five minutes", () => {
    expect([1, 2, 3, 4, 5].map(retryDelaySeconds)).toEqual([30, 60, 120, 240, 300]);
  });
});

describe("isClaimedJobRow", () => {
  test("rejects the null composite row returned by old claim_next_job functions", () => {
    expect(isClaimedJobRow({ id: null })).toBe(false);
  });
});
