import { buildYoutubeDiagnosisInputHash, diagnoseYoutubeVideo } from "@short-workflow/ai";
import {
  createYoutubeAnalyticsSnapshot,
  type DbClient,
  getYoutubeCreativeContext,
  getYoutubeVideoLinkByVideoId,
  listLatestYoutubeAnalyticsSnapshots,
  listLatestYoutubeVideoDiagnoses,
  listRecentYoutubeVideoLinks,
  listYoutubeUploadVideoMappings,
  normalizeYoutubeMetricNumber,
  upsertYoutubeVideoDiagnosis,
  upsertYoutubeVideoLink,
  type YoutubeAnalyticsSnapshotRow,
  type YoutubeVideoDiagnosisRow,
  type YoutubeVideoLinkRow,
} from "@short-workflow/db";
import type {
  YoutubeAiDiagnosisResponse,
  YoutubeAnalyticsCreativeContext,
  YoutubeAnalyticsDashboardResponse,
  YoutubeAnalyticsVideoSummary,
} from "@short-workflow/shared";

import { getYoutubeAuthStatus, readFreshYoutubeAccessToken } from "./youtubeAuth";

export type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const DEFAULT_ANALYTICS_WINDOW_DAYS = 30;

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

type YoutubeChannelApiItem = {
  contentDetails?: {
    relatedPlaylists?: {
      uploads?: string;
    };
  };
};

type YoutubePlaylistItemApiItem = {
  snippet?: {
    publishedAt?: string;
    resourceId?: {
      videoId?: string;
    };
  };
  contentDetails?: {
    videoId?: string;
    videoPublishedAt?: string;
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

export function median(values: Array<number | null | undefined>) {
  const numeric = values
    .filter((value): value is number => typeof value === "number")
    .sort((left, right) => left - right);

  if (numeric.length === 0) {
    return null;
  }

  if (numeric.length % 2 === 0) {
    const rightIndex = numeric.length / 2;
    const left = numeric[rightIndex - 1];
    const right = numeric[rightIndex];

    return left === undefined || right === undefined ? null : (left + right) / 2;
  }

  return numeric[Math.floor(numeric.length / 2)] ?? null;
}

export function buildAnalyticsDashboard(input: {
  auth: YoutubeAnalyticsDashboardResponse["auth"];
  windowDays: number;
  videos: YoutubeAnalyticsVideoSummary[];
}): YoutubeAnalyticsDashboardResponse {
  const publicVideos = input.videos.filter((video) => video.link.privacyStatus === "public");
  const analysisVideos = publicVideos.length > 0 ? publicVideos : input.videos;
  const totalViews = analysisVideos.reduce(
    (sum, video) => sum + (video.latestSnapshot?.views ?? 0),
    0,
  );
  const best = [...analysisVideos].sort(
    (left, right) => (right.latestSnapshot?.views ?? 0) - (left.latestSnapshot?.views ?? 0),
  )[0];
  const needsAttentionCount = analysisVideos.filter((video) => {
    const suggestions = video.latestRuleDiagnosis?.suggestionsEn as
      | { labels?: unknown }
      | undefined;

    return Array.isArray(suggestions?.labels)
      ? suggestions.labels.some((label) => label === "weak_hold" || label === "low_exposure_proxy")
      : false;
  }).length;

  return {
    auth: input.auth,
    windowDays: input.windowDays,
    aggregates: {
      recentVideoCount: analysisVideos.length,
      totalViews,
      needsAttentionCount,
      medianAverageViewPercentage: median(
        analysisVideos.map((video) => video.latestSnapshot?.averageViewPercentage),
      ),
      bestPerformerVideoId: best?.latestSnapshot?.views ? best.link.youtubeVideoId : null,
    },
    videos: input.videos,
  };
}

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
    input.views === null || ageHours === null ? null : ageHours > 0 ? input.views / ageHours : null;
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
  const body = parseMaybeJson(text);

  if (!response.ok) {
    const message = typeof body === "object" && body !== null ? JSON.stringify(body) : String(body);

    if (requiredScopeError(message)) {
      throw new Error("youtube_reconnect_required");
    }

    const error = new Error(`youtube_analytics_fetch_failed:${response.status}`);
    Object.assign(error, {
      upstreamBody: body,
      upstreamStatus: response.status,
      upstreamUrl: `${url.origin}${url.pathname}`,
    });

    throw error;
  }

  return body;
}

function parseMaybeJson(text: string): unknown {
  if (text.length === 0) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
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
  const uploadsPlaylistId = await fetchAuthenticatedUploadsPlaylistId({ accessToken, fetchFn });

  if (!uploadsPlaylistId) {
    return [];
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
  url.searchParams.set("part", "snippet,contentDetails");
  url.searchParams.set("playlistId", uploadsPlaylistId);
  url.searchParams.set("maxResults", "50");

  const body = (await fetchJson({ accessToken, fetchFn, url })) as {
    items?: YoutubePlaylistItemApiItem[];
  } | null;

  return (body?.items ?? [])
    .map((item) => ({
      publishedAt: playlistItemPublishedAt(item),
      videoId: playlistItemVideoId(item),
    }))
    .filter(
      (item): item is { publishedAt: Date; videoId: string } =>
        item.publishedAt !== null && item.videoId !== null && item.publishedAt >= publishedAfter,
    )
    .map((item) => item.videoId);
}

async function fetchAuthenticatedUploadsPlaylistId({
  accessToken,
  fetchFn,
}: {
  accessToken: string;
  fetchFn?: FetchFn | undefined;
}) {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "contentDetails");
  url.searchParams.set("mine", "true");

  const body = (await fetchJson({ accessToken, fetchFn, url })) as {
    items?: YoutubeChannelApiItem[];
  } | null;

  return body?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
}

function playlistItemVideoId(item: YoutubePlaylistItemApiItem) {
  return item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId ?? null;
}

function playlistItemPublishedAt(item: YoutubePlaylistItemApiItem) {
  const value = item.contentDetails?.videoPublishedAt ?? item.snippet?.publishedAt;

  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
    Object.fromEntries(
      row.map((value, index) => [headers[index]?.name ?? `column_${index}`, value]),
    ),
  );
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toApiVideoLink(row: YoutubeVideoLinkRow) {
  return {
    id: row.id,
    youtubeVideoId: row.youtubeVideoId,
    projectId: row.projectId,
    uploadJobId: row.uploadJobId,
    source: row.source as "db_upload" | "channel_discovery",
    linkStatus: row.linkStatus as "linked" | "unlinked",
    title: row.title,
    description: row.description,
    publishedAt: toIso(row.publishedAt),
    durationSeconds: row.durationSeconds,
    privacyStatus: row.privacyStatus,
    lastSyncedAt: toIso(row.lastSyncedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toApiSnapshot(row: YoutubeAnalyticsSnapshotRow) {
  return {
    id: row.id,
    youtubeVideoLinkId: row.youtubeVideoLinkId,
    youtubeVideoId: row.youtubeVideoId,
    snapshotAt: row.snapshotAt.toISOString(),
    windowDays: row.windowDays,
    views: row.views,
    engagedViews: row.engagedViews,
    likes: row.likes,
    comments: row.comments,
    shares: row.shares,
    subscribersGained: row.subscribersGained,
    averageViewDurationSeconds: row.averageViewDurationSeconds,
    averageViewPercentage: row.averageViewPercentage,
    viewsPerHour: row.viewsPerHour,
    likeRate: row.likeRate,
    createdAt: row.createdAt.toISOString(),
  };
}

function toDiagnosisLinkInput(row: YoutubeVideoLinkRow) {
  return {
    youtubeVideoId: row.youtubeVideoId,
    projectId: row.projectId,
    uploadJobId: row.uploadJobId,
    source: row.source,
    linkStatus: row.linkStatus,
    title: row.title,
    description: row.description,
    publishedAt: toIso(row.publishedAt),
    durationSeconds: row.durationSeconds,
    privacyStatus: row.privacyStatus,
  };
}

function toDiagnosisSnapshotInput(row: YoutubeAnalyticsSnapshotRow) {
  return {
    youtubeVideoId: row.youtubeVideoId,
    windowDays: row.windowDays,
    views: row.views,
    engagedViews: row.engagedViews,
    likes: row.likes,
    comments: row.comments,
    shares: row.shares,
    subscribersGained: row.subscribersGained,
    averageViewDurationSeconds: row.averageViewDurationSeconds,
    averageViewPercentage: row.averageViewPercentage,
    viewsPerHour: row.viewsPerHour,
    likeRate: row.likeRate,
  };
}

function toDiagnosisRuleInput(row: YoutubeVideoDiagnosisRow) {
  return {
    diagnosisType: row.diagnosisType,
    model: row.model,
    reasoningEffort: row.reasoningEffort,
    inputHash: row.inputHash,
    summaryTh: row.summaryTh,
    suggestionsEn: toRecord(row.suggestionsEn),
  };
}

export function buildYoutubeAiDiagnosisInput({
  creativeContext,
  latestRuleDiagnosis,
  link,
  snapshot,
}: {
  creativeContext: YoutubeAnalyticsCreativeContext | null;
  latestRuleDiagnosis: YoutubeVideoDiagnosisRow | null;
  link: YoutubeVideoLinkRow;
  snapshot: YoutubeAnalyticsSnapshotRow;
}) {
  return {
    creativeContext,
    latestRuleDiagnosis: latestRuleDiagnosis ? toDiagnosisRuleInput(latestRuleDiagnosis) : null,
    latestSnapshot: toDiagnosisSnapshotInput(snapshot),
    link: toDiagnosisLinkInput(link),
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toApiDiagnosis(row: YoutubeVideoDiagnosisRow) {
  return {
    id: row.id,
    youtubeVideoLinkId: row.youtubeVideoLinkId,
    snapshotId: row.snapshotId,
    diagnosisType: row.diagnosisType as "rule_based" | "ai",
    model: row.model,
    reasoningEffort: row.reasoningEffort,
    inputHash: row.inputHash,
    summaryTh: row.summaryTh,
    suggestionsEn: toRecord(row.suggestionsEn),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function findCachedAiDiagnosis(
  diagnoses: YoutubeVideoDiagnosisRow[],
  inputHash: string,
): YoutubeVideoDiagnosisRow | null {
  return (
    diagnoses.find(
      (diagnosis) => diagnosis.diagnosisType === "ai" && diagnosis.inputHash === inputHash,
    ) ?? null
  );
}

export function toYoutubeAiDiagnosisError(_error: unknown) {
  return new Error("youtube_ai_diagnosis_failed");
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function parseDate(value: string | undefined): Date | null {
  return value ? new Date(value) : null;
}

function analyticsByVideoId(rows: YoutubeAnalyticsRow[]) {
  const map = new Map<string, YoutubeAnalyticsRow>();

  for (const row of rows) {
    if (typeof row.video === "string") {
      map.set(row.video, row);
    }
  }

  return map;
}

function metric(row: YoutubeAnalyticsRow | undefined, key: string) {
  return normalizeYoutubeMetricNumber(row?.[key]);
}

function intMetric(row: YoutubeAnalyticsRow | undefined, key: string) {
  const value = metric(row, key);

  return value === null ? null : Math.trunc(value);
}

export function selectCurrentYoutubeSnapshotCounts({
  analytics,
  statistics,
}: {
  analytics: YoutubeAnalyticsRow | undefined;
  statistics: YoutubeVideoApiItem["statistics"] | undefined;
}) {
  const dataApiViews = normalizeYoutubeMetricNumber(statistics?.viewCount);
  const dataApiLikes = normalizeYoutubeMetricNumber(statistics?.likeCount);
  const dataApiComments = normalizeYoutubeMetricNumber(statistics?.commentCount);

  return {
    views: dataApiViews ?? intMetric(analytics, "views"),
    likes: dataApiLikes ?? intMetric(analytics, "likes"),
    comments: dataApiComments ?? intMetric(analytics, "comments"),
  };
}

function toSnapshotRuleInput(snapshot: YoutubeAnalyticsSnapshotRow): NullableAnalyticsMetrics {
  return {
    views: snapshot.views,
    viewsPerHour: snapshot.viewsPerHour,
    averageViewPercentage: snapshot.averageViewPercentage,
    likeRate: snapshot.likeRate,
  };
}

function summarizeRecentMedians(
  snapshots: YoutubeAnalyticsSnapshotRow[],
): NullableAnalyticsMetrics {
  return {
    views: median(snapshots.map((snapshot) => snapshot.views)),
    viewsPerHour: median(snapshots.map((snapshot) => snapshot.viewsPerHour)),
    averageViewPercentage: median(snapshots.map((snapshot) => snapshot.averageViewPercentage)),
    likeRate: median(snapshots.map((snapshot) => snapshot.likeRate)),
  };
}

async function loadDashboard(
  db: DbClient,
  input: { windowDays: number },
): Promise<YoutubeAnalyticsDashboardResponse> {
  const auth = await getYoutubeAuthStatus();
  const since = new Date(Date.now() - input.windowDays * 24 * 60 * 60 * 1000);
  const links = await listRecentYoutubeVideoLinks(db, since);
  const linkIds = links.map((link) => link.id);
  const snapshots = await listLatestYoutubeAnalyticsSnapshots(db, linkIds, {
    windowDays: input.windowDays,
  });
  const diagnoses = await listLatestYoutubeVideoDiagnoses(db, {
    windowDays: input.windowDays,
    youtubeVideoLinkIds: linkIds,
  });
  const creativeContexts = await Promise.all(
    links.map((link) => getYoutubeCreativeContext(db, link.youtubeVideoId)),
  );

  const videos = links.map((link, index) => {
    const latestSnapshot =
      snapshots.find((snapshot) => snapshot.youtubeVideoLinkId === link.id) ?? null;
    const latestRuleDiagnosis =
      diagnoses.find(
        (diagnosis) =>
          diagnosis.youtubeVideoLinkId === link.id && diagnosis.diagnosisType === "rule_based",
      ) ?? null;
    const latestAiDiagnosis =
      diagnoses.find(
        (diagnosis) => diagnosis.youtubeVideoLinkId === link.id && diagnosis.diagnosisType === "ai",
      ) ?? null;

    return {
      link: toApiVideoLink(link),
      latestSnapshot: latestSnapshot ? toApiSnapshot(latestSnapshot) : null,
      latestRuleDiagnosis: latestRuleDiagnosis ? toApiDiagnosis(latestRuleDiagnosis) : null,
      latestAiDiagnosis: latestAiDiagnosis ? toApiDiagnosis(latestAiDiagnosis) : null,
      creativeContext: creativeContexts[index] ?? null,
    };
  });

  return buildAnalyticsDashboard({
    auth,
    windowDays: input.windowDays,
    videos,
  });
}

async function refreshYoutubeAnalyticsDashboard(
  db: DbClient,
  input: { windowDays: number },
): Promise<YoutubeAnalyticsDashboardResponse> {
  const now = new Date();
  const accessToken = await readFreshYoutubeAccessToken();
  const recentIds = await fetchRecentChannelVideos({
    accessToken,
    now,
    windowDays: input.windowDays,
  });
  const details = await fetchYoutubeVideoDetails({
    accessToken,
    youtubeVideoIds: recentIds,
  });
  const startDate = dateOnly(new Date(now.getTime() - input.windowDays * 24 * 60 * 60 * 1000));
  const analyticsRows = analyticsByVideoId(
    await fetchYoutubeAnalyticsRows({
      accessToken,
      endDate: dateOnly(now),
      startDate,
      youtubeVideoIds: recentIds,
    }),
  );
  const mappings = await listYoutubeUploadVideoMappings(db);
  const mappingByVideoId = new Map(
    mappings.map((mapping) => [mapping.youtubeVideoId, mapping] as const),
  );
  const createdSnapshots: YoutubeAnalyticsSnapshotRow[] = [];
  const publicSnapshots: YoutubeAnalyticsSnapshotRow[] = [];

  for (const item of details) {
    const mapping = mappingByVideoId.get(item.id);
    const publishedAt = parseDate(item.snippet?.publishedAt);
    const analytics = analyticsRows.get(item.id);
    const { comments, likes, views } = selectCurrentYoutubeSnapshotCounts({
      analytics,
      statistics: item.statistics,
    });
    const derived = deriveSnapshotMetrics({ likes, now, publishedAt, views });
    const link = await upsertYoutubeVideoLink(db, {
      youtubeVideoId: item.id,
      projectId: mapping?.projectId ?? null,
      uploadJobId: mapping?.uploadJobId ?? null,
      source: mapping ? "db_upload" : "channel_discovery",
      linkStatus: mapping ? "linked" : "unlinked",
      title: item.snippet?.title?.trim() || "Untitled YouTube video",
      description: item.snippet?.description ?? null,
      publishedAt,
      durationSeconds: item.contentDetails?.duration
        ? parseIso8601DurationSeconds(item.contentDetails.duration)
        : null,
      privacyStatus: item.status?.privacyStatus ?? null,
      lastSyncedAt: now,
    });
    const averageViewDuration = metric(analytics, "averageViewDuration");

    const snapshot = await createYoutubeAnalyticsSnapshot(db, {
      youtubeVideoLinkId: link.id,
      youtubeVideoId: item.id,
      windowDays: input.windowDays,
      views,
      engagedViews: intMetric(analytics, "engagedViews"),
      likes,
      comments,
      shares: intMetric(analytics, "shares"),
      subscribersGained: intMetric(analytics, "subscribersGained"),
      averageViewDurationSeconds:
        averageViewDuration === null ? null : Math.trunc(averageViewDuration),
      averageViewPercentage: metric(analytics, "averageViewPercentage"),
      viewsPerHour: derived.viewsPerHour,
      likeRate: derived.likeRate,
      rawDataApi: toRecord(item),
      rawAnalyticsApi: analytics ?? {},
    });

    createdSnapshots.push(snapshot);

    if (link.privacyStatus === "public") {
      publicSnapshots.push(snapshot);
    }
  }

  const recentMedians = summarizeRecentMedians(
    publicSnapshots.length > 0 ? publicSnapshots : createdSnapshots,
  );

  for (const snapshot of createdSnapshots) {
    const link = await getYoutubeVideoLinkByVideoId(db, snapshot.youtubeVideoId);

    if (!link) {
      continue;
    }

    const ageHours =
      link.publishedAt === null
        ? null
        : Math.max(0, (now.getTime() - link.publishedAt.getTime()) / 3_600_000);
    const rule = buildRuleDiagnosis({
      ageHours,
      recentMedians,
      snapshot: toSnapshotRuleInput(snapshot),
    });
    const inputHash = buildYoutubeDiagnosisInputHash({
      ageHours,
      recentMedians,
      snapshot: toSnapshotRuleInput(snapshot),
      type: "rule_based",
      youtubeVideoId: snapshot.youtubeVideoId,
    });

    await upsertYoutubeVideoDiagnosis(db, {
      youtubeVideoLinkId: link.id,
      snapshotId: snapshot.id,
      diagnosisType: "rule_based",
      model: null,
      reasoningEffort: null,
      inputHash,
      summaryTh: rule.summaryTh,
      suggestionsEn: rule.suggestionsEn,
      rawOutput: rule,
    });
  }

  return loadDashboard(db, input);
}

async function analyzeYoutubeVideoWithAi(
  db: DbClient,
  input: { youtubeVideoId: string },
): Promise<YoutubeAiDiagnosisResponse> {
  const link = await getYoutubeVideoLinkByVideoId(db, input.youtubeVideoId);

  if (!link) {
    throw new Error("youtube_video_not_found");
  }

  const [snapshot] = await listLatestYoutubeAnalyticsSnapshots(db, [link.id], {
    windowDays: DEFAULT_ANALYTICS_WINDOW_DAYS,
  });

  if (!snapshot) {
    throw new Error("youtube_analytics_snapshot_missing");
  }

  const [latestRuleDiagnosis] = await listLatestYoutubeVideoDiagnoses(db, {
    diagnosisType: "rule_based",
    windowDays: snapshot.windowDays,
    youtubeVideoLinkIds: [link.id],
  });
  const creativeContext = await getYoutubeCreativeContext(db, input.youtubeVideoId);
  const diagnosisInput = buildYoutubeAiDiagnosisInput({
    creativeContext,
    latestRuleDiagnosis: latestRuleDiagnosis ?? null,
    link,
    snapshot,
  });
  const inputHash = buildYoutubeDiagnosisInputHash(diagnosisInput);
  const latestAiDiagnoses = await listLatestYoutubeVideoDiagnoses(db, {
    diagnosisType: "ai",
    windowDays: snapshot.windowDays,
    youtubeVideoLinkIds: [link.id],
  });
  const cachedDiagnosis = findCachedAiDiagnosis(latestAiDiagnoses, inputHash);

  if (cachedDiagnosis) {
    return { diagnosis: toApiDiagnosis(cachedDiagnosis) };
  }

  try {
    const ai = await diagnoseYoutubeVideo({ diagnosisInput });
    const row = await upsertYoutubeVideoDiagnosis(db, {
      youtubeVideoLinkId: link.id,
      snapshotId: snapshot.id,
      diagnosisType: "ai",
      model: ai.model,
      reasoningEffort: ai.reasoningEffort,
      inputHash,
      summaryTh: ai.diagnosis.summaryTh,
      suggestionsEn: ai.diagnosis,
      rawOutput: {
        diagnosis: ai.diagnosis,
        responseId: ai.responseId,
        status: ai.status,
      },
    });

    return { diagnosis: toApiDiagnosis(row) };
  } catch (error) {
    throw toYoutubeAiDiagnosisError(error);
  }
}

export function createYoutubeAnalyticsRouteServices() {
  return {
    getDashboard: loadDashboard,
    refreshDashboard: refreshYoutubeAnalyticsDashboard,
    analyzeVideo: analyzeYoutubeVideoWithAi,
  };
}
