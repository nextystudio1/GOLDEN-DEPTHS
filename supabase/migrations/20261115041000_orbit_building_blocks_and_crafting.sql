-- ORBIT: four functional crafted building blocks with server-authoritative mining and placement.
-- Existing worlds and player inventories are preserved.
insert into public.item_catalog(item_id,display_name,category,rarity,stack_limit,is_placeable,is_tradeable,item_data)
values
('amber_plank_block','Amber Plank Block','block','common',999,true,true,jsonb_build_object('tile',9,'description','Papan kayu amber untuk lantai dan bangunan. Dibuat dari kayu amber dan tanah.')),
('copper_brick_block','Copper Brick Block','block','uncommon',999,true,true,jsonb_build_object('tile',10,'description','Bata tembaga dekoratif untuk dinding dan struktur. Dibuat dari bijih tembaga dan kayu.')),
('crystal_glass_block','Crystal Glass Block','block','rare',999,true,true,jsonb_build_object('tile',11,'description','Kaca kristal berkilau untuk jendela dan dekorasi. Dibuat dari kristal dan kayu.')),
('moss_stone_block','Moss Stone Block','block','uncommon',999,true,true,jsonb_build_object('tile',12,'description','Batu berlumut untuk jalur taman dan bangunan alami. Dibuat dari batu dan Glow Seed.'))
on conflict(item_id) do update set display_name=excluded.display_name,category=excluded.category,rarity=excluded.rarity,stack_limit=excluded.stack_limit,is_placeable=excluded.is_placeable,is_tradeable=excluded.is_tradeable,item_data=excluded.item_data;

create or replace function orbit_private.orbit_mine_tile(p_world_id uuid,p_tile_x integer,p_tile_y integer)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_uid uuid:=auth.uid();v_px integer;v_py integer;v_tool text;v_last_mined timestamptz;v_required_ms integer;v_data jsonb;v_tile integer;v_item text;v_cx integer;v_cy integer;v_ox integer;v_oy integer;v_qty bigint;v_have bigint;v_stack_limit integer;v_xp integer;v_experience bigint;v_level integer;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_tile_x<0 or p_tile_x>219 or p_tile_y<0 or p_tile_y>89 then raise exception 'TILE_OUT_OF_RANGE'; end if;
 select pos_x,pos_y,equipped_tool,last_mined_at into v_px,v_py,v_tool,v_last_mined from public.player_profiles where user_id=v_uid and last_world_id=p_world_id for update;
 if not found then raise exception 'PLAYER_NOT_IN_WORLD'; end if;
 if sqrt(power((p_tile_x-v_px)::double precision,2)+power((p_tile_y-v_py)::double precision,2))>4.5 then raise exception 'TOO_FAR'; end if;
 perform orbit_private.orbit_assert_chunk_access(p_world_id,p_tile_x,p_tile_y);
 v_cx:=p_tile_x/16;v_cy:=p_tile_y/16;v_ox:=p_tile_x%16;v_oy:=p_tile_y%16;
 perform public.orbit_get_chunk(p_world_id,v_cx,v_cy);
 select tile_data into v_data from public.world_chunks where world_id=p_world_id and chunk_x=v_cx and chunk_y=v_cy for update;
 v_tile:=(v_data #>> array['tiles',v_oy::text,v_ox::text])::integer;
 if v_tile=0 then raise exception 'EMPTY_TILE'; end if;
 v_item:=case v_tile when 1 then 'grass_block' when 2 then 'soil_block' when 3 then 'slate_block' when 4 then 'copper_ore' when 5 then 'sky_crystal' when 6 then 'amber_wood' when 7 then 'amber_wood' when 9 then 'amber_plank_block' when 10 then 'copper_brick_block' when 11 then 'crystal_glass_block' when 12 then 'moss_stone_block' else null end;
 if v_item is null then raise exception 'UNSUPPORTED_TILE'; end if;
 v_required_ms:=case v_tile when 1 then 420 when 2 then 300 when 3 then 850 when 4 then 1150 when 5 then 1500 when 6 then 520 when 7 then 180 when 9 then 520 when 10 then 780 when 11 then 1100 when 12 then 650 else 650 end;
 if v_tool='copper_pickaxe' then v_required_ms:=ceil(v_required_ms*.72)::integer; elsif v_tool='stone_pickaxe' then v_required_ms:=ceil(v_required_ms*.88)::integer; elsif v_tool='crystal_pickaxe' then v_required_ms:=ceil(v_required_ms*.52)::integer; end if;
 if v_last_mined is not null and extract(epoch from (clock_timestamp()-v_last_mined))*1000<v_required_ms then raise exception 'MINING_COOLDOWN'; end if;
 select stack_limit into v_stack_limit from public.item_catalog where item_id=v_item;
 if not found then raise exception 'ITEM_CATALOG_MISSING'; end if;
 select quantity into v_have from public.player_inventory where user_id=v_uid and item_id=v_item for update;
 if coalesce(v_have,0)>=v_stack_limit then raise exception 'INVENTORY_LIMIT'; end if;
 v_data:=jsonb_set(v_data,array['tiles',v_oy::text,v_ox::text],'0'::jsonb,false);
 update public.world_chunks set tile_data=v_data,revision=revision+1,updated_by=v_uid,updated_at=now() where world_id=p_world_id and chunk_x=v_cx and chunk_y=v_cy;
 insert into public.player_inventory(user_id,item_id,quantity) values(v_uid,v_item,1) on conflict(user_id,item_id) do update set quantity=public.player_inventory.quantity+1,updated_at=now() returning quantity into v_qty;
 v_xp:=case v_tile when 1 then 1 when 2 then 1 when 3 then 2 when 4 then 4 when 5 then 8 when 10 then 3 when 11 then 5 when 12 then 3 else 2 end;
 update public.player_profiles set last_mined_at=clock_timestamp(),experience=experience+v_xp,level=least(1000,floor(sqrt((experience+v_xp)::numeric/100))::integer+1),updated_at=now() where user_id=v_uid returning experience,level into v_experience,v_level;
 return jsonb_build_object('tile_id',v_tile,'item_id',v_item,'quantity',v_qty,'mining_ms',v_required_ms,'xp_gained',v_xp,'experience',v_experience,'level',v_level);
end;
$function$;

create or replace function orbit_private.orbit_place_tile(p_world_id uuid,p_tile_x integer,p_tile_y integer,p_item_id text)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_uid uuid:=auth.uid();v_px integer;v_py integer;v_data jsonb;v_tile integer;v_cx integer;v_cy integer;v_ox integer;v_oy integer;v_qty bigint;v_placeable boolean;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_tile_x<0 or p_tile_x>219 or p_tile_y<0 or p_tile_y>89 then raise exception 'TILE_OUT_OF_RANGE'; end if;
 select pos_x,pos_y into v_px,v_py from public.player_profiles where user_id=v_uid and last_world_id=p_world_id for update;
 if not found then raise exception 'PLAYER_NOT_IN_WORLD'; end if;
 if sqrt(power((p_tile_x-v_px)::double precision,2)+power((p_tile_y-v_py)::double precision,2))>4.5 then raise exception 'TOO_FAR'; end if;
 perform orbit_private.orbit_assert_chunk_access(p_world_id,p_tile_x,p_tile_y);
 select (item_data->>'tile')::integer,is_placeable into v_tile,v_placeable from public.item_catalog where item_id=p_item_id;
 if not found or not v_placeable or v_tile not in (1,2,3,9,10,11,12) then raise exception 'ITEM_NOT_PLACEABLE'; end if;
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
$function$;

create or replace function orbit_private.orbit_craft_item(p_recipe_id text)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_uid uuid:=auth.uid();v_input_a text;v_qty_a integer;v_input_b text;v_qty_b integer;v_output text;v_output_qty integer:=1;v_have bigint;v_output_have bigint;v_stack_limit integer;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text,0));
 case p_recipe_id
  when 'glow_seed' then v_input_a:='soil_block';v_qty_a:=4;v_input_b:='amber_wood';v_qty_b:=1;v_output:='glow_seed';v_output_qty:=2;
  when 'stone_pickaxe' then v_input_a:='slate_block';v_qty_a:=12;v_input_b:='amber_wood';v_qty_b:=8;v_output:='stone_pickaxe';
  when 'copper_pickaxe' then v_input_a:='copper_ore';v_qty_a:=12;v_input_b:='amber_wood';v_qty_b:=8;v_output:='copper_pickaxe';
  when 'crystal_pickaxe' then v_input_a:='sky_crystal';v_qty_a:=10;v_input_b:='amber_wood';v_qty_b:=12;v_output:='crystal_pickaxe';
  when 'amber_plank_block' then v_input_a:='amber_wood';v_qty_a:=3;v_input_b:='soil_block';v_qty_b:=1;v_output:='amber_plank_block';v_output_qty:=2;
  when 'copper_brick_block' then v_input_a:='copper_ore';v_qty_a:=4;v_input_b:='amber_wood';v_qty_b:=2;v_output:='copper_brick_block';v_output_qty:=2;
  when 'crystal_glass_block' then v_input_a:='sky_crystal';v_qty_a:=3;v_input_b:='amber_wood';v_qty_b:=2;v_output:='crystal_glass_block';
  when 'moss_stone_block' then v_input_a:='slate_block';v_qty_a:=3;v_input_b:='glow_seed';v_qty_b:=1;v_output:='moss_stone_block';v_output_qty:=2;
  else raise exception 'UNKNOWN_RECIPE';
 end case;
 select stack_limit into v_stack_limit from public.item_catalog where item_id=v_output;
 if not found then raise exception 'RECIPE_OUTPUT_MISSING'; end if;
 select quantity into v_output_have from public.player_inventory where user_id=v_uid and item_id=v_output for update;
 if coalesce(v_output_have,0)+v_output_qty>v_stack_limit then raise exception 'OUTPUT_STACK_LIMIT'; end if;
 select quantity into v_have from public.player_inventory where user_id=v_uid and item_id=v_input_a for update;
 if coalesce(v_have,0)<v_qty_a then raise exception 'MATERIALS_MISSING'; end if;
 select quantity into v_have from public.player_inventory where user_id=v_uid and item_id=v_input_b for update;
 if coalesce(v_have,0)<v_qty_b then raise exception 'MATERIALS_MISSING'; end if;
 update public.player_inventory set quantity=quantity-v_qty_a,updated_at=now() where user_id=v_uid and item_id=v_input_a;
 delete from public.player_inventory where user_id=v_uid and item_id=v_input_a and quantity<=0;
 update public.player_inventory set quantity=quantity-v_qty_b,updated_at=now() where user_id=v_uid and item_id=v_input_b;
 delete from public.player_inventory where user_id=v_uid and item_id=v_input_b and quantity<=0;
 insert into public.player_inventory(user_id,item_id,quantity) values(v_uid,v_output,v_output_qty)
 on conflict(user_id,item_id) do update set quantity=public.player_inventory.quantity+excluded.quantity,updated_at=now();
 return jsonb_build_object('recipe_id',p_recipe_id,'item_id',v_output,'quantity',v_output_qty);
end;
$function$;
