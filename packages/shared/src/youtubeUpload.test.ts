import { describe, expect, test } from "bun:test";

import {
  youtubeUploadJobInputSchema,
  youtubeUploadRequestSchema,
  youtubeUploadResponseSchema,
} from "./index";

const renderId = "11111111-1111-4111-8111-111111111111";
const outputAssetId = "22222222-2222-4222-8222-222222222222";
const scheduleId = "33333333-3333-4333-8333-333333333333";
const publishAt = "2026-05-19T02:00:00.000Z";

function baseUploadInput() {
  return {
    renderId,
    outputAssetId,
    title: "Why cold batteries fade fast",
    description: "A compact explanation.\n\n#Shorts",
    tags: ["Shorts", "Engineering"],
    privacyStatus: "private",
    selfDeclaredMadeForKids: false,
    containsSyntheticMedia: true,
  };
}

describe("youtube upload contracts", () => {
  test("accepts private upload requests", () => {
    expect(youtubeUploadRequestSchema.parse({ mode: "private" })).toEqual({
      mode: "private",
    });
  });

  test("defaults upload requests to scheduled public mode", () => {
    expect(youtubeUploadRequestSchema.parse({})).toEqual({
      mode: "scheduled_public",
    });
  });

  test("accepts scheduled public upload job input with publishAt", () => {
    expect(
      youtubeUploadJobInputSchema.parse({
        ...baseUploadInput(),
        mode: "scheduled_public",
        scheduleId,
        publishAt,
      }),
    ).toMatchObject({
      mode: "scheduled_public",
      scheduleId,
      publishAt,
      privacyStatus: "private",
    });
  });

  test("rejects scheduled public upload job input without publishAt", () => {
    expect(() =>
      youtubeUploadJobInputSchema.parse({
        ...baseUploadInput(),
        mode: "scheduled_public",
        scheduleId,
      }),
    ).toThrow();
  });

  test("accepts upload responses with nullable schedule", () => {
    expect(
      youtubeUploadResponseSchema.parse({
        job: {
          id: "44444444-4444-4444-8444-444444444444",
          projectId: "55555555-5555-4555-8555-555555555555",
          sceneId: null,
          type: "upload_youtube",
          status: "pending",
          attempts: 0,
          maxAttempts: 1,
          parentJobId: null,
          errorMessage: null,
          input: {},
          output: null,
          nextRetryAt: null,
          createdAt: "2026-05-18T00:00:00.000Z",
          startedAt: null,
          finishedAt: null,
          updatedAt: "2026-05-18T00:00:00.000Z",
        },
        schedule: null,
      }).schedule,
    ).toBeNull();
  });
});
