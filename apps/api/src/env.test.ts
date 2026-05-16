import { describe, expect, test } from "bun:test";

import { parseEnv } from "./env";

describe("parseEnv", () => {
  test("requires runtime database and asset root while defaulting host and port", () => {
    expect(
      parseEnv({
        DATABASE_URL: "postgres://user:pass@example.com:5432/app",
        LOCAL_ASSET_ROOT: "/tmp/short-workflow-assets",
      }),
    ).toEqual({
      DATABASE_URL: "postgres://user:pass@example.com:5432/app",
      LOCAL_ASSET_ROOT: "/tmp/short-workflow-assets",
      API_HOST: "127.0.0.1",
      API_PORT: 3001,
    });
  });

  test("coerces API_PORT when provided", () => {
    expect(
      parseEnv({
        DATABASE_URL: "postgres://user:pass@example.com:5432/app",
        LOCAL_ASSET_ROOT: "/tmp/short-workflow-assets",
        API_PORT: "3010",
      }).API_PORT,
    ).toBe(3010);
  });

  test("ignores unrelated process environment keys", () => {
    expect(
      parseEnv({
        DATABASE_URL: "postgres://user:pass@example.com:5432/app",
        LOCAL_ASSET_ROOT: "/tmp/short-workflow-assets",
        PATH: "/usr/bin",
      }).API_HOST,
    ).toBe("127.0.0.1");
  });
});
