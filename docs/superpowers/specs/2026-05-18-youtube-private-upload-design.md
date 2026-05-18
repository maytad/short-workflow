# YouTube Private Upload Design

## Summary

Add a local-only `Upload to YouTube` button for finished renders. The feature uploads the latest successful local MP4 to the authenticated user's YouTube channel through the YouTube Data API and always creates the video as `private`.

This is an explicit scope expansion beyond the original MVP non-goal of no YouTube upload automation. It stays conservative: single-user, localhost-only, private-only, no publishing controls, no cloud asset storage, and no frontend access to OAuth tokens.

## User Decision

- Upload mode: direct YouTube API upload.
- Privacy: always `private`.
- OAuth token storage: local file under `LOCAL_ASSET_ROOT`.
- UX: confirmation modal before queueing upload.
- Architecture: API queues an `upload_youtube` job; worker performs the upload.

## Source Constraints

- YouTube's `videos.insert` endpoint uploads a video and accepts metadata. Official docs list `POST https://www.googleapis.com/upload/youtube/v3/videos`, `part=snippet,status`, and the `https://www.googleapis.com/auth/youtube.upload` scope.
- The official docs state `videos.insert` has quota cost 100 units and that uploads from unverified API projects created after July 28, 2020 are restricted to private viewing.
- YouTube supports resumable uploads by starting a session with `uploadType=resumable`, then uploading file bytes to the returned session URL.
- Google's installed app OAuth flow uses a system browser, local redirect URI, authorization code exchange, and refresh-token storage.

References:

- https://developers.google.com/youtube/v3/docs/videos/insert
- https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
- https://developers.google.com/youtube/v3/guides/auth/installed-apps

## Goals

- Let the user upload the final rendered MP4 from the project screen.
- Keep the video private on YouTube every time.
- Use generated YouTube metadata as the default upload metadata.
- Keep OAuth credentials and tokens out of the frontend and out of git.
- Fit the existing job polling model so uploads do not block the API request.
- Show a clear upload result with a YouTube Studio edit link after success.

## Non-Goals

- No public or unlisted publishing.
- No scheduling.
- No thumbnail upload in the first version.
- No playlist/category selector in the first version.
- No multi-account/channel switching.
- No upload progress percentage unless the existing job model is extended later.
- No YouTube analytics, comments, or post-upload optimization.
- No browser automation of YouTube Studio.

## UX Design

The `RenderPanel` gains a secondary `Upload to YouTube` button when these conditions are true:

- Latest render status is `succeeded`.
- Latest render has a ready local `render` output asset.
- Project has generated YouTube metadata.
- No active `upload_youtube` job exists for the project.

Clicking the button opens a confirmation modal. The modal shows:

- Final MP4 path and existing preview.
- Upload title from `youtubeMetadata.youtubeTitle`.
- Description from `youtubeMetadata.description`.
- Hashtags from `youtubeMetadata.hashtags`.
- Privacy: `Private`, fixed and not editable.
- Disclosure summary: generated video; default `containsSyntheticMedia` is enabled.
- Audience: `Not made for kids`, fixed for the Tiny Mechanisms MVP.

If YouTube is not connected, the primary modal action is `Connect YouTube`. It calls the API auth-start endpoint, receives an auth URL, and opens it in a new browser tab. The Google callback returns to the local API and stores the token file. The modal can then refresh auth status and show `Confirm private upload`.

If YouTube is connected, `Confirm private upload` calls the upload endpoint. The endpoint returns the queued job, and the existing active jobs panel shows `upload youtube` as pending or processing.

After success, the render/upload area shows:

- `Uploaded privately to YouTube`.
- YouTube video id.
- `Open in YouTube Studio` linking to `https://studio.youtube.com/video/{videoId}/edit`.

## API Design

Add YouTube auth endpoints:

- `GET /youtube/auth/status`
  - Returns `{ connected: boolean }`.
  - Does not return tokens.
- `POST /youtube/auth/start`
  - Returns `{ authUrl: string }`.
  - Creates an OAuth state and PKCE verifier with a short TTL.
- `GET /youtube/oauth/callback`
  - Handles Google redirect.
  - Exchanges code for tokens.
  - Stores token file under `LOCAL_ASSET_ROOT/youtube/oauth-token.json`.
  - Returns a small success HTML page instructing the user to return to Short Workflow.
- `POST /youtube/auth/disconnect`
  - Deletes the local token file.
  - Included in the first version for wrong-account recovery.

Add upload endpoint:

- `POST /projects/:projectId/youtube-upload`
  - Validates latest successful render and ready local render asset.
  - Validates generated YouTube metadata exists.
  - Validates YouTube auth token exists.
  - Creates one project-level `upload_youtube` job with `sceneId = null`.
  - Returns the existing active job if an upload is already pending or processing.

Upload job input:

```json
{
  "renderId": "uuid",
  "outputAssetId": "uuid",
  "title": "string",
  "description": "string",
  "tags": ["string"],
  "privacyStatus": "private",
  "selfDeclaredMadeForKids": false,
  "containsSyntheticMedia": true
}
```

Upload job output:

```json
{
  "youtubeVideoId": "string",
  "youtubeStudioUrl": "https://studio.youtube.com/video/{id}/edit",
  "privacyStatus": "private",
  "uploadedAt": "iso-date"
}
```

Project detail will expose a derived nullable `youtubeUpload` summary from the latest `upload_youtube` job output so the UI does not need to inspect arbitrary job JSON.

## Data Model

No new upload table is needed for the first version. Store upload attempt state in `jobs`:

- Add `upload_youtube` to `JOB_TYPES` in `packages/shared`.
- Add `upload_youtube` to `job_type` enum in `packages/db`.
- Update `jobs_scene_id_per_type` so `upload_youtube` requires `scene_id is null`.
- Existing `jobs_one_active_project_job` prevents concurrent project-level uploads of the same type.

A migration is required because Postgres enum values and the check constraint change. The migration must include a reviewed `down.sql`.

OAuth tokens are not database records. They live only on disk:

```text
{LOCAL_ASSET_ROOT}/youtube/oauth-token.json
```

The token directory should be created with restrictive permissions where the platform supports it. The token file should store refresh token, access token, expiry, scope, and token type. It must never be served by the API, committed, or copied into job output.

## Worker Design

Add `handleUploadYoutube` to `apps/worker`.

The handler:

1. Reads and validates job input.
2. Loads latest token from the local token store.
3. Refreshes the access token if expired.
4. Resolves the render output asset path under `LOCAL_ASSET_ROOT`.
5. Starts a YouTube resumable upload session:
   - `uploadType=resumable`
   - `part=snippet,status`
   - `notifySubscribers=false`
   - body includes `snippet` and `status`
6. Uploads the MP4 bytes to the session URL.
7. Marks the job succeeded with YouTube video id and Studio URL.

The first implementation should set `maxAttempts: 1` for `upload_youtube` jobs. The handler can retry transient chunk requests inside one attempt, but automatic job-level retry risks duplicate uploads if the first attempt reaches YouTube but fails before persisting the response. Manual retry from the UI can come later after the user checks YouTube Studio.

## YouTube Request Shape

The upload request uses the minimum scope:

```text
https://www.googleapis.com/auth/youtube.upload
```

The video resource should include:

```json
{
  "snippet": {
    "title": "Generated title",
    "description": "Generated description",
    "tags": ["tag"]
  },
  "status": {
    "privacyStatus": "private",
    "selfDeclaredMadeForKids": false,
    "containsSyntheticMedia": true
  }
}
```

`status.privacyStatus` must always be `private`; the frontend should not render a privacy selector in this version.

## Environment

Server-side environment only:

- `YOUTUBE_OAUTH_CLIENT_ID`
- `YOUTUBE_OAUTH_CLIENT_SECRET` if the chosen Google OAuth client requires one
- `YOUTUBE_OAUTH_REDIRECT_URI`, default `http://127.0.0.1:3001/youtube/oauth/callback`

These variables belong to `apps/api` and `apps/worker`. They must not be exposed through Vite or imported by `apps/web`.

## Error Handling

API errors:

- Missing render: `422 youtube_upload_preconditions_failed`.
- Missing metadata: `422 youtube_upload_preconditions_failed`.
- Missing token: `409 youtube_not_connected`.
- Active upload exists: return the existing active job.
- OAuth setup missing env: `409 youtube_oauth_not_configured`.

Worker errors:

- Token refresh failure: fail job with `youtube_token_refresh_failed`.
- Local file missing: fail job with `youtube_render_asset_missing`.
- Quota/API failure: fail job with normalized YouTube error message.
- Upload rejected by YouTube: fail job with `youtube_upload_rejected`.

The UI should show actionable copy near the upload button and keep the final MP4 preview available even when upload fails.

## Security

- Frontend never receives access tokens, refresh tokens, client secrets, or token file paths.
- OAuth uses a random `state`; PKCE should be used for the authorization code flow.
- Token file is local machine state, not portable project data.
- Disconnect deletes the token file but does not delete uploaded videos.
- Upload metadata comes from generated metadata and local confirmation only; no arbitrary user-provided HTML is rendered.

## Testing And Verification

Light verification for the first implementation:

- Shared schema/typecheck after adding `upload_youtube`.
- DB migration check and rollback check.
- API tests for auth status, missing auth, missing render, and queued upload job.
- Worker unit tests for token refresh and upload request construction using mocked `fetch`.
- Web tests for modal state, upload button gating, and URL builders.
- Manual local verification with a private upload to a test YouTube channel.

Do not require a public upload test.

## Open Implementation Notes

- Prefer direct `fetch` implementation over adding `googleapis` unless the implementation plan explicitly asks for a new dependency and the user approves it.
- Keep upload progress coarse in the first version: pending, processing, succeeded, failed.
- The base MVP spec still says YouTube upload automation is out of scope. This feature spec supersedes that only for private uploads after explicit user approval.
