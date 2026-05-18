# Final Render Preview Design

## Summary

Add a final render preview to the project workflow after a render succeeds. The Render panel should show the produced MP4 in an inline video player and provide a local-only action to reveal the rendered file in Finder.

## Scope

- Show a video preview only when the latest render has `status === "succeeded"` and its `outputAssetId` resolves to a ready local render asset.
- Keep the existing output path display, but place it under the preview so it remains useful for manual copy/debugging.
- Add an `Open folder` button that asks the local API to reveal the render output file in Finder.
- Keep the action local-only and restricted to render assets. Scene image/audio assets keep their existing preview behavior.

## Architecture

The web app already previews local assets through `GET /assets/:assetId/file`. The final render preview should reuse that route for the video element.

Browsers cannot safely open arbitrary local folders from a web page, so `Open folder` needs a local API endpoint. The API will add `POST /assets/:assetId/reveal`, resolve the asset path against `LOCAL_ASSET_ROOT`, verify the asset is a ready local render, and run macOS `open -R <absolute-file-path>`.

## Error Handling

- If the asset is missing, stale, non-local, not ready, or not a render asset, the API returns `404`.
- If the platform does not support reveal, the API returns `409 asset_reveal_unsupported_platform`.
- If Finder reveal fails, the API returns `404` so the UI can show a concise failure message.
- The UI keeps the preview visible even if the folder reveal action fails.

## Testing

- API route test covers successful render asset reveal without invoking the real OS command by injecting the route service.
- API route test covers rejecting non-render assets.
- Web helper test covers the reveal endpoint URL.
- Existing typechecks for `apps/api` and `apps/web` must pass.
