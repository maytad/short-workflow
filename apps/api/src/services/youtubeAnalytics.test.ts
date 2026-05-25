import { describe, expect, test } from "bun:test";
import { buildYoutubeDiagnosisInputHash } from "@short-workflow/ai";
import type {
  YoutubeAnalyticsSnapshotRow,
  YoutubeVideoDiagnosisRow,
  YoutubeVideoLinkRow,
} from "@short-workflow/db";
import type { YoutubeAnalyticsVideoSummary } from "@short-workflow/shared";
import {
  buildAnalyticsDashboard,
  buildRuleDiagnosis,
  buildYoutubeAiDiagnosisInput,
  deriveSnapshotMetrics,
  type FetchFn,
  fetchRecentChannelVideos,
  fetchYoutubeAnalyticsRows,
  fetchYoutubeVideoDetails,
  findCachedAiDiagnosis,
  median,
  parseIso8601DurationSeconds,
  requiredScopeError,
  selectCurrentYoutubeSnapshotCounts,
  toYoutubeAiDiagnosisError,
} from "./youtubeAnalytics";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

function textResponse(body: string, status = 200) {
  return new Response(body, {
    headers: { "content-type": "text/plain" },
    status,
  });
}

function recordingFetch(response: Response) {
  const calls: { input: string | URL | Request; init?: RequestInit | undefined }[] = [];
  const fetchFn: FetchFn = async (input, init) => {
    calls.push({ input, init });
    return response;
  };

  return { calls, fetchFn };
}

function calledUrl(input: string | URL | Request) {
  return new URL(input instanceof Request ? input.url : input.toString());
}

function recordedCall(
  calls: { input: string | URL | Request; init?: RequestInit | undefined }[],
  index: number,
) {
  const call = calls[index];

  if (!call) {
    throw new Error(`Expected fetch call at index ${index}`);
  }

  return call;
}

describe("median", () => {
  test("returns the middle value after sorting numeric values", () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  test("averages the middle values for even-length numeric values", () => {
    expect(median([1, 3])).toBe(2);
  });

  test("returns null when all values are nullish", () => {
    expect(median([null, undefined])).toBeNull();
  });
});

describe("findCachedAiDiagnosis", () => {
  test("returns an existing AI diagnosis with the same input hash", () => {
    const matching = diagnosisRow({
      diagnosisType: "ai",
      inputHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
    const stale = diagnosisRow({
      diagnosisType: "ai",
      inputHash: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    });

    expect(
      findCachedAiDiagnosis(
        [
          stale,
          diagnosisRow({
            diagnosisType: "rule_based",
            inputHash: matching.inputHash,
          }),
          matching,
        ],
        matching.inputHash,
      ),
    ).toBe(matching);
  });

  test("returns null when the current AI diagnosis input changed", () => {
    const stale = diagnosisRow({
      diagnosisType: "ai",
      inputHash: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    });

    expect(
      findCachedAiDiagnosis(
        [stale],
        "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      ),
    ).toBeNull();
  });
});

describe("buildYoutubeAiDiagnosisInput", () => {
  test("keeps the AI cache hash stable across refresh-only row changes", () => {
    const firstInput = buildYoutubeAiDiagnosisInput({
      creativeContext: null,
      latestRuleDiagnosis: diagnosisRow({
        id: "55555555-5555-4555-8555-555555555555",
        snapshotId: "44444444-4444-4444-8444-444444444444",
        createdAt: new Date("2026-05-20T00:00:00.000Z"),
        updatedAt: new Date("2026-05-20T00:00:00.000Z"),
      }),
      link: videoLinkRow({
        lastSyncedAt: new Date("2026-05-20T00:00:00.000Z"),
        updatedAt: new Date("2026-05-20T00:00:00.000Z"),
      }),
      snapshot: snapshotRow({
        id: "44444444-4444-4444-8444-444444444444",
        snapshotAt: new Date("2026-05-20T00:00:00.000Z"),
        createdAt: new Date("2026-05-20T00:00:00.000Z"),
      }),
    });
    const refreshedInput = buildYoutubeAiDiagnosisInput({
      creativeContext: null,
      latestRuleDiagnosis: diagnosisRow({
        id: "66666666-6666-4666-8666-666666666666",
        snapshotId: "77777777-7777-4777-8777-777777777777",
        createdAt: new Date("2026-05-20T01:00:00.000Z"),
        updatedAt: new Date("2026-05-20T01:00:00.000Z"),
      }),
      link: videoLinkRow({
        lastSyncedAt: new Date("2026-05-20T01:00:00.000Z"),
        updatedAt: new Date("2026-05-20T01:00:00.000Z"),
      }),
      snapshot: snapshotRow({
        id: "77777777-7777-4777-8777-777777777777",
        snapshotAt: new Date("2026-05-20T01:00:00.000Z"),
        createdAt: new Date("2026-05-20T01:00:00.000Z"),
      }),
    });

    expect(buildYoutubeDiagnosisInputHash(refreshedInput)).toBe(
      buildYoutubeDiagnosisInputHash(firstInput),
    );
  });

  test("changes the AI cache hash when analytics metrics change", () => {
    const baselineInput = buildYoutubeAiDiagnosisInput({
      creativeContext: null,
      latestRuleDiagnosis: diagnosisRow(),
      link: videoLinkRow(),
      snapshot: snapshotRow({ views: 100 }),
    });
    const changedInput = buildYoutubeAiDiagnosisInput({
      creativeContext: null,
      latestRuleDiagnosis: diagnosisRow(),
      link: videoLinkRow(),
      snapshot: snapshotRow({ views: 120 }),
    });

    expect(buildYoutubeDiagnosisInputHash(changedInput)).not.toBe(
      buildYoutubeDiagnosisInputHash(baselineInput),
    );
  });
});

describe("toYoutubeAiDiagnosisError", () => {
  test("maps OpenAI configuration failures to the analytics AI diagnosis error", () => {
    expect(toYoutubeAiDiagnosisError(new Error("OPENAI_API_KEY_missing")).message).toBe(
      "youtube_ai_diagnosis_failed",
    );
  });
});

describe("buildAnalyticsDashboard", () => {
  test("summarizes a single YouTube analytics video", () => {
    const video: YoutubeAnalyticsVideoSummary = {
      link: {
        id: "11111111-1111-4111-8111-111111111111",
        youtubeVideoId: "abc123def45",
        projectId: "22222222-2222-4222-8222-222222222222",
        uploadJobId: "33333333-3333-4333-8333-333333333333",
        source: "db_upload",
        linkStatus: "linked",
        title: "Why cold batteries fade fast",
        description: "A compact explanation.",
        publishedAt: "2026-05-19T02:00:00.000Z",
        durationSeconds: 38,
        privacyStatus: "public",
        lastSyncedAt: "2026-05-20T00:10:00.000Z",
        createdAt: "2026-05-20T00:00:00.000Z",
        updatedAt: "2026-05-20T00:05:00.000Z",
      },
      latestSnapshot: {
        id: "44444444-4444-4444-8444-444444444444",
        youtubeVideoLinkId: "11111111-1111-4111-8111-111111111111",
        youtubeVideoId: "abc123def45",
        snapshotAt: "2026-05-20T00:10:00.000Z",
        windowDays: 30,
        views: 100,
        engagedViews: 70,
        likes: 5,
        comments: 1,
        shares: 2,
        subscribersGained: 3,
        averageViewDurationSeconds: 21,
        averageViewPercentage: 55,
        viewsPerHour: 4.2,
        likeRate: 5,
        createdAt: "2026-05-20T00:10:00.000Z",
      },
      latestRuleDiagnosis: {
        id: "55555555-5555-4555-8555-555555555555",
        youtubeVideoLinkId: "11111111-1111-4111-8111-111111111111",
        snapshotId: "44444444-4444-4444-8444-444444444444",
        diagnosisType: "rule_based",
        model: null,
        reasoningEffort: null,
        inputHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        summaryTh: "Retention is weak.",
        suggestionsEn: { labels: ["weak_hold"] },
        createdAt: "2026-05-20T00:10:00.000Z",
        updatedAt: "2026-05-20T00:10:00.000Z",
      },
      latestAiDiagnosis: null,
      creativeContext: null,
    };

    const dashboard = buildAnalyticsDashboard({
      auth: {
        connected: true,
        hasRequiredScopes: true,
        reconnectRequired: false,
      },
      videos: [video],
      windowDays: 30,
    });

    expect(dashboard.aggregates.totalViews).toBe(100);
    expect(dashboard.aggregates.bestPerformerVideoId).toBe("abc123def45");
  });

  test("uses public videos for aggregate decision metrics when public rows exist", () => {
    const privateVideo: YoutubeAnalyticsVideoSummary = {
      link: {
        ...videoLinkRow({ privacyStatus: "private", youtubeVideoId: "private-video" }),
        createdAt: "2026-05-20T00:00:00.000Z",
        lastSyncedAt: "2026-05-20T00:10:00.000Z",
        linkStatus: "linked",
        publishedAt: "2026-05-19T02:00:00.000Z",
        source: "db_upload",
        updatedAt: "2026-05-20T00:05:00.000Z",
      },
      latestSnapshot: {
        ...snapshotRow({ averageViewPercentage: 10, views: 10_000 }),
        createdAt: "2026-05-20T00:10:00.000Z",
        snapshotAt: "2026-05-20T00:10:00.000Z",
      },
      latestAiDiagnosis: null,
      latestRuleDiagnosis: null,
      creativeContext: null,
    };
    const publicVideo: YoutubeAnalyticsVideoSummary = {
      link: {
        ...videoLinkRow({ privacyStatus: "public", youtubeVideoId: "public-video" }),
        createdAt: "2026-05-20T00:00:00.000Z",
        lastSyncedAt: "2026-05-20T00:10:00.000Z",
        linkStatus: "linked",
        publishedAt: "2026-05-19T02:00:00.000Z",
        source: "db_upload",
        updatedAt: "2026-05-20T00:05:00.000Z",
      },
      latestSnapshot: {
        ...snapshotRow({ averageViewPercentage: 55, views: 100 }),
        createdAt: "2026-05-20T00:10:00.000Z",
        snapshotAt: "2026-05-20T00:10:00.000Z",
      },
      latestAiDiagnosis: null,
      latestRuleDiagnosis: null,
      creativeContext: null,
    };

    const dashboard = buildAnalyticsDashboard({
      auth: {
        connected: true,
        hasRequiredScopes: true,
        reconnectRequired: false,
      },
      videos: [privateVideo, publicVideo],
      windowDays: 30,
    });

    expect(dashboard.aggregates.recentVideoCount).toBe(1);
    expect(dashboard.aggregates.totalViews).toBe(100);
    expect(dashboard.aggregates.medianAverageViewPercentage).toBe(55);
    expect(dashboard.aggregates.bestPerformerVideoId).toBe("public-video");
    expect(dashboard.videos).toHaveLength(2);
  });
});

describe("parseIso8601DurationSeconds", () => {
  test("parses YouTube ISO-8601 video durations into seconds", () => {
    expect(parseIso8601DurationSeconds("PT37S")).toBe(37);
    expect(parseIso8601DurationSeconds("PT1M05S")).toBe(65);
    expect(parseIso8601DurationSeconds("PT2H03M04S")).toBe(7384);
  });
});

describe("deriveSnapshotMetrics", () => {
  test("derives views per hour and like rate from snapshot values", () => {
    const metrics = deriveSnapshotMetrics({
      likes: 25,
      now: new Date("2026-05-20T00:00:00.000Z"),
      publishedAt: new Date("2026-05-19T00:00:00.000Z"),
      views: 1000,
    });

    expect(metrics.viewsPerHour).toBeCloseTo(41.67, 2);
    expect(metrics.likeRate).toBe(2.5);
  });

  test("returns nullable metrics when snapshot values are missing", () => {
    const metrics = deriveSnapshotMetrics({
      likes: null,
      now: new Date("2026-05-20T00:00:00.000Z"),
      publishedAt: null,
      views: null,
    });

    expect(metrics).toEqual({
      ageHours: null,
      likeRate: null,
      viewsPerHour: null,
    });
  });

  test("returns null views per hour when published time equals now", () => {
    const now = new Date("2026-05-20T00:00:00.000Z");
    const metrics = deriveSnapshotMetrics({
      likes: 5,
      now,
      publishedAt: now,
      views: 100,
    });

    expect(metrics.ageHours).toBe(0);
    expect(metrics.viewsPerHour).toBeNull();
    expect(metrics.likeRate).toBe(5);
  });
});

describe("buildRuleDiagnosis", () => {
  test("labels strong retention with low distribution", () => {
    const diagnosis = buildRuleDiagnosis({
      ageHours: 48,
      recentMedians: {
        averageViewPercentage: 75,
        likeRate: 1.5,
        views: 900,
        viewsPerHour: 30,
      },
      snapshot: {
        averageViewPercentage: 92,
        likeRate: 2.4,
        views: 150,
        viewsPerHour: 3,
      },
    });

    expect(diagnosis.labels).toContain("strong_retention_low_distribution");
    expect(diagnosis.summaryTh).toContain("retention");
    expect(diagnosis.suggestionsEn).toMatchObject({
      labels: diagnosis.labels,
      note: expect.stringContaining("proxy"),
      priority: diagnosis.priority,
    });
  });

  test("labels videos newer than three hours as too new", () => {
    const diagnosis = buildRuleDiagnosis({
      ageHours: 0.5,
      recentMedians: {
        averageViewPercentage: 50,
        likeRate: 1,
        views: 100,
        viewsPerHour: 10,
      },
      snapshot: {
        averageViewPercentage: 0,
        likeRate: 0,
        views: 1,
        viewsPerHour: 2,
      },
    });

    expect(diagnosis.labels).toEqual(["too_new"]);
    expect(diagnosis.priority).toBe("low");
    expect(diagnosis.suggestionsEn).toMatchObject({
      labels: ["too_new"],
      priority: "low",
    });
  });
});

describe("requiredScopeError", () => {
  test("detects insufficient YouTube authentication scopes", () => {
    expect(requiredScopeError("Request had insufficient authentication scopes.")).toBe(true);
    expect(requiredScopeError("quotaExceeded")).toBe(false);
  });
});

describe("selectCurrentYoutubeSnapshotCounts", () => {
  test("prefers Data API counts over lagged Analytics API counts", () => {
    expect(
      selectCurrentYoutubeSnapshotCounts({
        analytics: {
          comments: 0,
          likes: 4,
          views: 117,
        },
        statistics: {
          commentCount: "1",
          likeCount: "15",
          viewCount: "783",
        },
      }),
    ).toEqual({
      comments: 1,
      likes: 15,
      views: 783,
    });
  });

  test("falls back to Analytics API counts when Data API counts are unavailable", () => {
    expect(
      selectCurrentYoutubeSnapshotCounts({
        analytics: {
          comments: 2,
          likes: 8,
          views: 321,
        },
        statistics: {},
      }),
    ).toEqual({
      comments: 2,
      likes: 8,
      views: 321,
    });
  });
});

describe("fetchRecentChannelVideos", () => {
  test("uses the authenticated channel uploads playlist and filters recent video ids", async () => {
    const calls: { input: string | URL | Request; init?: RequestInit | undefined }[] = [];
    const fetchFn: FetchFn = async (input, init) => {
      calls.push({ input, init });
      const url = calledUrl(input);

      if (url.pathname.endsWith("/youtube/v3/channels")) {
        return jsonResponse({
          items: [
            {
              contentDetails: {
                relatedPlaylists: {
                  uploads: "uploads-playlist-id",
                },
              },
            },
          ],
        });
      }

      return jsonResponse({
        items: [
          {
            contentDetails: {
              videoId: "id1",
              videoPublishedAt: "2026-05-19T00:00:00.000Z",
            },
          },
          {
            snippet: {
              publishedAt: "2026-05-18T00:00:00.000Z",
              resourceId: { videoId: "id2" },
            },
          },
          {
            contentDetails: {
              videoId: "old-id",
              videoPublishedAt: "2026-05-01T00:00:00.000Z",
            },
          },
        ],
      });
    };

    const ids = await fetchRecentChannelVideos({
      accessToken: "access-token",
      fetchFn,
      now: new Date("2026-05-20T00:00:00.000Z"),
      windowDays: 7,
    });

    expect(ids).toEqual(["id1", "id2"]);
    expect(calls).toHaveLength(2);

    const url = calledUrl(recordedCall(calls, 0).input);
    expect(url.origin + url.pathname).toBe("https://www.googleapis.com/youtube/v3/channels");
    expect(url.searchParams.get("part")).toBe("contentDetails");
    expect(url.searchParams.get("mine")).toBe("true");

    const playlistUrl = calledUrl(recordedCall(calls, 1).input);
    expect(playlistUrl.origin + playlistUrl.pathname).toBe(
      "https://www.googleapis.com/youtube/v3/playlistItems",
    );
    expect(playlistUrl.searchParams.get("part")).toBe("snippet,contentDetails");
    expect(playlistUrl.searchParams.get("playlistId")).toBe("uploads-playlist-id");
    expect(playlistUrl.searchParams.get("maxResults")).toBe("50");
  });

  test("returns no recent channel videos when the authenticated channel has no uploads playlist", async () => {
    const { calls, fetchFn } = recordingFetch(jsonResponse({ items: [] }));

    const ids = await fetchRecentChannelVideos({
      accessToken: "access-token",
      fetchFn,
      now: new Date("2026-05-20T00:00:00.000Z"),
      windowDays: 7,
    });

    expect(ids).toEqual([]);
    expect(calls).toHaveLength(1);
  });
});

describe("fetchYoutubeVideoDetails", () => {
  test("returns empty details and skips fetch when no ids are provided", async () => {
    const calls: unknown[] = [];
    const fetchFn: FetchFn = async (input) => {
      calls.push(input);
      return jsonResponse({ items: [] });
    };

    const details = await fetchYoutubeVideoDetails({
      accessToken: "access-token",
      fetchFn,
      youtubeVideoIds: [],
    });

    expect(details).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  test("calls YouTube videos endpoint with parts and joined ids", async () => {
    const { calls, fetchFn } = recordingFetch(jsonResponse({ items: [{ id: "id1" }] }));

    const details = await fetchYoutubeVideoDetails({
      accessToken: "access-token",
      fetchFn,
      youtubeVideoIds: ["id1", "id2"],
    });

    expect(details).toEqual([{ id: "id1" }]);
    expect(calls).toHaveLength(1);

    const url = calledUrl(recordedCall(calls, 0).input);
    expect(url.origin + url.pathname).toBe("https://www.googleapis.com/youtube/v3/videos");
    expect(url.searchParams.get("part")).toBe("snippet,status,statistics,contentDetails");
    expect(url.searchParams.get("id")).toBe("id1,id2");
  });
});

describe("fetchYoutubeAnalyticsRows", () => {
  test("returns empty rows and skips fetch when no ids are provided", async () => {
    const calls: unknown[] = [];
    const fetchFn: FetchFn = async (input) => {
      calls.push(input);
      return jsonResponse({ rows: [] });
    };

    const rows = await fetchYoutubeAnalyticsRows({
      accessToken: "access-token",
      endDate: "2026-05-20",
      fetchFn,
      startDate: "2026-05-19",
      youtubeVideoIds: [],
    });

    expect(rows).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  test("calls reports endpoint with analytics params", async () => {
    const { calls, fetchFn } = recordingFetch(jsonResponse({ rows: [] }));

    await fetchYoutubeAnalyticsRows({
      accessToken: "access-token",
      endDate: "2026-05-20",
      fetchFn,
      startDate: "2026-05-19",
      youtubeVideoIds: ["id1", "id2"],
    });

    expect(calls).toHaveLength(1);

    const url = calledUrl(recordedCall(calls, 0).input);
    expect(url.origin + url.pathname).toBe("https://youtubeanalytics.googleapis.com/v2/reports");
    expect(url.searchParams.get("ids")).toBe("channel==MINE");
    expect(url.searchParams.get("dimensions")).toBe("video");
    expect(url.searchParams.get("metrics")).toContain("views");
    expect(url.searchParams.get("metrics")).toContain("engagedViews");
    expect(url.searchParams.get("filters")).toBe("video==id1,id2");
    expect(url.searchParams.get("startDate")).toBe("2026-05-19");
    expect(url.searchParams.get("endDate")).toBe("2026-05-20");
  });

  test("uses column fallbacks when analytics rows omit headers", async () => {
    const rows = await fetchYoutubeAnalyticsRows({
      accessToken: "access-token",
      endDate: "2026-05-20",
      fetchFn: async () => jsonResponse({ rows: [["abc123def45", 10]] }),
      startDate: "2026-05-19",
      youtubeVideoIds: ["abc123def45"],
    });

    expect(rows).toEqual([{ column_0: "abc123def45", column_1: 10 }]);
  });

  test("maps insufficient scope responses to reconnect required", async () => {
    const { fetchFn } = recordingFetch(
      jsonResponse(
        {
          error: {
            message: "Request had insufficient authentication scopes.",
          },
        },
        403,
      ),
    );

    await expect(
      fetchYoutubeAnalyticsRows({
        accessToken: "access-token",
        endDate: "2026-05-20",
        fetchFn,
        startDate: "2026-05-19",
        youtubeVideoIds: ["id1"],
      }),
    ).rejects.toThrow("youtube_reconnect_required");
  });

  test("maps generic non-ok responses to analytics fetch failed", async () => {
    const { fetchFn } = recordingFetch(jsonResponse({ error: { message: "quotaExceeded" } }, 429));

    await expect(
      fetchYoutubeAnalyticsRows({
        accessToken: "access-token",
        endDate: "2026-05-20",
        fetchFn,
        startDate: "2026-05-19",
        youtubeVideoIds: ["id1"],
      }),
    ).rejects.toThrow("youtube_analytics_fetch_failed:429");
  });

  test("maps non-json error responses to analytics fetch failed", async () => {
    const { fetchFn } = recordingFetch(textResponse("Bad Gateway", 502));

    await expect(
      fetchYoutubeAnalyticsRows({
        accessToken: "access-token",
        endDate: "2026-05-20",
        fetchFn,
        startDate: "2026-05-19",
        youtubeVideoIds: ["id1"],
      }),
    ).rejects.toThrow("youtube_analytics_fetch_failed:502");
  });
});

function diagnosisRow(overrides: Partial<YoutubeVideoDiagnosisRow> = {}): YoutubeVideoDiagnosisRow {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    youtubeVideoLinkId: "11111111-1111-4111-8111-111111111111",
    snapshotId: "44444444-4444-4444-8444-444444444444",
    diagnosisType: "ai",
    model: "gpt-5.5",
    reasoningEffort: "xhigh",
    inputHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    summaryTh: "The opening is clear but the payoff lands late.",
    suggestionsEn: { hook: "Open with the failed phone moment." },
    rawOutput: {},
    createdAt: new Date("2026-05-20T00:00:00.000Z"),
    updatedAt: new Date("2026-05-20T00:05:00.000Z"),
    ...overrides,
  };
}

function videoLinkRow(overrides: Partial<YoutubeVideoLinkRow> = {}): YoutubeVideoLinkRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    youtubeVideoId: "abc123def45",
    projectId: "22222222-2222-4222-8222-222222222222",
    uploadJobId: "33333333-3333-4333-8333-333333333333",
    source: "db_upload",
    linkStatus: "linked",
    title: "Why cold batteries fade fast",
    description: "A compact explanation.",
    publishedAt: new Date("2026-05-19T02:00:00.000Z"),
    durationSeconds: 38,
    privacyStatus: "private",
    lastSyncedAt: new Date("2026-05-20T00:10:00.000Z"),
    createdAt: new Date("2026-05-20T00:00:00.000Z"),
    updatedAt: new Date("2026-05-20T00:05:00.000Z"),
    ...overrides,
  };
}

function snapshotRow(
  overrides: Partial<YoutubeAnalyticsSnapshotRow> = {},
): YoutubeAnalyticsSnapshotRow {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    youtubeVideoLinkId: "11111111-1111-4111-8111-111111111111",
    youtubeVideoId: "abc123def45",
    snapshotAt: new Date("2026-05-20T00:10:00.000Z"),
    windowDays: 30,
    views: 100,
    engagedViews: 70,
    likes: 5,
    comments: 1,
    shares: 2,
    subscribersGained: 3,
    averageViewDurationSeconds: 21,
    averageViewPercentage: 55,
    viewsPerHour: 4.2,
    likeRate: 5,
    rawDataApi: {},
    rawAnalyticsApi: {},
    createdAt: new Date("2026-05-20T00:10:00.000Z"),
    ...overrides,
  };
}
