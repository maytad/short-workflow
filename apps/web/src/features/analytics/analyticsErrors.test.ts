import { describe, expect, test } from "bun:test";

import { ApiError } from "../../api/client";
import { analyticsErrorMessage, apiErrorCode, isReconnectError } from "./analyticsErrors";

describe("analytics error messages", () => {
  test("extracts API error codes from ApiError payloads", () => {
    const error = new ApiError("Conflict", 409, { error: "youtube_reconnect_required" });

    expect(apiErrorCode(error)).toBe("youtube_reconnect_required");
  });

  test("labels reconnect errors with an actionable message", () => {
    const error = new ApiError("Conflict", 409, { error: "youtube_analytics_scope_missing" });

    expect(isReconnectError(error)).toBe(true);
    expect(analyticsErrorMessage("Refresh", error)).toBe(
      "Refresh failed: reconnect YouTube with Analytics access.",
    );
  });

  test("includes analytics API failure codes in the visible message", () => {
    const error = new ApiError("Bad Gateway", 502, {
      error: "youtube_analytics_fetch_failed:403",
    });

    expect(analyticsErrorMessage("Refresh", error)).toBe(
      "Refresh failed: YouTube Analytics API returned youtube_analytics_fetch_failed:403.",
    );
  });

  test("falls back to HTTP status when no structured code exists", () => {
    const error = new ApiError("Internal Server Error", 500, "upstream failed");

    expect(analyticsErrorMessage("Load analytics", error)).toBe(
      "Load analytics failed: API returned HTTP 500.",
    );
  });
});
