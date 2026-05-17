export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  readonly payload: unknown;
  readonly status: number;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.payload = payload;
    this.status = status;
  }
}

function buildUrl(path: string) {
  return new URL(path, API_BASE_URL).toString();
}

function hasRequestBody(init?: RequestInit) {
  return init?.body !== undefined && init.body !== null;
}

async function parseResponseBody(response: Response) {
  if (response.status === 204) {
    return undefined;
  }

  const text = await response.text();

  if (text.length === 0) {
    return undefined;
  }

  const contentType = response.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    return JSON.parse(text) as unknown;
  }

  return text;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);

  if (hasRequestBody(init) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(buildUrl(path), {
    ...init,
    headers,
  });
  const payload = await parseResponseBody(response);

  if (!response.ok) {
    throw new ApiError(response.statusText, response.status, payload);
  }

  return payload as T;
}
