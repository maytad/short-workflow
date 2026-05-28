export type WorkerLogEvent =
  | "worker_starting"
  | "worker_loop_started"
  | "stale_jobs_recovered"
  | "stale_jobs_recovery_failed"
  | "job_claimed"
  | "job_heartbeat_failed"
  | "job_succeeded"
  | "job_retry_scheduled"
  | "job_failed";

export type WorkerLogFields = Record<string, boolean | number | string | null | undefined>;

export function formatWorkerLog(
  event: WorkerLogEvent,
  fields: WorkerLogFields = {},
  now = new Date(),
) {
  return JSON.stringify({
    timestamp: now.toISOString(),
    component: "worker",
    event,
    ...fields,
  });
}

export function logWorkerInfo(event: WorkerLogEvent, fields?: WorkerLogFields) {
  console.info(formatWorkerLog(event, fields));
}

export function logWorkerError(event: WorkerLogEvent, fields?: WorkerLogFields) {
  console.error(formatWorkerLog(event, fields));
}
