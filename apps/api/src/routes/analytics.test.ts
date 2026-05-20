import { describe, expect, test } from "bun:test";

import type {
  YoutubeAiDiagnosisResponse,
  YoutubeAnalyticsDashboardResponse,
} from "@short-workflow/shared";

import { createApp } from "../app";
import type { AnalyticsRouteServices } from "./analytics";

const videoLinkId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const uploadJobId = "33333333-3333-4333-8333-333333333333";
const snapshotId = "44444444-4444-4444-8444-444444444444";
const diagnosisId = "55555555-5555-4555-8555-555555555555";
const createdAt = "2026-05-20T00:00:00.000Z";
const updatedAt = "2026-05-20T00:05:00.000Z";
const publishedAt = "2026-05-19T02:00:00.000Z";
const lastSyncedAt = "2026-05-20T00:10:00.000Z";

const testDb = {
  execute: async () => [],
} as never;

function request(path: string, init?: RequestInit) {
  return new Request(`http://localhost${path}`, init);
}

function dashboard(recentVideoCount: number): YoutubeAnalyticsDashboardResponse {
  return {
    auth: {
      connected: true,
      hasRequiredScopes: true,
      reconnectRequired: false,
    },
    windowDays: 30,
    aggregates: {
      recentVideoCount,
      totalViews: recentVideoCount === 0 ? 0 : 1200,
      needsAttentionCount: recentVideoCount === 0 ? 0 : 1,
      medianAverageViewPercentage: recentVideoCount === 0 ? null : 55.3,
      bestPerformerVideoId: recentVideoCount === 0 ? null : "abc123def45",
    },
    videos:
      recentVideoCount === 0
        ? []
        : [
            {
              link: {
                id: videoLinkId,
                youtubeVideoId: "abc123def45",
                projectId,
                uploadJobId,
                source: "db_upload",
                linkStatus: "linked",
                title: "Why cold batteries fade fast",
                description: "A compact explanation.",
                publishedAt,
                durationSeconds: 38,
                privacyStatus: "private",
                lastSyncedAt,
                createdAt,
                updatedAt,
              },
              latestSnapshot: {
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
              },
              latestRuleDiagnosis: {
                id: diagnosisId,
                youtubeVideoLinkId: videoLinkId,
                snapshotId,
                diagnosisType: "rule_based",
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
              },
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
}

function aiDiagnosis(): YoutubeAiDiagnosisResponse {
  return {
    diagnosis: {
      id: "66666666-6666-4666-8666-666666666666",
      youtubeVideoLinkId: videoLinkId,
      snapshotId,
      diagnosisType: "ai",
      model: "gpt-5.5",
      reasoningEffort: "xhigh",
      inputHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      summaryTh: "The opening is clear but the payoff lands late.",
      suggestionsEn: {
        hook: "Open with the failed phone moment before the explanation.",
        edit: "Cut one setup sentence from the context scene.",
      },
      createdAt,
      updatedAt,
    },
  };
}

function services(overrides: Partial<AnalyticsRouteServices> = {}): AnalyticsRouteServices {
  return {
    getDashboard: async () => dashboard(0),
    refreshDashboard: async () => dashboard(1),
    analyzeVideo: async () => aiDiagnosis(),
    ...overrides,
  };
}

describe("analytics routes", () => {
  test("GET /analytics/youtube returns cached dashboard", async () => {
    const app = createApp({ db: testDb, analyticsServices: services() });

    const response = await app.handle(request("/analytics/youtube"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(dashboard(0));
  });

  test("POST /analytics/youtube/refresh refreshes and returns dashboard", async () => {
    const app = createApp({ db: testDb, analyticsServices: services() });

    const response = await app.handle(
      request("/analytics/youtube/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ windowDays: 30 }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(dashboard(1));
  });

  test("POST refresh maps reconnect-required errors to conflict", async () => {
    const app = createApp({
      db: testDb,
      analyticsServices: services({
        refreshDashboard: async () => {
          throw new Error("youtube_reconnect_required");
        },
      }),
    });

    const response = await app.handle(
      request("/analytics/youtube/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ windowDays: 30 }),
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "youtube_reconnect_required" });
  });

  test("POST /analytics/youtube/videos/:youtubeVideoId/analyze returns AI diagnosis", async () => {
    const app = createApp({ db: testDb, analyticsServices: services() });

    const response = await app.handle(
      request("/analytics/youtube/videos/abc123def45/analyze", { method: "POST" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(aiDiagnosis());
  });
});
