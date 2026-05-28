import type { YoutubeAuthStatus } from "@short-workflow/shared";

import { ApiError } from "../../api/client";

export function isYoutubeUploadAuthReady(status: YoutubeAuthStatus | undefined) {
  return (
    status?.connected === true &&
    status.hasRequiredScopes === true &&
    status.reconnectRequired !== true
  );
}

export function isYoutubeUploadReconnectRequired(status: YoutubeAuthStatus | undefined) {
  return (
    status?.connected === true &&
    (status.hasRequiredScopes !== true || status.reconnectRequired === true)
  );
}

function apiErrorCode(error: unknown) {
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

export function youtubeUploadErrorMessage(error: unknown) {
  const code = apiErrorCode(error);

  switch (code) {
    case "youtube_not_connected":
      return "Connect YouTube before scheduling this upload.";
    case "youtube_reconnect_required":
      return "Reconnect YouTube to grant upload and analytics access, then try again.";
    case "youtube_schedule_full":
      return "No public schedule slots are available in the configured window.";
    case "youtube_upload_preconditions_failed":
      return "Render metadata or MP4 output is missing. Render the project again before upload.";
    default:
      return "YouTube upload could not be queued.";
  }
}
