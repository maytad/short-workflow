import { expect, test } from "bun:test";

test("loads the config package placeholder", async () => {
  await expect(import("./index")).resolves.toBeDefined();
});
