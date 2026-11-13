create or replace function public.get_follow_list(_user_id uuid, _kind text)
returns table(id uuid, username text, full_name text, avatar_url text, viewer_status text)
language plpgsql stable security definer set search_path = public as $$
declare _viewer uuid := auth.uid(); _private boolean;
begin
  if _viewer is null or _kind not in ('followers','following') then return; end if;
  select p.is_private into _private from profiles p where p.id = _user_id;
  if not found then return; end if;
  if _viewer <> _user_id and coalesce(_private,false) and not exists (
    select 1 from follows f where f.follower_id = _viewer and f.following_id = _user_id and f.status = 'accepted'
  ) then return; end if;
  return query
  select p.id, p.username, p.full_name, p.avatar_url,
    (select f2.status from follows f2 where f2.follower_id = _viewer and f2.following_id = p.id limit 1)
  from follows f join profiles p on p.id = case when _kind = 'followers' then f.follower_id else f.following_id end
  where f.status = 'accepted'
    and (case when _kind = 'followers' then f.following_id else f.follower_id end) = _user_id
    and not exists (select 1 from blocks b where (b.blocker_id = _viewer and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = _viewer))
  order by f.created_at desc
  limit 500;
end $$;
revoke all on function public.get_follow_list(uuid, text) from public, anon;
grant execute on function public.get_follow_list(uuid, text) to authenticated;