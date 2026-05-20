create table youtube_video_links (
  id uuid primary key default gen_random_uuid(),
  youtube_video_id text not null,
  project_id uuid references projects(id) on delete set null,
  upload_job_id uuid references jobs(id) on delete set null,
  source text not null,
  link_status text not null,
  title text not null,
  description text,
  published_at timestamptz,
  duration_seconds integer,
  privacy_status text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint youtube_video_links_source_check check (source in ('db_upload', 'channel_discovery')),
  constraint youtube_video_links_status_check check (link_status in ('linked', 'unlinked'))
);

create unique index youtube_video_links_video_id_idx
on youtube_video_links (youtube_video_id);

create index youtube_video_links_project_idx
on youtube_video_links (project_id);

create index youtube_video_links_published_at_idx
on youtube_video_links (published_at desc);

create table youtube_analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  youtube_video_link_id uuid not null references youtube_video_links(id) on delete cascade,
  youtube_video_id text not null,
  snapshot_at timestamptz not null default now(),
  window_days integer not null,
  views integer,
  engaged_views integer,
  likes integer,
  comments integer,
  shares integer,
  subscribers_gained integer,
  average_view_duration_seconds integer,
  average_view_percentage numeric,
  views_per_hour numeric,
  like_rate numeric,
  raw_data_api jsonb not null default '{}'::jsonb,
  raw_analytics_api jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint youtube_analytics_snapshots_window_days_check check (window_days > 0)
);

create index youtube_analytics_snapshots_link_time_idx
on youtube_analytics_snapshots (youtube_video_link_id, snapshot_at desc);

create index youtube_analytics_snapshots_video_time_idx
on youtube_analytics_snapshots (youtube_video_id, snapshot_at desc);

create table youtube_video_diagnoses (
  id uuid primary key default gen_random_uuid(),
  youtube_video_link_id uuid not null references youtube_video_links(id) on delete cascade,
  snapshot_id uuid not null references youtube_analytics_snapshots(id) on delete cascade,
  diagnosis_type text not null,
  model text,
  reasoning_effort text,
  input_hash text not null,
  summary_th text not null,
  suggestions_en jsonb not null default '{}'::jsonb,
  raw_output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint youtube_video_diagnoses_type_check check (diagnosis_type in ('rule_based', 'ai'))
);

create index youtube_video_diagnoses_link_created_idx
on youtube_video_diagnoses (youtube_video_link_id, created_at desc);

create unique index youtube_video_diagnoses_input_hash_idx
on youtube_video_diagnoses (youtube_video_link_id, diagnosis_type, input_hash);
