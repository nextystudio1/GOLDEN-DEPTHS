-- Prevent concurrent joins from exceeding a world's max_players.
-- Lock the world row before checking membership count and inserting a visitor.
create or replace function orbit_private.orbit_join_world(p_world_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
 v_uid uuid := auth.uid();
 v_public boolean;
 v_count integer;
 v_max integer;
 v_existing boolean;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

 select is_public,max_players into v_public,v_max
 from public.game_worlds
 where id=p_world_id
 for update;
 if not found then raise exception 'WORLD_NOT_FOUND'; end if;

 select exists(
   select 1 from public.world_members
   where world_id=p_world_id and user_id=v_uid
 ) into v_existing;

 if not v_public and not v_existing then
   raise exception 'WORLD_PRIVATE';
 end if;

 if not v_existing then
   select count(*) into v_count
   from public.world_members
   where world_id=p_world_id;

   if v_count >= v_max then raise exception 'WORLD_FULL'; end if;

   insert into public.world_members(world_id,user_id,role)
   values(p_world_id,v_uid,'visitor')
   on conflict(world_id,user_id) do nothing;
 end if;

 return true;
end;
$function$;
