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


-- Server-side tile mutations enforce the chunk claim before changing data.
CREATE OR REPLACE FUNCTION orbit_private.orbit_harvest_crop(p_world_id uuid, p_tile_x integer, p_tile_y integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=auth.uid();v_px integer;v_py integer;v_data jsonb;v_plant public.world_plants;v_tile integer;v_cx integer;v_cy integer;v_ox integer;v_oy integer;v_have bigint;v_experience bigint;v_level integer;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 select pos_x,pos_y into v_px,v_py from public.player_profiles where user_id=v_uid and last_world_id=p_world_id for update;
 if not found then raise exception 'PLAYER_NOT_IN_WORLD'; end if;
 if sqrt(power((p_tile_x-v_px)::double precision,2)+power((p_tile_y-v_py)::double precision,2))>4.5 then raise exception 'TOO_FAR'; end if;
 perform orbit_private.orbit_assert_chunk_access(p_world_id,p_tile_x,p_tile_y);
 select * into v_plant from public.world_plants where world_id=p_world_id and tile_x=p_tile_x and tile_y=p_tile_y for update;
 if not found then raise exception 'CROP_NOT_FOUND'; end if;
 if v_plant.planted_at+interval '5 minutes'>now() then raise exception 'CROP_NOT_READY'; end if;
 v_cx:=p_tile_x/16;v_cy:=p_tile_y/16;v_ox:=p_tile_x%16;v_oy:=p_tile_y%16;
 perform public.orbit_get_chunk(p_world_id,v_cx,v_cy);
 select tile_data into v_data from public.world_chunks where world_id=p_world_id and chunk_x=v_cx and chunk_y=v_cy for update;
 v_tile:=(v_data #>> array['tiles',v_oy::text,v_ox::text])::integer;
 if v_tile<>8 then raise exception 'CROP_NOT_FOUND'; end if;
 select quantity into v_have from public.player_inventory where user_id=v_uid and item_id='glow_seed' for update;
 if coalesce(v_have,0)+2>99 then raise exception 'INVENTORY_LIMIT'; end if;
 v_data:=jsonb_set(v_data,array['tiles',v_oy::text,v_ox::text],'0'::jsonb,false);
 update public.world_chunks set tile_data=v_data,revision=revision+1,updated_by=v_uid,updated_at=now() where world_id=p_world_id and chunk_x=v_cx and chunk_y=v_cy;
 delete from public.world_plants where world_id=p_world_id and tile_x=p_tile_x and tile_y=p_tile_y;
 insert into public.player_inventory(user_id,item_id,quantity) values(v_uid,'glow_seed',2)
 on conflict(user_id,item_id) do update set quantity=public.player_inventory.quantity+2,updated_at=now();
 update public.player_profiles set experience=experience+8,level=least(1000,floor(sqrt((experience+8)::numeric/100))::integer+1),updated_at=now()
 where user_id=v_uid returning experience,level into v_experience,v_level;
 return jsonb_build_object('item_id','glow_seed','quantity',2,'xp_gained',8,'experience',v_experience,'level',v_level);
end;
$function$


CREATE OR REPLACE FUNCTION orbit_private.orbit_mine_tile(p_world_id uuid, p_tile_x integer, p_tile_y integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_uid uuid:=auth.uid();v_px integer;v_py integer;v_tool text;v_last_mined timestamptz;
 v_required_ms integer;v_data jsonb;v_tile integer;v_item text;
 v_cx integer;v_cy integer;v_ox integer;v_oy integer;v_qty bigint;v_have bigint;v_stack_limit integer;
 v_xp integer;v_experience bigint;v_level integer;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_tile_x<0 or p_tile_x>219 or p_tile_y<0 or p_tile_y>89 then raise exception 'TILE_OUT_OF_RANGE'; end if;
 select pos_x,pos_y,equipped_tool,last_mined_at into v_px,v_py,v_tool,v_last_mined
 from public.player_profiles where user_id=v_uid and last_world_id=p_world_id for update;
 if not found then raise exception 'PLAYER_NOT_IN_WORLD'; end if;
 if sqrt(power((p_tile_x-v_px)::double precision,2)+power((p_tile_y-v_py)::double precision,2))>4.5 then raise exception 'TOO_FAR'; end if;
 perform orbit_private.orbit_assert_chunk_access(p_world_id,p_tile_x,p_tile_y);
 v_cx:=p_tile_x/16;v_cy:=p_tile_y/16;v_ox:=p_tile_x%16;v_oy:=p_tile_y%16;
 perform public.orbit_get_chunk(p_world_id,v_cx,v_cy);
 select tile_data into v_data from public.world_chunks where world_id=p_world_id and chunk_x=v_cx and chunk_y=v_cy for update;
 v_tile:=(v_data #>> array['tiles',v_oy::text,v_ox::text])::integer;
 if v_tile=0 then raise exception 'EMPTY_TILE'; end if;
 v_item:=case v_tile when 1 then 'grass_block' when 2 then 'soil_block' when 3 then 'slate_block' when 4 then 'copper_ore' when 5 then 'sky_crystal' when 6 then 'amber_wood' when 7 then 'amber_wood' else null end;
 if v_item is null then raise exception 'UNSUPPORTED_TILE'; end if;
 v_required_ms:=case v_tile when 1 then 420 when 2 then 300 when 3 then 850 when 4 then 1150 when 5 then 1500 when 6 then 520 when 7 then 180 else 650 end;
 if v_tool='copper_pickaxe' then v_required_ms:=ceil(v_required_ms*.72)::integer;
 elsif v_tool='stone_pickaxe' then v_required_ms:=ceil(v_required_ms*.88)::integer;
 elsif v_tool='crystal_pickaxe' then v_required_ms:=ceil(v_required_ms*.52)::integer; end if;
 if v_last_mined is not null and extract(epoch from (clock_timestamp()-v_last_mined))*1000<v_required_ms then raise exception 'MINING_COOLDOWN'; end if;
 select stack_limit into v_stack_limit from public.item_catalog where item_id=v_item;
 select quantity into v_have from public.player_inventory where user_id=v_uid and item_id=v_item for update;
 if coalesce(v_have,0)>=v_stack_limit then raise exception 'INVENTORY_LIMIT'; end if;
 v_data:=jsonb_set(v_data,array['tiles',v_oy::text,v_ox::text],'0'::jsonb,false);
 update public.world_chunks set tile_data=v_data,revision=revision+1,updated_by=v_uid,updated_at=now()
 where world_id=p_world_id and chunk_x=v_cx and chunk_y=v_cy;
 insert into public.player_inventory(user_id,item_id,quantity) values(v_uid,v_item,1)
 on conflict(user_id,item_id) do update set quantity=public.player_inventory.quantity+1,updated_at=now() returning quantity into v_qty;
 v_xp:=case v_tile when 1 then 1 when 2 then 1 when 3 then 2 when 4 then 4 when 5 then 8 when 6 then 1 when 7 then 1 else 1 end;
 update public.player_profiles set last_mined_at=clock_timestamp(),experience=experience+v_xp,
  level=least(1000,floor(sqrt((experience+v_xp)::numeric/100))::integer+1),updated_at=now()
 where user_id=v_uid returning experience,level into v_experience,v_level;
 return jsonb_build_object('tile_id',v_tile,'item_id',v_item,'quantity',v_qty,'mining_ms',v_required_ms,'xp_gained',v_xp,'experience',v_experience,'level',v_level);
end;
$function$


CREATE OR REPLACE FUNCTION orbit_private.orbit_place_tile(p_world_id uuid, p_tile_x integer, p_tile_y integer, p_item_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=auth.uid();v_px integer;v_py integer;v_data jsonb;v_tile integer;v_cx integer;v_cy integer;v_ox integer;v_oy integer;v_qty bigint;v_placeable boolean;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_tile_x<0 or p_tile_x>219 or p_tile_y<0 or p_tile_y>89 then raise exception 'TILE_OUT_OF_RANGE'; end if;
 select pos_x,pos_y into v_px,v_py from public.player_profiles where user_id=v_uid and last_world_id=p_world_id for update;
 if not found then raise exception 'PLAYER_NOT_IN_WORLD'; end if;
 if sqrt(power((p_tile_x-v_px)::double precision,2)+power((p_tile_y-v_py)::double precision,2))>4.5 then raise exception 'TOO_FAR'; end if;
 perform orbit_private.orbit_assert_chunk_access(p_world_id,p_tile_x,p_tile_y);
 select (item_data->>'tile')::integer,is_placeable into v_tile,v_placeable from public.item_catalog where item_id=p_item_id;
 if not found or not v_placeable or v_tile not in (1,2,3) then raise exception 'ITEM_NOT_PLACEABLE'; end if;
 v_cx:=p_tile_x/16;v_cy:=p_tile_y/16;v_ox:=p_tile_x%16;v_oy:=p_tile_y%16;
 perform public.orbit_get_chunk(p_world_id,v_cx,v_cy);
 select tile_data into v_data from public.world_chunks where world_id=p_world_id and chunk_x=v_cx and chunk_y=v_cy for update;
 if (v_data #>> array['tiles',v_oy::text,v_ox::text])::integer<>0 then raise exception 'TILE_OCCUPIED'; end if;
 update public.player_inventory set quantity=quantity-1,updated_at=now() where user_id=v_uid and item_id=p_item_id and quantity>0 returning quantity into v_qty;
 if not found then raise exception 'NOT_ENOUGH_ITEMS'; end if;
 v_data:=jsonb_set(v_data,array['tiles',v_oy::text,v_ox::text],to_jsonb(v_tile),false);
 update public.world_chunks set tile_data=v_data,revision=revision+1,updated_by=v_uid,updated_at=now() where world_id=p_world_id and chunk_x=v_cx and chunk_y=v_cy;
 return jsonb_build_object('tile_id',v_tile,'item_id',p_item_id,'quantity',v_qty);
end;
$function$


CREATE OR REPLACE FUNCTION orbit_private.orbit_plant_seed(p_world_id uuid, p_tile_x integer, p_tile_y integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=auth.uid();v_px integer;v_py integer;v_data jsonb;v_tile integer;v_below integer;v_cx integer;v_cy integer;v_ox integer;v_oy integer;v_have bigint;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_tile_x<0 or p_tile_x>219 or p_tile_y<1 or p_tile_y>88 then raise exception 'TILE_OUT_OF_RANGE'; end if;
 select pos_x,pos_y into v_px,v_py from public.player_profiles where user_id=v_uid and last_world_id=p_world_id for update;
 if not found then raise exception 'PLAYER_NOT_IN_WORLD'; end if;
 if sqrt(power((p_tile_x-v_px)::double precision,2)+power((p_tile_y-v_py)::double precision,2))>4.5 then raise exception 'TOO_FAR'; end if;
 perform orbit_private.orbit_assert_chunk_access(p_world_id,p_tile_x,p_tile_y);
 v_cx:=p_tile_x/16;v_cy:=p_tile_y/16;v_ox:=p_tile_x%16;v_oy:=p_tile_y%16;
 perform public.orbit_get_chunk(p_world_id,v_cx,v_cy);
 select tile_data into v_data from public.world_chunks where world_id=p_world_id and chunk_x=v_cx and chunk_y=v_cy for update;
 v_tile:=(v_data #>> array['tiles',v_oy::text,v_ox::text])::integer;
 v_below:=(v_data #>> array['tiles',(v_oy+1)::text,v_ox::text])::integer;
 if v_tile<>0 then raise exception 'TARGET_NOT_EMPTY'; end if;
 if v_below not in (1,2) then raise exception 'NEEDS_SOIL'; end if;
 select quantity into v_have from public.player_inventory where user_id=v_uid and item_id='glow_seed' for update;
 if coalesce(v_have,0)<1 then raise exception 'SEED_REQUIRED'; end if;
 update public.player_inventory set quantity=quantity-1,updated_at=now() where user_id=v_uid and item_id='glow_seed';
 delete from public.player_inventory where user_id=v_uid and item_id='glow_seed' and quantity<=0;
 v_data:=jsonb_set(v_data,array['tiles',v_oy::text,v_ox::text],'8'::jsonb,false);
 update public.world_chunks set tile_data=v_data,revision=revision+1,updated_by=v_uid,updated_at=now() where world_id=p_world_id and chunk_x=v_cx and chunk_y=v_cy;
 insert into public.world_plants(world_id,tile_x,tile_y,planted_by) values(p_world_id,p_tile_x,p_tile_y,v_uid);
 return jsonb_build_object('tile_id',8,'planted_at',now(),'growth_seconds',300);
end;
$function$

