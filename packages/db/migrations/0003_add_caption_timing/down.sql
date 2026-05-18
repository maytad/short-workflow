-- Postgres does not support DROP VALUE on an enum type. Rolling back would
-- require recreating asset_kind and asset_provider, casting every assets row,
-- and dropping the new types. We refuse to encode that here. If a true
-- rollback is needed, write a one-off migration that handles the cast
-- explicitly after confirming no rows use 'caption_timing' or 'elevenlabs'.
do $$
begin
  if exists (
    select 1 from assets
    where kind = 'caption_timing' or provider = 'elevenlabs'
  ) then
    raise exception 'down_blocked_rows_use_new_enum_values';
  end if;
  raise exception 'down_blocked_enum_value_drop_not_supported';
end$$;
