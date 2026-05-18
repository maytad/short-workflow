create table youtube_upload_schedules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  job_id uuid references jobs(id) on delete set null,
  render_id uuid not null references renders(id) on delete cascade,
  output_asset_id uuid not null references assets(id) on delete cascade,
  scheduled_publish_at timestamptz not null,
  timezone text not null,
  status text not null default 'reserved',
  youtube_video_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint youtube_upload_schedules_status_check check (
    status in ('reserved', 'uploading', 'scheduled', 'failed', 'cancelled')
  )
);

create index youtube_upload_schedules_project_created_at_idx
on youtube_upload_schedules (project_id, created_at desc);

create index youtube_upload_schedules_publish_at_idx
on youtube_upload_schedules (scheduled_publish_at);

create unique index youtube_upload_schedules_one_active_publish_slot
on youtube_upload_schedules (scheduled_publish_at)
where status in ('reserved', 'uploading', 'scheduled');
