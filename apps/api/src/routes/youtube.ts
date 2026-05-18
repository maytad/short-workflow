import { Elysia } from "elysia";

import { conflict, internalError, jsonError } from "../http";
import {
  createYoutubeAuthServices,
  type YoutubeAuthServices,
  type YoutubeOAuthCallbackInput,
} from "../services/youtubeAuth";

type StatusSetter = {
  status?: number | string;
};

type YoutubeRouteContext = {
  set: StatusSetter;
  query: {
    code?: string;
    state?: string;
    error?: string;
  };
};

function withYoutubeRouteContext(context: unknown) {
  return context as YoutubeRouteContext;
}

export function createYoutubeRoutes(services?: YoutubeAuthServices) {
  const youtubeServices = () => services ?? createYoutubeAuthServices();

  return new Elysia({ prefix: "/youtube" })
    .get("/auth/status", () => youtubeServices().getYoutubeAuthStatus())
    .post("/auth/start", async ({ set }) => {
      try {
        return await youtubeServices().createYoutubeAuthUrl();
      } catch (error) {
        if (error instanceof Error && error.message === "youtube_oauth_not_configured") {
          return conflict(set, "youtube_oauth_not_configured");
        }

        throw error;
      }
    })
    .post("/auth/disconnect", () => youtubeServices().disconnectYoutube())
    .get("/oauth/callback", async (context) => {
      const { query, set } = withYoutubeRouteContext(context);

      if (query.error) {
        return jsonError(set, 400, "youtube_oauth_callback_failed");
      }

      try {
        const input: YoutubeOAuthCallbackInput = {};

        if (query.code !== undefined) {
          input.code = query.code;
        }

        if (query.state !== undefined) {
          input.state = query.state;
        }

        await youtubeServices().handleYoutubeOAuthCallback(input);

        return new Response(
          "<!doctype html><title>YouTube connected</title><p>YouTube is connected. Return to Short Workflow.</p>",
          { headers: { "content-type": "text/html; charset=utf-8" } },
        );
      } catch {
        return jsonError(set, 400, "youtube_oauth_callback_failed");
      }
    })
    .onError(({ set }) => internalError(set));
}
