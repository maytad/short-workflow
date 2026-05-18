do $$
begin
  if exists (select 1 from youtube_upload_schedules) then
    raise exception 'down_blocked_youtube_upload_schedules_has_rows';
  end if;
end $$;

drop table youtube_upload_schedules;
