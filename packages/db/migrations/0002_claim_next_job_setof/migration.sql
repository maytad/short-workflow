drop function if exists claim_next_job();

create function claim_next_job()
returns setof jobs
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
