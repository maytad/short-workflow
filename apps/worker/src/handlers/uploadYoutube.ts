import { getAsset, markJobSucceeded, type DbClient, type JobRow } from "@short-workflow/db";
import { youtubeUploadJobInputSchema } from "@short-workflow/shared";

import { absoluteAssetPath } from "../assets";
import { parseEnv, type WorkerEnv } from "../env";
import {
  isExpired,
  readYoutubeToken,
  refreshYoutubeToken,
  writeYoutubeToken,
  type FetchFn,
} from "../youtube/tokenStore";
import { uploadPrivateYoutubeVideo } from "../youtube/upload";

type UploadYoutubeEnv = Pick<
  WorkerEnv,
  "LOCAL_ASSET_ROOT" | "YOUTUBE_OAUTH_CLIENT_ID" | "YOUTUBE_OAUTH_CLIENT_SECRET"
>;

export async function handleUploadYoutube(
  db: DbClient,
  job: JobRow,
  env: UploadYoutubeEnv = parseEnv(),
  fetchFn: FetchFn = fetch,
) {
  const uploadInput = youtubeUploadJobInputSchema.parse(job.input);
  const asset = await getAsset(db, uploadInput.outputAssetId);

  if (
    !asset ||
    asset.projectId !== job.projectId ||
    asset.kind !== "render" ||
    asset.status !== "ready" ||
    asset.storageDriver !== "local"
  ) {
    throw new Error("youtube_render_asset_missing");
  }

  let token = await readYoutubeToken(env.LOCAL_ASSET_ROOT);

  if (isExpired(token)) {
    token = await refreshYoutubeToken({ env, token, fetchFn });
    await writeYoutubeToken(env.LOCAL_ASSET_ROOT, token);
  }

  const output = await uploadPrivateYoutubeVideo({
    accessToken: token.access_token,
    filePath: absoluteAssetPath(env.LOCAL_ASSET_ROOT, asset.path),
    upload: uploadInput,
    fetchFn,
  });

  await markJobSucceeded(db, job.id, output);
}
