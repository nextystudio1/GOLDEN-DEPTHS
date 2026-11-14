create table if not exists public.world_claims (
 world_id uuid not null references public.game_worlds(id) on delete cascade,
 chunk_x integer not null check (chunk_x between 0 and 13),
 chunk_y integer not null check (chunk_y between 0 and 5),
 owner_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(world_id,chunk_x,chunk_y)
);
create index if not exists world_claims_owner_world_idx on public.world_claims(owner_id,world_id);
alter table public.world_claims enable row level security;
drop policy if exists "world users can read claims" on public.world_claims;
create policy "world users can read claims" on public.world_claims
 for select to authenticated using (
  exists(select 1 from public.game_worlds w where w.id=world_claims.world_id
   and (w.is_public or w.owner_id=(select auth.uid())
    or exists(select 1 from public.world_members m where m.world_id=w.id and m.user_id=(select auth.uid()))))
 );
revoke all on public.world_claims from anon,authenticated;
grant select on public.world_claims to authenticated;

create or replace function orbit_private.orbit_assert_chunk_access(p_world_id uuid,p_tile_x integer,p_tile_y integer)
returns void language plpgsql security definer set search_path to ''
as $function$
begin
 if exists(select 1 from public.world_claims c
  where c.world_id=p_world_id and c.chunk_x=p_tile_x/16 and c.chunk_y=p_tile_y/16
   and c.owner_id<>auth.uid()) then
  raise exception 'AREA_CLAIMED';
 end if;
end;
$function$;
revoke all on function orbit_private.orbit_assert_chunk_access(uuid,integer,integer) from public,anon,authenticated;

create or replace function orbit_private.orbit_claim_chunk(p_world_id uuid,p_chunk_x integer,p_chunk_y integer)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_uid uuid:=auth.uid();v_px integer;v_py integer;v_count integer;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_chunk_x<0 or p_chunk_x>13 or p_chunk_y<0 or p_chunk_y>5 then raise exception 'CHUNK_OUT_OF_RANGE'; end if;
 select pos_x,pos_y into v_px,v_py from public.player_profiles
  where user_id=v_uid and last_world_id=p_world_id for update;
 if not found then raise exception 'PLAYER_NOT_IN_WORLD'; end if;
 if floor(v_px/16.0)::integer<>p_chunk_x or floor(v_py/16.0)::integer<>p_chunk_y then
  raise exception 'MOVE_TO_AREA_TO_CLAIM';
 end if;
 if not exists(select 1 from public.world_members where world_id=p_world_id and user_id=v_uid) then
  raise exception 'WORLD_MEMBERSHIP_REQUIRED';
 end if;
 select count(*) into v_count from public.world_claims where world_id=p_world_id and owner_id=v_uid;
 if v_count>=9 then raise exception 'CLAIM_LIMIT_REACHED'; end if;
 insert into public.world_claims(world_id,chunk_x,chunk_y,owner_id)
 values(p_world_id,p_chunk_x,p_chunk_y,v_uid)
 on conflict(world_id,chunk_x,chunk_y) do nothing;
 if not found then raise exception 'AREA_ALREADY_CLAIMED'; end if;
 return jsonb_build_object('world_id',p_world_id,'chunk_x',p_chunk_x,'chunk_y',p_chunk_y,'owner_id',v_uid);
end;
$function$;

create or replace function orbit_private.orbit_release_chunk(p_world_id uuid,p_chunk_x integer,p_chunk_y integer)
returns boolean language plpgsql security definer set search_path to ''
as $function$
declare v_uid uuid:=auth.uid();v_px integer;v_py integer;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_chunk_x<0 or p_chunk_x>13 or p_chunk_y<0 or p_chunk_y>5 then raise exception 'CHUNK_OUT_OF_RANGE'; end if;
 select pos_x,pos_y into v_px,v_py from public.player_profiles
  where user_id=v_uid and last_world_id=p_world_id for update;
 if not found then raise exception 'PLAYER_NOT_IN_WORLD'; end if;
 delete from public.world_claims where world_id=p_world_id and chunk_x=p_chunk_x and chunk_y=p_chunk_y and owner_id=v_uid;
 if not found then raise exception 'NOT_CLAIM_OWNER'; end if;
 return true;
end;
$function$;

revoke all on function orbit_private.orbit_claim_chunk(uuid,integer,integer) from public,anon;
revoke all on function orbit_private.orbit_release_chunk(uuid,integer,integer) from public,anon;
grant execute on function orbit_private.orbit_claim_chunk(uuid,integer,integer) to authenticated,service_role;
grant execute on function orbit_private.orbit_release_chunk(uuid,integer,integer) to authenticated,service_role;
create or replace function public.orbit_claim_chunk(p_world_id uuid,p_chunk_x integer,p_chunk_y integer)
returns jsonb language sql set search_path to ''
as $function$ select orbit_private.orbit_claim_chunk(p_world_id,p_chunk_x,p_chunk_y); $function$;
create or replace function public.orbit_release_chunk(p_world_id uuid,p_chunk_x integer,p_chunk_y integer)
returns boolean language sql set search_path to ''
as $function$ select orbit_private.orbit_release_chunk(p_world_id,p_chunk_x,p_chunk_y); $function$;
revoke all on function public.orbit_claim_chunk(uuid,integer,integer) from public,anon;
revoke all on function public.orbit_release_chunk(uuid,integer,integer) from public,anon;
grant execute on function public.orbit_claim_chunk(uuid,integer,integer) to authenticated,service_role;
grant execute on function public.orbit_release_chunk(uuid,integer,integer) to authenticated,service_role;
