import cors from "@elysiajs/cors";
import { createDbClient, type DbClient } from "@short-workflow/db";
import { Elysia } from "elysia";

import { internalError, notFound } from "./http";
import { createAnalyticsRoutes, type AnalyticsRouteServices } from "./routes/analytics";
import { healthRoutes } from "./routes/health";
import { createProjectRoutes, type ProjectRouteServices } from "./routes/projects";
import { createYoutubeRoutes } from "./routes/youtube";
import { createYoutubeAnalyticsRouteServices } from "./services/youtubeAnalytics";
import type { YoutubeAuthServices } from "./services/youtubeAuth";

type CreateAppOptions = {
  db?: DbClient;
  databaseUrl?: string;
  analyticsServices?: AnalyticsRouteServices;
  projectServices?: ProjectRouteServices;
  youtubeServices?: YoutubeAuthServices;
};

export function createApp(options: CreateAppOptions = {}) {
  const client = options.db ? null : createDbClient(options.databaseUrl);
  const db = options.db ?? client?.db;

  if (!db) {
    throw new Error("db_client_missing");
  }

  return new Elysia()
    .decorate("db", db)
    .use(cors({ origin: ["http://localhost:5173", "http://127.0.0.1:5173"] }))
    .use(healthRoutes)
    .use(createYoutubeRoutes(options.youtubeServices))
    .use(createAnalyticsRoutes(options.analyticsServices ?? createYoutubeAnalyticsRouteServices()))
    .use(createProjectRoutes(options.projectServices))
    .onError(({ code, set }) => {
      if (code === "NOT_FOUND") {
        return notFound(set);
      }

      return internalError(set);
    });
}

export type App = ReturnType<typeof createApp>;
