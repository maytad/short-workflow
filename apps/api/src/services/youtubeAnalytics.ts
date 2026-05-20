export type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type DerivedMetricInput = {
  views: number | null;
  likes: number | null;
  publishedAt: Date | null;
  now: Date;
};

export type DerivedSnapshotMetrics = {
  ageHours: number | null;
  viewsPerHour: number | null;
  likeRate: number | null;
};

type NullableAnalyticsMetrics = {
  views: number | null;
  viewsPerHour: number | null;
  averageViewPercentage: number | null;
  likeRate: number | null;
};

export type RuleDiagnosisInput = {
  snapshot: NullableAnalyticsMetrics;
  recentMedians: NullableAnalyticsMetrics;
  ageHours: number | null;
};

export type RuleDiagnosisOutput = {
  labels: string[];
  priority: "low" | "medium" | "high";
  summaryTh: string;
  suggestionsEn: Record<string, unknown>;
};

export type YoutubeVideoApiItem = {
  id: string;
  snippet?: {
    publishedAt?: string;
    channelId?: string;
    title?: string;
    description?: string;
    thumbnails?: Record<string, unknown>;
    channelTitle?: string;
  };
  status?: {
    uploadStatus?: string;
    privacyStatus?: string;
    license?: string;
    embeddable?: boolean;
    publicStatsViewable?: boolean;
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
  contentDetails?: {
    duration?: string;
    dimension?: string;
    definition?: string;
    caption?: string;
  };
};

type FetchJsonInput = {
  accessToken: string;
  url: URL;
  fetchFn?: FetchFn | undefined;
};

type YoutubeAnalyticsColumnHeader = {
  name: string;
  columnType?: string;
  dataType?: string;
};

type YoutubeAnalyticsValue = string | number | boolean | null;

export type YoutubeAnalyticsRow = Record<string, YoutubeAnalyticsValue>;

const YOUTUBE_ANALYTICS_METRICS = [
  "views",
  "engagedViews",
  "averageViewDuration",
  "averageViewPercentage",
  "likes",
  "comments",
  "shares",
  "subscribersGained",
].join(",");

export function parseIso8601DurationSeconds(value: string): number | null {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value);

  if (!match) {
    return null;
  }

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);

  return hours * 3600 + minutes * 60 + seconds;
}

export function deriveSnapshotMetrics(input: DerivedMetricInput): DerivedSnapshotMetrics {
  const ageHours = input.publishedAt
    ? Math.max(0, (input.now.getTime() - input.publishedAt.getTime()) / 3_600_000)
    : null;
  const viewsPerHour =
    input.views === null || ageHours === null
      ? null
      : ageHours > 0
        ? input.views / ageHours
        : input.views;
  const likeRate =
    input.views === null || input.likes === null || input.views <= 0
      ? null
      : (input.likes / input.views) * 100;

  return { ageHours, likeRate, viewsPerHour };
}

export function requiredScopeError(message: string) {
  return /insufficient authentication scopes|insufficientpermissions/i.test(message);
}

function addLabel(labels: string[], label: string) {
  if (!labels.includes(label)) {
    labels.push(label);
  }
}

export function buildRuleDiagnosis(input: RuleDiagnosisInput): RuleDiagnosisOutput {
  if (input.ageHours !== null && input.ageHours < 3) {
    return {
      labels: ["too_new"],
      priority: "low",
      summaryTh: "วิดีโอยังใหม่เกินไป: too_new ควรรอข้อมูลเพิ่มก่อนตัดสิน",
      suggestionsEn: {
        labels: ["too_new"],
        note: "Analytics values are early proxy signals, not final performance truth.",
        priority: "low",
      },
    };
  }

  const labels: string[] = [];
  const lowViews =
    input.snapshot.views !== null &&
    input.recentMedians.views !== null &&
    input.snapshot.views < input.recentMedians.views * 0.5;
  const lowVelocity =
    input.snapshot.viewsPerHour !== null &&
    input.recentMedians.viewsPerHour !== null &&
    input.snapshot.viewsPerHour < input.recentMedians.viewsPerHour * 0.5;
  const strongRetention =
    input.snapshot.averageViewPercentage !== null &&
    input.recentMedians.averageViewPercentage !== null &&
    input.snapshot.averageViewPercentage >= input.recentMedians.averageViewPercentage * 1.15;
  const weakRetention =
    input.snapshot.averageViewPercentage !== null &&
    input.recentMedians.averageViewPercentage !== null &&
    input.snapshot.averageViewPercentage < input.recentMedians.averageViewPercentage * 0.8;
  const highLikeRate =
    input.snapshot.likeRate !== null &&
    input.recentMedians.likeRate !== null &&
    input.snapshot.likeRate >= input.recentMedians.likeRate * 1.3;

  if (lowViews || lowVelocity) {
    addLabel(labels, "low_exposure_proxy");
  }

  if (weakRetention) {
    addLabel(labels, "weak_hold");
  }

  if (strongRetention && (lowViews || lowVelocity)) {
    addLabel(labels, "strong_retention_low_distribution");
  }

  if (highLikeRate && lowViews) {
    addLabel(labels, "high_like_rate_low_scale");
  }

  if (
    input.snapshot.views !== null &&
    input.recentMedians.views !== null &&
    input.snapshot.viewsPerHour !== null &&
    input.recentMedians.viewsPerHour !== null &&
    input.snapshot.averageViewPercentage !== null &&
    input.recentMedians.averageViewPercentage !== null &&
    input.snapshot.likeRate !== null &&
    input.recentMedians.likeRate !== null &&
    input.snapshot.views >= input.recentMedians.views * 1.5 &&
    input.snapshot.viewsPerHour >= input.recentMedians.viewsPerHour * 1.25 &&
    input.snapshot.averageViewPercentage >= input.recentMedians.averageViewPercentage &&
    input.snapshot.likeRate >= input.recentMedians.likeRate
  ) {
    addLabel(labels, "winner_candidate");
  }

  if (labels.length === 0) {
    addLabel(labels, "mid_video_drop_proxy");
  }

  const priority = labels.includes("weak_hold")
    ? "high"
    : labels.includes("winner_candidate")
      ? "low"
      : "medium";

  return {
    labels,
    priority,
    summaryTh: `สรุป diagnosis: ${labels.join(", ")} โดยดู retention, distribution, like rate และ scale เทียบ median`,
    suggestionsEn: {
      labels,
      note: "Use this as a rule-based proxy until deeper audience retention and distribution data are integrated.",
      priority,
    },
  };
}

async function fetchJson({ accessToken, fetchFn = fetch, url }: FetchJsonInput): Promise<unknown> {
  const response = await fetchFn(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
    },
  });
  const text = await response.text();
  const body = text.length > 0 ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = typeof body === "object" && body !== null ? JSON.stringify(body) : text;

    if (requiredScopeError(message)) {
      throw new Error("youtube_reconnect_required");
    }

    throw new Error(`youtube_analytics_fetch_failed:${response.status}`);
  }

  return body;
}

export async function fetchRecentChannelVideos({
  accessToken,
  fetchFn,
  now = new Date(),
  windowDays,
}: {
  accessToken: string;
  windowDays: number;
  now?: Date | string;
  fetchFn?: FetchFn;
}): Promise<string[]> {
  const publishedAfter = new Date(new Date(now).getTime() - windowDays * 24 * 60 * 60 * 1000);
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "id");
  url.searchParams.set("forMine", "true");
  url.searchParams.set("type", "video");
  url.searchParams.set("order", "date");
  url.searchParams.set("maxResults", "50");
  url.searchParams.set("publishedAfter", publishedAfter.toISOString());

  const body = (await fetchJson({ accessToken, fetchFn, url })) as {
    items?: { id?: { videoId?: string } }[];
  } | null;

  return (body?.items ?? [])
    .map((item) => item.id?.videoId)
    .filter((videoId): videoId is string => Boolean(videoId));
}

export async function fetchYoutubeVideoDetails({
  accessToken,
  fetchFn,
  youtubeVideoIds,
}: {
  accessToken: string;
  youtubeVideoIds: string[];
  fetchFn?: FetchFn;
}): Promise<YoutubeVideoApiItem[]> {
  if (youtubeVideoIds.length === 0) {
    return [];
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "snippet,status,statistics,contentDetails");
  url.searchParams.set("id", youtubeVideoIds.join(","));

  const body = (await fetchJson({ accessToken, fetchFn, url })) as {
    items?: YoutubeVideoApiItem[];
  } | null;

  return body?.items ?? [];
}

export async function fetchYoutubeAnalyticsRows({
  accessToken,
  endDate,
  fetchFn,
  startDate,
  youtubeVideoIds,
}: {
  accessToken: string;
  youtubeVideoIds: string[];
  startDate: string;
  endDate: string;
  fetchFn?: FetchFn;
}): Promise<YoutubeAnalyticsRow[]> {
  if (youtubeVideoIds.length === 0) {
    return [];
  }

  const url = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
  url.searchParams.set("ids", "channel==MINE");
  url.searchParams.set("dimensions", "video");
  url.searchParams.set("metrics", YOUTUBE_ANALYTICS_METRICS);
  url.searchParams.set("filters", `video==${youtubeVideoIds.join(",")}`);
  url.searchParams.set("startDate", startDate);
  url.searchParams.set("endDate", endDate);

  const body = (await fetchJson({ accessToken, fetchFn, url })) as {
    columnHeaders?: YoutubeAnalyticsColumnHeader[];
    rows?: YoutubeAnalyticsValue[][];
  } | null;
  const headers = body?.columnHeaders ?? [];

  return (body?.rows ?? []).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header.name, row[index] ?? null])),
  );
}
