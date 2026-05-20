import { describe, expect, test } from "bun:test";

import {
  youtubeAiDiagnosisRequestSchema,
  youtubeAnalyticsDashboardResponseSchema,
  youtubeAnalyticsRefreshRequestSchema,
} from "./api";
import {
  youtubeAnalyticsSnapshotSchema,
  youtubeVideoDiagnosisSchema,
  youtubeVideoLinkSchema,
} from "./schemas";

const videoLinkId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const uploadJobId = "33333333-3333-4333-8333-333333333333";
const snapshotId = "44444444-4444-4444-8444-444444444444";
const diagnosisId = "55555555-5555-4555-8555-555555555555";
const createdAt = "2026-05-20T00:00:00.000Z";
const updatedAt = "2026-05-20T00:05:00.000Z";
const publishedAt = "2026-05-19T02:00:00.000Z";
const lastSyncedAt = "2026-05-20T00:10:00.000Z";

function linkedVideo() {
  return {
    id: videoLinkId,
    youtubeVideoId: "abc123def45",
    projectId,
    uploadJobId,
    source: "db_upload" as const,
    linkStatus: "linked" as const,
    title: "Why cold batteries fade fast",
    description: "A compact explanation.",
    publishedAt,
    durationSeconds: 38,
    privacyStatus: "private",
    lastSyncedAt,
    createdAt,
    updatedAt,
  };
}

function analyticsSnapshot() {
  return {
    id: snapshotId,
    youtubeVideoLinkId: videoLinkId,
    youtubeVideoId: "abc123def45",
    snapshotAt: lastSyncedAt,
    windowDays: 30,
    views: 1200,
    engagedViews: 740,
    likes: 92,
    comments: 11,
    shares: 8,
    subscribersGained: 17,
    averageViewDurationSeconds: 21,
    averageViewPercentage: 55.3,
    viewsPerHour: 12.5,
    likeRate: 0.076,
    createdAt,
  };
}

function ruleBasedDiagnosis() {
  return {
    id: diagnosisId,
    youtubeVideoLinkId: videoLinkId,
    snapshotId,
    diagnosisType: "rule_based" as const,
    model: null,
    reasoningEffort: null,
    inputHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    summaryTh: "Hook retention is below target.",
    suggestionsEn: {
      opening: "Move the concrete payoff into the first sentence.",
      pacing: "Trim the second scene by two seconds.",
    },
    createdAt,
    updatedAt,
  };
}

describe("youtube analytics contracts", () => {
  test("accepts linked video records", () => {
    expect(youtubeVideoLinkSchema.parse(linkedVideo())).toEqual(linkedVideo());
  });

  test("accepts analytics snapshots", () => {
    expect(youtubeAnalyticsSnapshotSchema.parse(analyticsSnapshot())).toEqual(analyticsSnapshot());
  });

  test("accepts rule based video diagnoses", () => {
    expect(youtubeVideoDiagnosisSchema.parse(ruleBasedDiagnosis())).toEqual(ruleBasedDiagnosis());
  });

  test("defaults analytics refresh requests to thirty days", () => {
    expect(youtubeAnalyticsRefreshRequestSchema.parse({})).toEqual({ windowDays: 30 });
  });

  test("accepts dashboard responses with linked video summaries", () => {
    const response = {
      auth: {
        connected: true,
        hasRequiredScopes: true,
        reconnectRequired: false,
      },
      windowDays: 30,
      aggregates: {
        recentVideoCount: 1,
        totalViews: 1200,
        needsAttentionCount: 1,
        medianAverageViewPercentage: 55.3,
        bestPerformerVideoId: "abc123def45",
      },
      videos: [
        {
          link: linkedVideo(),
          latestSnapshot: analyticsSnapshot(),
          latestRuleDiagnosis: ruleBasedDiagnosis(),
          latestAiDiagnosis: null,
          creativeContext: {
            projectId,
            projectTitle: "Cold battery short",
            topic: "Explain why batteries fade in the cold.",
            seedId: "battery-cold-001",
            appealTier: "practical",
            mechanismFamily: "chemistry",
            visualHookArchetype: "before-after",
            hookNarration: "Cold weather slows the battery chemistry.",
            hookCaption: "Cold cuts battery power",
            hookImagePrompt: "A phone battery icon covered in frost.",
            scriptPromptVersion: 1,
            imagePromptVersion: 1,
          },
        },
      ],
    };

    expect(youtubeAnalyticsDashboardResponseSchema.parse(response)).toEqual(response);
  });

  test("accepts AI diagnosis requests by YouTube video id", () => {
    expect(youtubeAiDiagnosisRequestSchema.parse({ youtubeVideoId: "abc123def45" })).toEqual({
      youtubeVideoId: "abc123def45",
    });
  });
});
