# YouTube Analytics Dashboard Design

## Summary

Add a YouTube analytics dashboard to Short Workflow so the user can measure recent Shorts performance, distinguish DB-linked uploads from videos published outside the app, and request on-demand AI diagnosis for a selected video.

The first version is API-based. It does not import YouTube Studio CSV files, does not run scheduled sync jobs, and does not automatically rewrite prompts or reorder seeds. It gives the user a measured feedback loop before changing the creative system.

## Goals

- Add a new `/analytics` UI page for recent YouTube Shorts performance.
- Refresh recent analytics manually from the UI, defaulting to the last 30 days.
- Store linked and unlinked YouTube videos in the database.
- Store per-refresh analytics snapshots.
- Generate automatic rule-based diagnosis from stored metrics.
- Let the user request AI-assisted diagnosis for a selected video using the existing OpenAI configuration and `OPENAI_MODEL`, currently `gpt-5.5`.
- Use reasoning effort `xhigh` for `gpt-5.5` AI diagnosis requests.
- Return AI diagnosis as a Thai summary plus English title, hook, metadata, and prompt suggestions.
- Keep all YouTube and OpenAI secrets server-side.
- Document CSV import as future work for Shorts feed metrics not available through the APIs.

## Non-Goals

- No YouTube Studio CSV import in this version.
- No automatic scheduled analytics sync.
- No worker job for analytics refresh in the first version.
- No batch AI diagnosis.
- No automatic prompt changes, seed-order changes, or re-rendering based on diagnosis.
- No new publish automation.
- No frontend calls directly to YouTube, YouTube Analytics, OpenAI, Supabase, or `packages/db`.

## Context

The app already uploads YouTube videos through `upload_youtube` jobs and stores scheduled public upload state in `youtube_upload_schedules`. The database can identify videos uploaded through the app, but it does not currently store YouTube performance metrics.

Manual investigation showed that some videos visible in YouTube Studio were not linked to an `upload_youtube` job in the database. The analytics dashboard must therefore account for both:

- videos linked to Short Workflow projects and upload jobs;
- recent channel videos discovered from YouTube that are not linked to a local project.

The existing OAuth token only has upload permission. Read APIs require new scopes and the user must reconnect YouTube after the code changes.

## Research Notes

YouTube's public guidance for Shorts emphasizes metrics such as how many viewers chose to view, average view duration, and average percentage viewed. Studio exposes Shorts-specific analytics such as feed exposure and viewed-versus-swiped behavior, but those exact metrics may not be fully available through the public APIs.

References:

- YouTube Search and Discovery tips for Shorts: https://support.google.com/youtube/answer/11914225?co=YOUTUBE._YTVideoType%3Dshorts&hl=en
- YouTube Shorts Analytics help: https://support.google.com/youtube/answer/12942217?co=YOUTUBE._YTVideoType%3Dshorts&hl=en
- YouTube Shorts view counting and engaged views: https://support.google.com/youtube/answer/10059070
- YouTube Data API OAuth scopes: https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps
- YouTube Analytics API reference: https://developers.google.com/youtube/analytics/reference
- YouTube Analytics API metrics: https://developers.google.com/youtube/analytics/metrics

## Selected Approach

Use an API-based dashboard with manual refresh, linked and unlinked video rows, automatic rule-based diagnosis, and on-demand AI diagnosis.

This approach gives the user useful measurement and interpretation without adding a scheduler, CSV parser, or automatic creative changes before the analytics data is proven useful.

## UX Refinement

The dashboard should behave as a decision interface, not a raw analytics dump.

- Default analysis is public-only. Private and scheduled uploads remain visible in an All uploads view, but they do not drive headline decisions when public videos exist.
- The first screen prioritizes public video count, total public views, median public views, and median average viewed percentage.
- The review queue is segmented into Needs action, Winners, New, All public, and All uploads.
- The video list should keep the main decision columns visible: video, status, views, views/hour, average viewed, signal, and action.
- The detail panel should summarize What happened, Likely cause, Next action, and Prompt & title fixes before exposing raw JSON.
- Shorts metrics that are currently Studio-only, such as Shown in feed and How many chose to view, should be called out as future manual or CSV import fields.

Prompt refinements from analytics research:

- Script prompts must open with a visible contradiction in the first second.
- Titles should prefer familiar object plus surprising behavior.
- First image prompts must show action, tension, resistance, or consequence before clean explanatory cutaways.
- Captions stay short, mobile-readable, and punctuation-free.

## Alternatives Considered

### A. Minimal Metrics Page

Display recent metrics and basic rule labels only.

Pros:

- Smallest implementation.
- Low API and UI complexity.

Cons:

- Does not explain likely causes deeply.
- Does not help compare creative inputs against performance.
- Does not address unlinked videos well enough.

### B. API Dashboard With On-Demand AI Diagnosis

Build `/analytics` with recent API refresh, linked and unlinked videos, rule-based diagnosis, and on-demand AI diagnosis.

Pros:

- Directly answers the current problem: which videos underperform and why.
- Keeps AI cost controlled.
- Fits the existing local single-user architecture.
- Leaves room for CSV import later.

Cons:

- Requires OAuth scope changes and reconnecting YouTube.
- Requires new database tables and API routes.
- Some Shorts feed metrics may still be unavailable until CSV import is added.

### C. Full Closed Loop

Add API refresh, CSV import, batch AI diagnosis, and automatic prompt or seed strategy updates.

Pros:

- Most complete optimization loop.

Cons:

- Too broad for the next MVP step.
- Risks making creative changes from too little data.
- CSV and automated strategy changes should be designed after the base dashboard proves useful.

## OAuth And Permissions

The YouTube OAuth flow should request these scopes:

```text
https://www.googleapis.com/auth/youtube.upload
https://www.googleapis.com/auth/youtube.readonly
https://www.googleapis.com/auth/yt-analytics.readonly
```

The existing OAuth client, redirect URI, client id, and client secret can be reused.

The auth URL should continue to request offline access. It should include granted scopes incrementally when supported so reconnecting can preserve previously granted upload access.

After this change, the user must reconnect YouTube because the existing token does not include the new read scopes.

The API should surface a specific `youtube_reconnect_required` state when the token is missing required scopes or YouTube returns an insufficient-scope response.

## Data Model

### `youtube_video_links`

Normalizes YouTube videos known to the app, whether they came from an app upload or channel discovery.

Fields:

- `id uuid primary key`
- `youtube_video_id text not null unique`
- `project_id uuid references projects(id) on delete set null`
- `upload_job_id uuid references jobs(id) on delete set null`
- `source text not null`
- `link_status text not null`
- `title text not null`
- `description text`
- `published_at timestamptz`
- `duration_seconds integer`
- `privacy_status text`
- `last_synced_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Allowed `source` values:

- `db_upload`
- `channel_discovery`

Allowed `link_status` values:

- `linked`
- `unlinked`

Rules:

- A video from an `upload_youtube` job with a project is `linked`.
- A recent channel video with no matching local upload job is `unlinked`.
- If a later refresh finds a matching local upload for an unlinked video, the row can become `linked`.
- `youtube_video_id` is the stable external identity.

### `youtube_analytics_snapshots`

Stores metrics for each refresh.

Fields:

- `id uuid primary key`
- `youtube_video_link_id uuid not null references youtube_video_links(id) on delete cascade`
- `youtube_video_id text not null`
- `snapshot_at timestamptz not null default now()`
- `window_days integer not null`
- `views integer`
- `engaged_views integer`
- `likes integer`
- `comments integer`
- `shares integer`
- `subscribers_gained integer`
- `average_view_duration_seconds integer`
- `average_view_percentage numeric`
- `views_per_hour numeric`
- `like_rate numeric`
- `raw_data_api jsonb not null default '{}'::jsonb`
- `raw_analytics_api jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

Indexes:

- `(youtube_video_link_id, snapshot_at desc)`
- `(youtube_video_id, snapshot_at desc)`

### `youtube_video_diagnoses`

Stores rule-based and AI-assisted diagnosis.

Fields:

- `id uuid primary key`
- `youtube_video_link_id uuid not null references youtube_video_links(id) on delete cascade`
- `snapshot_id uuid not null references youtube_analytics_snapshots(id) on delete cascade`
- `diagnosis_type text not null`
- `model text`
- `reasoning_effort text`
- `input_hash text not null`
- `summary_th text not null`
- `suggestions_en jsonb not null default '{}'::jsonb`
- `raw_output jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Allowed `diagnosis_type` values:

- `rule_based`
- `ai`

Rules:

- Rule-based diagnosis is created or updated after each successful refresh.
- AI diagnosis is created only when the user clicks an AI analysis action.
- If the latest snapshot and creative context produce the same `input_hash`, the API should return the existing AI diagnosis instead of calling OpenAI again.

## API Design

Add an analytics route group, for example `/analytics/youtube`.

### `GET /analytics/youtube`

Returns the cached dashboard state from the database.

Query:

- `windowDays`, default `30`

Response includes:

- auth/scope status;
- linked videos;
- unlinked recent YouTube videos;
- latest snapshot per video;
- latest rule-based diagnosis per video;
- latest AI diagnosis per video when available;
- aggregate dashboard metrics.

### `POST /analytics/youtube/refresh`

Manually refreshes recent YouTube analytics.

Input:

- `windowDays`, default `30`

Flow:

1. Verify YouTube is connected and has required scopes.
2. Discover recent channel videos from YouTube Data API.
3. Upsert `youtube_video_links`.
4. Match discovered videos to local `upload_youtube` job output where possible.
5. Fetch video metadata and public statistics from YouTube Data API.
6. Fetch performance metrics from YouTube Analytics API.
7. Insert one `youtube_analytics_snapshots` row per refreshed video.
8. Create or update rule-based diagnosis for each refreshed video.
9. Return the refreshed dashboard summary.

The refresh request runs synchronously in the API for the first version. If this becomes slow, a later design can move it behind a worker job.

### `POST /analytics/youtube/videos/:youtubeVideoId/analyze`

Runs on-demand AI diagnosis for one video.

Flow:

1. Load the video link.
2. Load the latest snapshot.
3. Load linked project creative context when available.
4. Compute `input_hash`.
5. Return cached AI diagnosis if the hash already exists.
6. Call `packages/ai` with the existing OpenAI Responses API pattern, `OPENAI_MODEL`, and reasoning effort `xhigh` when the model is `gpt-5.5`.
7. Store and return the AI diagnosis.

Error cases:

- `409 youtube_not_connected`
- `409 youtube_reconnect_required`
- `404 youtube_video_not_found`
- `422 youtube_analytics_snapshot_missing`
- `502 youtube_analytics_fetch_failed`
- `502 youtube_ai_diagnosis_failed`

## Metrics

The MVP should store metrics available from the APIs, including:

- views;
- engaged views when available;
- likes;
- comments;
- shares when available;
- subscribers gained when available;
- average view duration;
- average view percentage;
- published time;
- duration seconds;
- local publish slot;
- age in hours;
- views per hour;
- like rate.

Limitations:

- `Shown in feed` and `Viewed vs swiped away` are critical Shorts metrics, but may not be available through the public APIs used in this version.
- Exposure and swipe-away diagnosis must therefore be labeled as a proxy when based only on views, views per hour, and retention metrics.
- CSV import remains the planned way to close this gap if API coverage is insufficient.

## Rule-Based Diagnosis

The rule-based diagnosis should be explainable and conservative.

Suggested labels:

- `too_new`: the video is too recent to evaluate strongly.
- `low_exposure_proxy`: low views or views per hour, with no direct feed exposure metric.
- `weak_hold`: average view percentage is low relative to recent channel videos.
- `mid_video_drop_proxy`: views are not terrible, but average percentage viewed is weak or middling.
- `strong_retention_low_distribution`: retention is strong but views are low.
- `high_like_rate_low_scale`: like rate is strong but views did not scale.
- `winner_candidate`: views, retention, and like rate are high relative to recent channel videos.

The implementation should compare videos against recent-channel medians rather than hard-coded universal thresholds wherever possible. This matters because a new channel's baseline is different from a mature channel's baseline.

## AI Diagnosis

AI diagnosis is on-demand only.

The AI input should include:

- latest metrics;
- previous snapshots for the same video when available;
- title, description, tags;
- linked project title and topic when available;
- seed id, appeal tier, mechanism family when available;
- hook narration, hook caption, visual hook archetype, and hook image prompt excerpt when available;
- scene durations;
- prompt template versions when available;
- rule-based diagnosis.

The AI model comes from `OPENAI_MODEL`, currently `gpt-5.5` in the local project configuration. The diagnosis should use the existing OpenAI Responses API pattern already used for script generation.

For `gpt-5.5`, AI diagnosis requests must set reasoning effort to `xhigh`. Store the effective reasoning effort on the diagnosis row so future reviews can compare outputs across model or effort changes.

The AI output must be structured:

```ts
{
  summaryTh: string;
  likelyCauseTh: string;
  priority: "low" | "medium" | "high";
  nextActionsTh: string[];
  suggestedTitleEn: string[];
  suggestedHookEn: string[];
  suggestedVisualPromptEn: string[];
  metadataNotesEn: string[];
}
```

The Thai fields are for the user's dashboard review. The English suggestions are for video metadata, prompt, and script iteration.

The AI must not automatically mutate projects, prompts, scenes, seeds, uploads, or schedules.

## Frontend Design

Use the `design-taste-frontend` constraints for this page. The page should feel like an operational dashboard, not a marketing page or generic analytics card grid.

Route:

- `apps/web/src/routes/analytics.tsx`

Navigation:

- Add an Analytics nav item in the app shell.

Design direction:

- Dense but readable dashboard surface.
- Use one restrained accent color.
- Use the existing Tailwind v4 setup.
- Use `lucide-react`, which is already installed.
- Use stable grids, `divide-y`, `border-t`, and spacing instead of excessive card containers.
- Use monospace styling for numeric metrics.
- Avoid glows, blobs, gradients, nested cards, and hero-style composition.

Layout:

- Header row: title, auth/scope status, `Refresh Analytics` action.
- Compact metric rail:
  - recent videos;
  - total views;
  - median average percentage viewed;
  - needs attention;
  - best performer.
- Main desktop grid:
  - left: video performance table;
  - right: sticky detail panel for the selected row.
- Mobile/tablet:
  - controls wrap;
  - table can scroll horizontally if needed;
  - detail panel stacks below.

Table columns:

- title and linked/unlinked status;
- project or channel-only source;
- published time;
- age;
- views;
- views per hour;
- average percentage viewed;
- likes and like rate;
- diagnosis badge;
- last synced;
- AI action.

Detail panel:

- latest metrics;
- snapshot trend when multiple snapshots exist;
- rule-based diagnosis;
- AI diagnosis when available;
- creative context for linked videos:
  - project title;
  - seed id;
  - hook narration;
  - hook caption;
  - visual hook archetype;
  - first image prompt excerpt;
- YouTube-only metadata for unlinked videos.

States:

- Loading: skeleton rows matching the table layout.
- Empty: clear state with connect or refresh action depending on auth status.
- Error: inline banner with specific reconnect, quota, or fetch reason.
- Buttons: include a subtle pressed state using transform, without heavy animation.

## Data Flow

### Dashboard Load

1. User opens `/analytics`.
2. Web calls `GET /analytics/youtube`.
3. API returns cached/latest dashboard data from the database.
4. UI renders auth status, cached rows, empty state, or errors.

### Manual Refresh

1. User clicks `Refresh Analytics`.
2. Web calls `POST /analytics/youtube/refresh`.
3. API checks token and scopes.
4. API fetches recent channel videos and metrics.
5. API writes video links, snapshots, and rule diagnosis.
6. Web refetches `GET /analytics/youtube`.

### AI Diagnosis

1. User selects a video.
2. User clicks `Analyze with AI`.
3. API loads snapshot and creative context.
4. API returns cached AI diagnosis if input hash matches.
5. Otherwise API calls OpenAI through `packages/ai` using reasoning effort `xhigh` for `gpt-5.5`.
6. API stores and returns the AI diagnosis.
7. UI displays Thai summary and English suggestions.

## Package Boundaries

- `apps/web` owns the analytics UI and calls only `apps/api`.
- `apps/api` owns HTTP routes, YouTube token checks, refresh orchestration, and AI diagnosis orchestration.
- `packages/db` owns tables, migrations, and query helpers.
- `packages/ai` owns the AI diagnosis prompt and OpenAI client code.
- `packages/shared` owns request/response schemas and shared analytics types.
- YouTube OAuth tokens remain under `LOCAL_ASSET_ROOT` and are never sent to the frontend.

## Validation

Follow the project MVP validation note and run the lightest relevant checks.

Database:

- Add a reversible migration with `migration.sql` and `down.sql`.
- Run `bun run db:check`.
- Apply with `bun run db:migrate:up`.
- Confirm rollback is covered by `down.sql`.

OAuth/API:

- Confirm old upload-only token surfaces `youtube_reconnect_required`.
- Reconnect YouTube and confirm refresh succeeds.
- Manually verify `GET /health`.
- Manually verify `GET /analytics/youtube`.
- Manually verify `POST /analytics/youtube/refresh`.
- Manually verify `POST /analytics/youtube/videos/:youtubeVideoId/analyze`.

UI:

- Open `/analytics`.
- Verify connected, reconnect-required, loading, empty, and error states.
- Verify linked and unlinked video rows.
- Verify rule diagnosis renders after refresh.
- Verify AI diagnosis button is disabled without a snapshot and uses cached result when unchanged.

## Rollout

1. Expand OAuth scopes.
2. Reconnect YouTube.
3. Add analytics database tables and queries.
4. Add shared schemas and API routes.
5. Add API clients/hooks in the web app.
6. Add `/analytics` UI.
7. Refresh the last 30 days of videos.
8. Inspect linked and unlinked rows.
9. Run one AI diagnosis for a representative low-view video.

## Future Work

- YouTube Studio CSV import for `Shown in feed` and `Viewed vs swiped away` if those metrics are not available through the APIs.
- Optional worker-backed refresh job if synchronous refresh becomes slow.
- Batch AI diagnosis for selected videos.
- Trend charts for multiple snapshots per video.
- Manual linking from unlinked YouTube videos to local projects.
- A/B tracking for title and hook variants.
- Prompt or seed strategy recommendations that require explicit user approval before any code or prompt changes.

## Open Decisions

There are no blocking open decisions for this design. The implementation plan should preserve the scope above and keep CSV import, scheduled sync, and automatic prompt changes out of the first version.
