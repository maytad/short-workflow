create extension if not exists pgcrypto;

create type project_status as enum ('draft', 'ready', 'rendering', 'done', 'failed');
create type scene_status as enum ('draft', 'ready');
create type scene_role as enum ('hook', 'context', 'point', 'payoff', 'cta');
create type asset_kind as enum ('image', 'audio', 'render', 'thumbnail', 'render_input');
create type asset_status as enum ('pending', 'ready', 'failed');
create type storage_driver as enum ('local');
create type asset_provider as enum ('openai', 'google_gemini', 'google_tts', 'remotion', 'local');
create type job_type as enum ('generate_script', 'generate_scene_image', 'generate_scene_audio', 'render_video');
create type job_status as enum ('pending', 'processing', 'succeeded', 'failed');
create type render_status as enum ('pending', 'processing', 'succeeded', 'failed');
create type prompt_purpose as enum ('script', 'image_prompt', 'ssml', 'caption');

create table projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  topic text not null,
  status project_status not null default 'draft',
  target_duration_seconds integer not null default 45,
  language text not null default 'en',
  format text not null default 'vertical_9_16',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  position integer not null,
  role scene_role not null,
  duration_seconds integer not null,
  narration text not null default '',
  caption text not null default '',
  image_prompt text not null default '',
  ssml text not null default '',
  status scene_status not null default 'draft',
  content_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index scenes_one_position_per_project
on scenes (project_id, position);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  scene_id uuid references scenes(id) on delete cascade,
  type job_type not null,
  status job_status not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  parent_job_id uuid,
  error_message text,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  next_retry_at timestamptz,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint jobs_scene_id_per_type check (
    case type
      when 'generate_script' then scene_id is null
      when 'render_video' then scene_id is null
      when 'generate_scene_image' then scene_id is not null
      when 'generate_scene_audio' then scene_id is not null
      else false
    end
  )
);

create index jobs_project_status_created_at_idx
on jobs (project_id, status, created_at desc);

create index jobs_retry_claim_idx
on jobs (status, next_retry_at, created_at);

create index jobs_processing_started_at_idx
on jobs (started_at)
where status = 'processing';

create unique index jobs_one_active_project_job
on jobs (project_id, type)
where scene_id is null
  and status in ('pending', 'processing');

create unique index jobs_one_active_scene_job
on jobs (scene_id, type)
where scene_id is not null
  and status in ('pending', 'processing');

create table assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  scene_id uuid references scenes(id) on delete cascade,
  kind asset_kind not null,
  storage_driver storage_driver not null default 'local',
  path text not null,
  mime_type text,
  size_bytes integer,
  checksum text,
  status asset_status not null default 'pending',
  provider asset_provider not null,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assets_scene_kind_created_ready_idx
on assets (scene_id, kind, created_at desc)
where status = 'ready';

create table renders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  status render_status not null default 'pending',
  input_asset_id uuid references assets(id),
  output_asset_id uuid references assets(id),
  duration_seconds integer not null,
  width integer not null,
  height integer not null,
  fps integer not null,
  ai_disclosure_acknowledged_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table prompt_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  scene_id uuid references scenes(id) on delete cascade,
  purpose prompt_purpose not null,
  provider asset_provider not null,
  model text,
  revision integer not null,
  prompt_payload jsonb not null,
  response_text text,
  response_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index prompt_versions_history_idx
on prompt_versions (project_id, scene_id, purpose, revision desc);

create table if not exists app_migrations (
  id bigserial primary key,
  name text not null unique,
  checksum text not null,
  applied_at timestamptz not null default now()
);

create or replace function claim_next_job()
returns jobs
language sql
as $$
  with claimed as (
    select id
    from jobs
    where status = 'pending'
      and attempts < max_attempts
      and (next_retry_at is null or next_retry_at <= now())
    order by created_at
    for update skip locked
    limit 1
  )
  update jobs
  set
    status = 'processing',
    attempts = attempts + 1,
    started_at = now(),
    finished_at = null,
    next_retry_at = null,
    updated_at = now()
  where id in (select id from claimed)
  returning *;
$$;
