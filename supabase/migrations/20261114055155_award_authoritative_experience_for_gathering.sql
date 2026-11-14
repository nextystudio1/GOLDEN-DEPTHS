create or replace function orbit_private.orbit_mine_tile(p_world_id uuid,p_tile_x integer,p_tile_y integer)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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
 update public.player_profiles set
  last_mined_at=clock_timestamp(),
  experience=experience+v_xp,
  level=least(1000,floor(sqrt((experience+v_xp)::numeric/100))::integer+1),
  updated_at=now()
 where user_id=v_uid returning experience,level into v_experience,v_level;
 return jsonb_build_object('tile_id',v_tile,'item_id',v_item,'quantity',v_qty,'mining_ms',v_required_ms,'xp_gained',v_xp,'experience',v_experience,'level',v_level);
end;
$function$;

create or replace function orbit_private.orbit_harvest_crop(p_world_id uuid,p_tile_x integer,p_tile_y integer)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare v_uid uuid:=auth.uid();v_px integer;v_py integer;v_data jsonb;v_plant public.world_plants;v_tile integer;v_cx integer;v_cy integer;v_ox integer;v_oy integer;v_have bigint;v_experience bigint;v_level integer;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 select pos_x,pos_y into v_px,v_py from public.player_profiles where user_id=v_uid and last_world_id=p_world_id for update;
 if not found then raise exception 'PLAYER_NOT_IN_WORLD'; end if;
 if sqrt(power((p_tile_x-v_px)::double precision,2)+power((p_tile_y-v_py)::double precision,2))>4.5 then raise exception 'TOO_FAR'; end if;
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
$function$;
