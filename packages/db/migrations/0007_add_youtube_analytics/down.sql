do $$
begin
  if exists (select 1 from youtube_video_diagnoses) then
    raise exception 'down_blocked_youtube_video_diagnoses_has_rows';
  end if;

  if exists (select 1 from youtube_analytics_snapshots) then
    raise exception 'down_blocked_youtube_analytics_snapshots_has_rows';
  end if;

  if exists (select 1 from youtube_video_links) then
    raise exception 'down_blocked_youtube_video_links_has_rows';
  end if;
end $$;

drop table youtube_video_diagnoses;
drop table youtube_analytics_snapshots;
drop table youtube_video_links;
