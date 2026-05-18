-- Postgres does not support DROP VALUE on an enum type. Rolling back would
-- require recreating job_type, casting every jobs row, and dropping the new
-- type. We refuse to encode that here. If a true rollback is needed, write a
-- one-off migration after confirming no rows use 'upload_youtube'.
do $$
begin
  if exists (
    select 1 from jobs
    where type::text = 'upload_youtube'
  ) then
    raise exception 'down_blocked_rows_use_upload_youtube';
  end if;
  raise exception 'down_blocked_enum_value_drop_not_supported';
end$$;
