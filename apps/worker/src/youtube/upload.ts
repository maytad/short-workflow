import { readFile, stat } from "node:fs/promises";

import {
  youtubeUploadJobOutputSchema,
  type YoutubeUploadJobInput,
  type YoutubeUploadJobOutput,
} from "@short-workflow/shared";
import { z } from "zod";

import type { FetchFn } from "./tokenStore";

const YOUTUBE_UPLOAD_URL =
  "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers=false";

const youtubeUploadResponseSchema = z
  .object({
    id: z.string().min(1),
  })
  .passthrough();

function normalizeErrorText(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 300);
}

function errorRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

async function youtubeErrorMessage(response: Response) {
  const fallback = String(response.status);

  try {
    const body = await response.text();
    if (!body) {
      return fallback;
    }

    const parsed = JSON.parse(body) as unknown;
    const root = errorRecord(parsed);
    const error = errorRecord(root?.error);
    const errors = Array.isArray(error?.errors) ? error.errors : [];
    const firstError = errorRecord(errors[0]);
    const reason = typeof firstError?.reason === "string" ? firstError.reason : null;
    const message =
      typeof firstError?.message === "string"
        ? firstError.message
        : typeof error?.message === "string"
          ? error.message
          : null;
    const normalized = normalizeErrorText([reason, message].filter(Boolean).join(": "));

    return normalized ? `${response.status}:${normalized}` : fallback;
  } catch {
    return fallback;
  }
}

export async function uploadYoutubeVideo(input: {
  accessToken: string;
  filePath: string;
  upload: YoutubeUploadJobInput;
  fetchFn?: FetchFn;
}): Promise<YoutubeUploadJobOutput> {
  const fetchFn = input.fetchFn ?? fetch;
  const file = await stat(input.filePath);
  const status = {
    privacyStatus: "private" as const,
    selfDeclaredMadeForKids: false,
    containsSyntheticMedia: true,
    ...(input.upload.mode === "scheduled_public" ? { publishAt: input.upload.publishAt } : {}),
  };

  const startResponse = await fetchFn(YOUTUBE_UPLOAD_URL, {
    body: JSON.stringify({
      snippet: {
        title: input.upload.title,
        description: input.upload.description,
        tags: input.upload.tags,
      },
      status,
    }),
    headers: {
      authorization: `Bearer ${input.accessToken}`,
      "content-type": "application/json",
      "x-upload-content-length": String(file.size),
      "x-upload-content-type": "video/mp4",
    },
    method: "POST",
  });

  if (!startResponse.ok) {
    throw new Error(`youtube_api_error:${await youtubeErrorMessage(startResponse)}`);
  }

  const uploadUrl = startResponse.headers.get("location");
  if (!uploadUrl) {
    throw new Error("youtube_upload_location_missing");
  }

  const bytes = await readFile(input.filePath);
  const uploadResponse = await fetchFn(uploadUrl, {
    body: bytes,
    headers: {
      authorization: `Bearer ${input.accessToken}`,
      "content-length": String(file.size),
      "content-type": "video/mp4",
    },
    method: "PUT",
  });

  if (!uploadResponse.ok) {
    throw new Error(`youtube_upload_rejected:${await youtubeErrorMessage(uploadResponse)}`);
  }

  const parsed = youtubeUploadResponseSchema.parse(await uploadResponse.json());

  return youtubeUploadJobOutputSchema.parse({
    youtubeVideoId: parsed.id,
    youtubeStudioUrl: `https://studio.youtube.com/video/${parsed.id}/edit`,
    mode: input.upload.mode,
    privacyStatus: "private",
    publishAt: input.upload.mode === "scheduled_public" ? input.upload.publishAt : null,
    scheduleId: input.upload.mode === "scheduled_public" ? input.upload.scheduleId : null,
    uploadedAt: new Date().toISOString(),
  });
}
