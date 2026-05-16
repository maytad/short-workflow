import { describe, expect, test } from "bun:test";

import { retryDelaySeconds } from "./jobs";

describe("retryDelaySeconds", () => {
  test("caps exponential retry delays at five minutes", () => {
    expect([1, 2, 3, 4, 5].map(retryDelaySeconds)).toEqual([
      30,
      60,
      120,
      240,
      300,
    ]);
  });
});
