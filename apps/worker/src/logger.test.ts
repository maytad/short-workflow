import { expect, test } from "bun:test";

import { formatWorkerLog } from "./logger";

test("formatWorkerLog emits structured worker log JSON", () => {
  const log = JSON.parse(
    formatWorkerLog(
      "job_claimed",
      {
        workerIndex: 0,
        jobId: "job-1",
        type: "generate_script",
        attempts: 1,
        maxAttempts: 5,
      },
      new Date("2026-05-17T14:00:00.000Z"),
    ),
  );

  expect(log).toEqual({
    timestamp: "2026-05-17T14:00:00.000Z",
    component: "worker",
    event: "job_claimed",
    workerIndex: 0,
    jobId: "job-1",
    type: "generate_script",
    attempts: 1,
    maxAttempts: 5,
  });
});
