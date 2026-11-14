create or replace function orbit_private.orbit_assert_chunk_access(p_world_id uuid,p_tile_x integer,p_tile_y integer)
returns void language plpgsql security definer set search_path to ''
as $function$
declare v_cx integer;v_cy integer;
begin
 if p_tile_x<0 or p_tile_x>219 or p_tile_y<0 or p_tile_y>89 then raise exception 'TILE_OUT_OF_RANGE'; end if;
 v_cx:=p_tile_x/16;v_cy:=p_tile_y/16;
 perform public.orbit_get_chunk(p_world_id,v_cx,v_cy);
 perform 1 from public.world_chunks where world_id=p_world_id and chunk_x=v_cx and chunk_y=v_cy for update;
 if exists(select 1 from public.world_claims c where c.world_id=p_world_id and c.chunk_x=v_cx and c.chunk_y=v_cy and c.owner_id<>auth.uid()) then
  raise exception 'AREA_CLAIMED';
 end if;
end;
$function$;

create or replace function orbit_private.orbit_claim_chunk(p_world_id uuid,p_chunk_x integer,p_chunk_y integer)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_uid uuid:=auth.uid();v_px integer;v_py integer;v_count integer;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_chunk_x<0 or p_chunk_x>13 or p_chunk_y<0 or p_chunk_y>5 then raise exception 'CHUNK_OUT_OF_RANGE'; end if;
 select pos_x,pos_y into v_px,v_py from public.player_profiles where user_id=v_uid and last_world_id=p_world_id for update;
 if not found then raise exception 'PLAYER_NOT_IN_WORLD'; end if;
 if floor(v_px/16.0)::integer<>p_chunk_x or floor(v_py/16.0)::integer<>p_chunk_y then raise exception 'MOVE_TO_AREA_TO_CLAIM'; end if;
 if not exists(select 1 from public.world_members where world_id=p_world_id and user_id=v_uid) then raise exception 'WORLD_MEMBERSHIP_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtext(p_world_id::text),hashtext(v_uid::text));
 perform public.orbit_get_chunk(p_world_id,p_chunk_x,p_chunk_y);
 perform 1 from public.world_chunks where world_id=p_world_id and chunk_x=p_chunk_x and chunk_y=p_chunk_y for update;
 select count(*) into v_count from public.world_claims where world_id=p_world_id and owner_id=v_uid;
 if v_count>=9 then raise exception 'CLAIM_LIMIT_REACHED'; end if;
 insert into public.world_claims(world_id,chunk_x,chunk_y,owner_id) values(p_world_id,p_chunk_x,p_chunk_y,v_uid)
 on conflict(world_id,chunk_x,chunk_y) do nothing;
 if not found then raise exception 'AREA_ALREADY_CLAIMED'; end if;
 return jsonb_build_object('world_id',p_world_id,'chunk_x',p_chunk_x,'chunk_y',p_chunk_y,'owner_id',v_uid);
end;
$function$;
