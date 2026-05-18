# YouTube Scheduled Public Upload Design

## Summary

Add an upload mode that lets the user manually queue a YouTube upload while the app automatically chooses the next available public publish time from database-backed daily slots.

The user still generates and renders videos manually. The app only automates publish-time selection after the user clicks upload.

## Goals

- Support four public publish slots per day.
- Choose the next available slot by checking the database.
- Prevent two videos from reserving the same scheduled publish slot.
- Keep private upload behavior available.
- Upload scheduled public videos using YouTube's required flow: upload as `private` with `status.publishAt`.
- Show the chosen scheduled publish time in the UI before or immediately after queueing.

## Non-Goals

- No fully automatic upload after rendering.
- No recurring background scheduler that uploads videos without a button click.
- No cloud queue or cron service.
- No multi-channel calendar management.
- No automatic rescheduling after YouTube rejects an upload.
- No editing scheduled publish time after queueing in the first version.

## Default Schedule Configuration

Use these defaults:

```env
YOUTUBE_SCHEDULE_TIMEZONE=Asia/Bangkok
YOUTUBE_DAILY_PUBLISH_TIMES=09:00,12:00,17:00,21:00
YOUTUBE_SCHEDULE_MIN_LEAD_MINUTES=30
```

The min lead time prevents choosing a slot that is too close to the current time for upload latency and YouTube processing.

If current Bangkok time is `08:45`, the `09:00` slot is inside the 30-minute lead window, so the next candidate is `12:00`.

## YouTube API Rule

Scheduled public upload must be represented as:

```json
{
  "status": {
    "privacyStatus": "private",
    "publishAt": "2026-05-19T02:00:00.000Z",
    "selfDeclaredMadeForKids": false,
    "containsSyntheticMedia": true
  }
}
```

`publishAt` is stored and sent as UTC ISO datetime. The UI displays it in `Asia/Bangkok`.

References:

- YouTube `videos` resource `status.publishAt`: https://developers.google.com/youtube/v3/docs/videos#status.publishAt
- YouTube `videos.insert`: https://developers.google.com/youtube/v3/docs/videos/insert

## Selected Approach

Use a dedicated `youtube_upload_schedules` table.

This is preferred over reading only `jobs.input` because schedule reservation is a domain concept, not just worker input. A table gives clear DB-backed checks, a unique constraint for slot collision prevention, and an easy source for future calendar views.

## Alternatives Considered

### A. Store Schedule Only In `jobs.input`

Pros:

- No migration.
- Smallest first change.

Cons:

- Harder to query reliably.
- No clean unique constraint for slot reservation.
- Harder to build a future schedule list.

### B. Dedicated Schedule Table

Pros:

- Clear slot reservation model.
- DB can prevent duplicate active slots.
- Easier UI summaries and future calendar views.

Cons:

- Requires migration and extra service layer.

### C. Static Client-Side Slot Selection

Pros:

- Simple UI implementation.

Cons:

- Does not satisfy the requirement to check from DB.
- Race conditions remain if multiple projects are queued.

## Database Design

Add table `youtube_upload_schedules`.

Fields:

- `id uuid primary key`
- `project_id uuid not null references projects(id) on delete cascade`
- `job_id uuid references jobs(id) on delete set null`
- `render_id uuid not null references renders(id) on delete cascade`
- `output_asset_id uuid not null references assets(id) on delete cascade`
- `scheduled_publish_at timestamptz not null`
- `timezone text not null`
- `status text not null`
- `youtube_video_id text`
- `error_message text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Allowed statuses:

- `reserved`
- `uploading`
- `scheduled`
- `failed`
- `cancelled`

Indexes:

- `youtube_upload_schedules_project_created_at_idx` on `(project_id, created_at desc)`
- `youtube_upload_schedules_publish_at_idx` on `(scheduled_publish_at)`
- partial unique index on `(scheduled_publish_at)` where `status in ('reserved', 'uploading', 'scheduled')`

The unique index is the collision guard. If two requests choose the same slot concurrently, one insert succeeds and the other retries slot selection.

## Slot Selection

Add a service function:

```ts
reserveNextYoutubeScheduleSlot(db, input)
```

Input:

- `projectId`
- `renderId`
- `outputAssetId`
- `now`
- `timezone`
- `dailyPublishTimes`
- `minLeadMinutes`

Algorithm:

1. Convert `now + minLeadMinutes` to the configured timezone.
2. Generate candidate local datetimes for the next 30 days using the four configured daily times.
3. Convert each candidate to UTC ISO.
4. Ignore candidates earlier than `now + minLeadMinutes`.
5. Query existing active reservations for candidate timestamps.
6. Insert the first available candidate as `reserved`.
7. If unique conflict occurs, retry with the next candidate.
8. If no slot exists in the 30-day window, return `409 youtube_schedule_full`.

The first implementation can use a small internal timezone utility based on `Intl.DateTimeFormat` and fixed `HH:mm` inputs. No dependency should be added unless implementation proves that local-time to UTC conversion is unsafe without one.

## API Design

Change YouTube upload endpoint to accept a small body:

```ts
{
  mode: "private" | "scheduled_public"
}
```

For `private`:

- Keep current behavior.
- Queue upload with `privacyStatus: "private"`.
- No schedule row is created.

For `scheduled_public`:

- Require YouTube auth connected.
- Require render output and metadata readiness.
- Reserve the next schedule slot in the database.
- Queue `upload_youtube` with:

```ts
{
  visibility: "scheduled_public",
  privacyStatus: "private",
  publishAt: schedule.scheduledPublishAt,
  scheduleId: schedule.id
}
```

Return the created job plus schedule summary.

Recommended response:

```ts
{
  job: Job,
  schedule: {
    id: string,
    scheduledPublishAt: string,
    timezone: "Asia/Bangkok",
    status: "reserved"
  } | null
}
```

## Shared Schema Design

Update shared types:

- `YoutubeUploadMode = "private" | "scheduled_public"`
- `youtubeUploadRequestSchema`
- `youtubeUploadJobInputSchema`
- `youtubeUploadJobOutputSchema`
- `youtubeUploadSummarySchema`
- `youtubeUploadScheduleSchema`

Rules:

- `privacyStatus` remains `"private"` for both modes.
- `publishAt` is required for `scheduled_public`.
- `publishAt` is absent for `private`.
- `scheduleId` is required for `scheduled_public`.

## Worker Design

Rename the worker function from `uploadPrivateYoutubeVideo` to a neutral name such as:

```ts
uploadYoutubeVideo(input)
```

Worker request body:

- Always sends `privacyStatus: "private"`.
- Sends `publishAt` only when job input has scheduled mode.
- Still sends `selfDeclaredMadeForKids: false`.
- Still sends `containsSyntheticMedia: true`.

Schedule status updates:

- Before upload starts: set schedule status to `uploading`.
- On successful YouTube response: set schedule status to `scheduled`, store `youtube_video_id`.
- On failure: set schedule status to `failed`, store normalized error message.

Job-level retry should remain `maxAttempts: 1` for upload jobs to avoid duplicate uploads. Manual retry or schedule cancellation can come later.

## UI Design

Update the upload dialog:

- Add mode selector:
  - `Private upload`
  - `Schedule public`
- Default mode: `Schedule public`
- Show schedule copy before submit:
  - `The next available public slot will be reserved automatically.`
  - `4 slots/day: 09:00, 12:00, 17:00, 21:00 Bangkok time`
- The first implementation does not need a preview endpoint. The exact reserved slot is shown after queueing from the API response and project detail refresh.

After scheduled upload succeeds:

- Display `Scheduled public`
- Display local publish time in Bangkok timezone
- Display YouTube video id
- Display Studio link

If upload is private:

- Keep current `Uploaded privately to YouTube` messaging.

## Project Detail Summary

Project detail should expose the latest upload state without requiring the frontend to parse job JSON.

Extend `youtubeUpload` summary:

- `mode`
- `privacyStatus`
- `publishAt`
- `scheduledPublishAt`
- `scheduleStatus`
- `timezone`
- `youtubeVideoId`
- `youtubeStudioUrl`
- `uploadedAt`
- `errorMessage`

For private uploads, scheduled fields are `null`.

## Error Handling

- Missing project: `404`.
- YouTube not connected: `409 youtube_not_connected`.
- Missing render, render asset, or metadata: `422 youtube_upload_preconditions_failed`.
- No available slot in the 30-day window: `409 youtube_schedule_full`.
- Schedule insert race: retry next slot internally before returning an error.
- YouTube API rejection: job fails and schedule status becomes `failed`.

## Validation

Focused automated checks:

- Shared schema accepts private upload request.
- Shared schema accepts scheduled public upload request.
- Shared schema rejects scheduled public job input without `publishAt`.
- Slot helper chooses the next future slot respecting min lead time.
- Slot helper skips DB-reserved slots.
- API route queues private mode with no schedule.
- API route queues scheduled mode with reserved schedule and `publishAt`.
- Worker sends `publishAt` only for scheduled mode.
- Worker updates schedule status on success and failure.
- UI helper formats scheduled publish time in `Asia/Bangkok`.

Manual verification:

- Click scheduled upload on a rendered project.
- Confirm one active upload job appears.
- Confirm schedule row is created.
- Confirm YouTube Studio shows the video as scheduled/private until publish time.

## Migration Impact

This feature requires one database migration.

Rollback may be destructive for schedule rows. The `down.sql` should drop the schedule table after confirming it has no rows, or intentionally fail with a clear message if rows exist.

## Open Decisions

None. Defaults are:

- Timezone: `Asia/Bangkok`
- Daily publish times: `09:00,12:00,17:00,21:00`
- Min lead: `30` minutes
- Schedule window: `30` days
