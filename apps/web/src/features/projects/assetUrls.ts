import type { Asset } from "@short-workflow/shared";

import { API_BASE_URL } from "../../api/client";

type AssetRef = Pick<Asset, "id">;

export function assetPreviewUrl(asset: AssetRef) {
  return new URL(`/assets/${asset.id}/file`, API_BASE_URL).toString();
}

export function assetRevealUrl(asset: AssetRef) {
  return new URL(`/assets/${asset.id}/reveal`, API_BASE_URL).toString();
}

export function youtubeStudioUrl(videoId: string) {
  return `https://studio.youtube.com/video/${encodeURIComponent(videoId)}/edit`;
}
