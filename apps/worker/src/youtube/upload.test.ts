import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "bun:test";

import { refreshYoutubeToken, writeYoutubeToken } from "./tokenStore";
import { uploadPrivateYoutubeVideo } from "./upload";

describe("refreshYoutubeToken", () => {
  test("preserves the refresh token and computes a new expiry", async () => {
    const requests: Request[] = [];
    const refreshed = await refreshYoutubeToken({
      env: {
        YOUTUBE_OAUTH_CLIENT_ID: "client-id",
        YOUTUBE_OAUTH_CLIENT_SECRET: "client-secret",
      },
      token: {
        access_token: "old-access-token",
        refresh_token: "stable-refresh-token",
        token_type: "Bearer",
        scope: "https://www.googleapis.com/auth/youtube.upload",
        expires_at: "2026-05-17T00:00:00.000Z",
        extra_provider_field: "kept",
      },
      fetchFn: async (url, init) => {
        requests.push(new Request(url, init));
        return Response.json({
          access_token: "new-access-token",
          token_type: "Bearer",
          expires_in: 120,
          scope: "https://www.googleapis.com/auth/youtube.upload",
        });
      },
      now: Date.parse("2026-05-18T12:00:00.000Z"),
    });

    expect(refreshed).toMatchObject({
      access_token: "new-access-token",
      refresh_token: "stable-refresh-token",
      token_type: "Bearer",
      scope: "https://www.googleapis.com/auth/youtube.upload",
      expires_at: "2026-05-18T12:02:00.000Z",
      extra_provider_field: "kept",
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://oauth2.googleapis.com/token");
    expect(requests[0]?.method).toBe("POST");

    const body = await requests[0]?.text();
    expect(body).toBe(
      "client_id=client-id&grant_type=refresh_token&refresh_token=stable-refresh-token&client_secret=client-secret",
    );
  });

  test("writes token file with private permissions", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "youtube-token-"));

    try {
      await writeYoutubeToken(root, {
        access_token: "access-token",
        refresh_token: "refresh-token",
        token_type: "Bearer",
        expires_at: "2026-05-18T12:00:00.000Z",
      });

      const tokenPath = path.join(root, "youtube", "oauth-token.json");
      const tokenFile = await stat(tokenPath);
      const tokenDir = await stat(path.dirname(tokenPath));
      const raw = await readFile(tokenPath, "utf8");

      expect(tokenDir.mode & 0o777).toBe(0o700);
      expect(tokenFile.mode & 0o777).toBe(0o600);
      expect(JSON.parse(raw)).toMatchObject({
        access_token: "access-token",
        refresh_token: "refresh-token",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("uploadPrivateYoutubeVideo", () => {
  test("starts a private resumable upload and puts the MP4 bytes", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "youtube-upload-"));
    const filePath = path.join(root, "video.mp4");
    await writeFile(filePath, new Uint8Array([0, 1, 2, 3]));

    const requests: Request[] = [];

    try {
      const output = await uploadPrivateYoutubeVideo({
        accessToken: "access-token",
        filePath,
        upload: {
          renderId: "123e4567-e89b-12d3-a456-426614174000",
          outputAssetId: "123e4567-e89b-12d3-a456-426614174001",
          title: "Private upload",
          description: "A short description",
          tags: ["shorts", "ai"],
          privacyStatus: "private",
          selfDeclaredMadeForKids: false,
          containsSyntheticMedia: true,
        },
        fetchFn: async (url, init) => {
          const request = new Request(url, init);
          requests.push(request);

          if (requests.length === 1) {
            return new Response(null, {
              status: 200,
              headers: { location: "https://upload.youtube.test/session" },
            });
          }

          return Response.json({ id: "yt-video-123" });
        },
      });

      expect(output).toMatchObject({
        youtubeVideoId: "yt-video-123",
        youtubeStudioUrl: "https://studio.youtube.com/video/yt-video-123/edit",
        privacyStatus: "private",
      });
      expect(Date.parse(output.uploadedAt)).not.toBeNaN();

      expect(requests).toHaveLength(2);

      const startRequest = requests[0];
      expect(startRequest?.url).toBe(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers=false",
      );
      expect(startRequest?.method).toBe("POST");
      expect(startRequest?.headers.get("authorization")).toBe("Bearer access-token");
      expect(startRequest?.headers.get("content-type")).toBe("application/json");
      expect(startRequest?.headers.get("x-upload-content-length")).toBe("4");
      expect(startRequest?.headers.get("x-upload-content-type")).toBe("video/mp4");
      expect(await startRequest?.json()).toEqual({
        snippet: {
          title: "Private upload",
          description: "A short description",
          tags: ["shorts", "ai"],
        },
        status: {
          privacyStatus: "private",
          selfDeclaredMadeForKids: false,
          containsSyntheticMedia: true,
        },
      });

      const uploadRequest = requests[1];
      expect(uploadRequest?.url).toBe("https://upload.youtube.test/session");
      expect(uploadRequest?.method).toBe("PUT");
      expect(uploadRequest?.headers.get("authorization")).toBe("Bearer access-token");
      expect(uploadRequest?.headers.get("content-length")).toBe("4");
      expect(uploadRequest?.headers.get("content-type")).toBe("video/mp4");
      expect(new Uint8Array(await uploadRequest!.arrayBuffer())).toEqual(
        new Uint8Array([0, 1, 2, 3]),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("normalizes YouTube session errors", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "youtube-upload-error-"));
    const filePath = path.join(root, "video.mp4");
    await writeFile(filePath, new Uint8Array([0]));

    try {
      await expect(
        uploadPrivateYoutubeVideo({
          accessToken: "access-token",
          filePath,
          upload: {
            renderId: "123e4567-e89b-12d3-a456-426614174000",
            outputAssetId: "123e4567-e89b-12d3-a456-426614174001",
            title: "Private upload",
            description: "A short description",
            tags: ["shorts"],
            privacyStatus: "private",
            selfDeclaredMadeForKids: false,
            containsSyntheticMedia: true,
          },
          fetchFn: async () =>
            Response.json(
              {
                error: {
                  message: "Quota exceeded",
                  errors: [{ reason: "quotaExceeded", message: "Quota exceeded" }],
                },
              },
              { status: 403 },
            ),
        }),
      ).rejects.toThrow("youtube_api_error:403:quotaExceeded: Quota exceeded");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("marks rejected uploads with youtube_upload_rejected", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "youtube-upload-rejected-"));
    const filePath = path.join(root, "video.mp4");
    await writeFile(filePath, new Uint8Array([0]));

    try {
      await expect(
        uploadPrivateYoutubeVideo({
          accessToken: "access-token",
          filePath,
          upload: {
            renderId: "123e4567-e89b-12d3-a456-426614174000",
            outputAssetId: "123e4567-e89b-12d3-a456-426614174001",
            title: "Private upload",
            description: "A short description",
            tags: ["shorts"],
            privacyStatus: "private",
            selfDeclaredMadeForKids: false,
            containsSyntheticMedia: true,
          },
          fetchFn: async (_url, init) => {
            if (init?.method === "POST") {
              return new Response(null, {
                status: 200,
                headers: { location: "https://upload.youtube.test/session" },
              });
            }

            return Response.json(
              {
                error: {
                  message: "Rejected by policy",
                  errors: [{ reason: "uploadRejected", message: "Rejected by policy" }],
                },
              },
              { status: 400 },
            );
          },
        }),
      ).rejects.toThrow("youtube_upload_rejected:400:uploadRejected: Rejected by policy");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
