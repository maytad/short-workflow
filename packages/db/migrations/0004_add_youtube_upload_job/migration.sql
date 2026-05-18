alter type job_type add value if not exists 'upload_youtube';

alter table jobs drop constraint jobs_scene_id_per_type;

alter table jobs add constraint jobs_scene_id_per_type check (
  case type::text
    when 'generate_script' then scene_id is null
    when 'render_video' then scene_id is null
    when 'upload_youtube' then scene_id is null
    when 'generate_scene_image' then scene_id is not null
    when 'generate_scene_audio' then scene_id is not null
    else false
  end
);
