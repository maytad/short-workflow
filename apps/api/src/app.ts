import cors from "@elysiajs/cors";
import {
  createDbClient,
  type DbClient,
} from "@short-workflow/db";
import { Elysia } from "elysia";

import { internalError, notFound } from "./http";
import { healthRoutes } from "./routes/health";
import {
  createProjectRoutes,
  type ProjectRouteServices,
} from "./routes/projects";

type CreateAppOptions = {
  db?: DbClient;
  databaseUrl?: string;
  projectServices?: ProjectRouteServices;
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
    .use(createProjectRoutes(options.projectServices))
    .onError(({ code, set }) => {
      if (code === "NOT_FOUND") {
        return notFound(set);
      }

      return internalError(set);
    });
}

export type App = ReturnType<typeof createApp>;
