import { describe, expect, test } from "bun:test";

import {
  buildRuleDiagnosis,
  deriveSnapshotMetrics,
  fetchRecentChannelVideos,
  fetchYoutubeAnalyticsRows,
  fetchYoutubeVideoDetails,
  parseIso8601DurationSeconds,
  requiredScopeError,
  type FetchFn,
} from "./youtubeAnalytics";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
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

describe("fetchRecentChannelVideos", () => {
  test("calls YouTube search endpoint with recent video params and returns ids", async () => {
    const { calls, fetchFn } = recordingFetch(
      jsonResponse({
        items: [{ id: { videoId: "id1" } }, { id: { videoId: "id2" } }, { id: {} }],
      }),
    );

    const ids = await fetchRecentChannelVideos({
      accessToken: "access-token",
      fetchFn,
      now: new Date("2026-05-20T00:00:00.000Z"),
      windowDays: 7,
    });

    expect(ids).toEqual(["id1", "id2"]);
    expect(calls).toHaveLength(1);

    const url = calledUrl(calls[0]!.input);
    expect(url.origin + url.pathname).toBe("https://www.googleapis.com/youtube/v3/search");
    expect(url.searchParams.get("part")).toBe("id");
    expect(url.searchParams.get("forMine")).toBe("true");
    expect(url.searchParams.get("type")).toBe("video");
    expect(url.searchParams.get("order")).toBe("date");
    expect(url.searchParams.get("maxResults")).toBe("50");
    expect(url.searchParams.get("publishedAfter")).toBe("2026-05-13T00:00:00.000Z");
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

    const url = calledUrl(calls[0]!.input);
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

    const url = calledUrl(calls[0]!.input);
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
});
