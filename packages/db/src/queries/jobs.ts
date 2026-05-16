import type { JobRow } from "../schema";

export type { JobRow };

export function retryDelaySeconds(attempts: number) {
  return Math.min(300, 30 * 2 ** Math.max(0, attempts - 1));
}
