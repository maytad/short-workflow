import { parseEnv } from "../env";

export type HandlerEnv = Pick<ReturnType<typeof parseEnv>, "LOCAL_ASSET_ROOT">;

export function resolveHandlerEnv(env?: HandlerEnv): HandlerEnv {
  return env ?? parseEnv();
}
