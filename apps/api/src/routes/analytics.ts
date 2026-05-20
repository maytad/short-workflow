import {
  youtubeAiDiagnosisRequestSchema,
  youtubeAnalyticsRefreshRequestSchema,
  type YoutubeAiDiagnosisResponse,
  type YoutubeAnalyticsDashboardResponse,
} from "@short-workflow/shared";
import type { DbClient } from "@short-workflow/db";
import { Elysia } from "elysia";

import { conflict, internalError, jsonError, validationFailed } from "../http";

type StatusSetter = {
  status?: number | string;
};

type AnalyticsRouteContext = {
  body: unknown;
  db: DbClient;
  params: {
    youtubeVideoId?: string;
  };
  query: {
    windowDays?: string;
  };
  set: StatusSetter;
};

type AnalyticsWindowInput = {
  windowDays: number;
};

type AnalyzeVideoInput = {
  youtubeVideoId: string;
};

export type AnalyticsRouteServices = {
  getDashboard: (
    db: DbClient,
    input: AnalyticsWindowInput,
  ) => Promise<YoutubeAnalyticsDashboardResponse>;
  refreshDashboard: (
    db: DbClient,
    input: AnalyticsWindowInput,
  ) => Promise<YoutubeAnalyticsDashboardResponse>;
  analyzeVideo: (
    db: DbClient,
    input: AnalyzeVideoInput,
  ) => Promise<YoutubeAiDiagnosisResponse>;
};

function servicesUnavailable(): never {
  throw new Error("analytics_services_not_configured");
}

const unavailableServices: AnalyticsRouteServices = {
  getDashboard: async () => servicesUnavailable(),
  refreshDashboard: async () => servicesUnavailable(),
  analyzeVideo: async () => servicesUnavailable(),
};

function withAnalyticsRouteContext(context: unknown) {
  return context as AnalyticsRouteContext;
}

function queryInput(query: AnalyticsRouteContext["query"]) {
  if (query.windowDays === undefined) {
    return {};
  }

  return {
    windowDays: Number(query.windowDays),
  };
}

function mapAnalyticsError(set: StatusSetter, error: unknown) {
  if (!(error instanceof Error)) {
    throw error;
  }

  if (error.message === "youtube_not_connected" || error.message === "youtube_reconnect_required") {
    return conflict(set, error.message);
  }

  if (error.message === "youtube_video_not_found") {
    return jsonError(set, 404, "youtube_video_not_found");
  }

  if (error.message === "youtube_analytics_snapshot_missing") {
    return jsonError(set, 422, "youtube_analytics_snapshot_missing");
  }

  if (
    error.message.startsWith("youtube_analytics_fetch_failed") ||
    error.message === "youtube_ai_diagnosis_failed"
  ) {
    return jsonError(set, 502, error.message);
  }

  return internalError(set);
}

export function createAnalyticsRoutes(services: AnalyticsRouteServices = unavailableServices) {
  return new Elysia({ prefix: "/analytics" })
    .get("/youtube", async (context) => {
      const { db, query, set } = withAnalyticsRouteContext(context);
      const result = youtubeAnalyticsRefreshRequestSchema.safeParse(queryInput(query));

      if (!result.success) {
        return validationFailed(set, result.error);
      }

      try {
        return await services.getDashboard(db, result.data);
      } catch (error) {
        return mapAnalyticsError(set, error);
      }
    })
    .post("/youtube/refresh", async (context) => {
      const { body, db, set } = withAnalyticsRouteContext(context);
      const result = youtubeAnalyticsRefreshRequestSchema.safeParse(body ?? {});

      if (!result.success) {
        return validationFailed(set, result.error);
      }

      try {
        return await services.refreshDashboard(db, result.data);
      } catch (error) {
        return mapAnalyticsError(set, error);
      }
    })
    .post("/youtube/videos/:youtubeVideoId/analyze", async (context) => {
      const { db, params, set } = withAnalyticsRouteContext(context);
      const result = youtubeAiDiagnosisRequestSchema.safeParse({
        youtubeVideoId: params.youtubeVideoId,
      });

      if (!result.success) {
        return validationFailed(set, result.error);
      }

      try {
        return await services.analyzeVideo(db, result.data);
      } catch (error) {
        return mapAnalyticsError(set, error);
      }
    })
    .onError(({ set }) => internalError(set));
}
