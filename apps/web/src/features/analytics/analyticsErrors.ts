import { ApiError } from "../../api/client";

const RECONNECT_ERROR_CODES = new Set([
  "youtube_reconnect_required",
  "youtube_analytics_scope_missing",
  "youtube_token_missing",
  "youtube_token_invalid",
]);

export function apiErrorCode(error: unknown) {
  if (!(error instanceof ApiError)) {
    return null;
  }

  if (
    typeof error.payload === "object" &&
    error.payload !== null &&
    "error" in error.payload &&
    typeof error.payload.error === "string"
  ) {
    return error.payload.error;
  }

  return null;
}

export function isReconnectError(error: unknown) {
  const code = apiErrorCode(error);

  return code === null ? false : RECONNECT_ERROR_CODES.has(code);
}

export function analyticsErrorMessage(action: string, error: unknown) {
  const code = apiErrorCode(error);

  if (code && RECONNECT_ERROR_CODES.has(code)) {
    return `${action} failed: reconnect YouTube with Analytics access.`;
  }

  if (code?.startsWith("youtube_analytics_fetch_failed")) {
    return `${action} failed: YouTube Analytics API returned ${code}.`;
  }

  if (code === "youtube_ai_diagnosis_failed") {
    return `${action} failed: AI diagnosis could not be completed.`;
  }

  if (code === "youtube_video_not_found") {
    return `${action} failed: this YouTube video is not linked in the database.`;
  }

  if (code === "youtube_analytics_snapshot_missing") {
    return `${action} failed: refresh analytics before running AI diagnosis.`;
  }

  if (code) {
    return `${action} failed: API returned ${code}.`;
  }

  if (error instanceof ApiError) {
    return `${action} failed: API returned HTTP ${error.status}.`;
  }

  return `${action} failed: API connection failed.`;
}
