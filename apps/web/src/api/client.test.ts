import { describe, expect, test } from "bun:test";

import { ApiError, apiFetch } from "./client";

describe("apiFetch", () => {
  test("sends JSON requests and parses JSON responses", async () => {
    const originalFetch = globalThis.fetch;
    const requests: Request[] = [];

    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      requests.push(request);

      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          headers: { "content-type": "application/json" },
          status: 200,
        }),
      );
    }) as typeof fetch;

    try {
      const result = await apiFetch<{ ok: boolean }>("/projects", {
        body: JSON.stringify({ title: "Demo" }),
        method: "POST",
      });

      expect(result).toEqual({ ok: true });
      expect(requests).toHaveLength(1);
      expect(requests[0]?.url).toBe("http://localhost:3001/projects");
      expect(requests[0]?.headers.get("content-type")).toBe("application/json");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("throws ApiError with status and payload for failed JSON responses", async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: "not_found" }), {
          headers: { "content-type": "application/json" },
          status: 404,
        }),
      )) as unknown as typeof fetch;

    try {
      await expect(apiFetch("/missing")).rejects.toMatchObject({
        payload: { error: "not_found" },
        status: 404,
      });

      await expect(apiFetch("/missing")).rejects.toBeInstanceOf(ApiError);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
