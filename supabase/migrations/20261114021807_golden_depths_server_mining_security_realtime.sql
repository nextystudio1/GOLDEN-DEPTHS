-- Golden Depths: authoritative block mining, safe RPC wrappers, and world chunk realtime.
-- Generated from the verified live database definitions after the release QA changes.

DROP FUNCTION IF EXISTS public.golden_mine();

CREATE OR REPLACE FUNCTION private.golden_world_tile_at(p_x integer, p_y integer)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE STRICT
 SET search_path TO ''
AS $function$
declare
  v_surface integer;
  v_n double precision;
  v_roll double precision;
  v_tile integer;
  v_i integer;
  v_cx integer;
  v_cy integer;
  v_rx double precision;
  v_ry double precision;
  v_dx double precision;
  v_dy double precision;
begin
  if p_x < 0 or p_x >= 360 or p_y < 0 or p_y >= 120 then
    return -1;
  end if;
  if p_y >= 118 then
    return 7;
  end if;

  v_n := sin(p_x::double precision * 127.1 + 2::double precision * 311.7 + 9.2) * 43758.5453;
  v_roll := v_n - floor(v_n);
  v_surface := 22 + floor(
    sin(p_x::double precision * 0.075) * 2
    + sin(p_x::double precision * 0.021) * 4
    + v_roll * 2
  )::integer;

  if p_y < v_surface then
    return -1;
  elsif p_y = v_surface then
    v_tile := 1;
  elsif p_y < v_surface + 5 then
    v_tile := 0;
  else
    v_tile := 2;
  end if;

  v_n := sin(p_x::double precision * 127.1 + p_y::double precision * 311.7 + 9.2) * 43758.5453;
  v_roll := v_n - floor(v_n);
  if p_y > v_surface + 7 and v_roll > 0.987 then v_tile := 3; end if;
  if p_y > v_surface + 12 and v_roll > 0.993 then v_tile := 4; end if;
  if p_y > v_surface + 22 and v_roll > 0.994 then v_tile := 5; end if;
  if p_y > v_surface + 30 and v_roll > 0.997 then v_tile := 6; end if;

  for v_i in 0..149 loop
    v_n := sin(v_i::double precision * 127.1 + 3::double precision * 311.7 + 9.2) * 43758.5453;
    v_cx := 4 + floor((v_n - floor(v_n)) * 352)::integer;
    v_n := sin(v_i::double precision * 127.1 + 8::double precision * 311.7 + 9.2) * 43758.5453;
    v_cy := 30 + floor((v_n - floor(v_n)) * 62)::integer;
    v_n := sin(v_i::double precision * 127.1 + 4::double precision * 311.7 + 9.2) * 43758.5453;
    v_rx := 3 + (v_n - floor(v_n)) * 7;
    v_n := sin(v_i::double precision * 127.1 + 5::double precision * 311.7 + 9.2) * 43758.5453;
    v_ry := 2 + (v_n - floor(v_n)) * 4;
    v_dx := (p_x - v_cx)::double precision / v_rx;
    v_dy := (p_y - v_cy)::double precision / v_ry;
    if v_dx * v_dx + v_dy * v_dy < 1 then
      return -1;
    end if;
  end loop;
  return v_tile;
end
$function$;

CREATE OR REPLACE FUNCTION private.golden_craft(p_recipe_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_input text;
  v_required integer;
  v_output text;
  v_output_qty integer;
  v_available integer;
  v_output_name text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_recipe_code='crystal_lamp' then
    v_input:='crystal_shard';v_required:=2;v_output:='crystal_lamp';v_output_qty:=1;
  elsif p_recipe_code='stone_platform' then
    v_input:='copper_ore';v_required:=3;v_output:='stone_platform';v_output_qty:=5;
  else
    raise exception 'RECIPE_NOT_FOUND';
  end if;

  perform 1 from public.golden_player_state where user_id=v_uid for update;
  if not found then raise exception 'PLAYER_NOT_STARTED'; end if;
  select quantity into v_available from public.golden_inventory
  where user_id=v_uid and item_code=v_input for update;
  if not found or v_available<v_required then raise exception 'NOT_ENOUGH_MATERIALS'; end if;

  if v_available=v_required then
    delete from public.golden_inventory where user_id=v_uid and item_code=v_input;
  else
    update public.golden_inventory set quantity=quantity-v_required
    where user_id=v_uid and item_code=v_input;
  end if;

  insert into public.golden_inventory(user_id,item_code,quantity)
  values(v_uid,v_output,v_output_qty)
  on conflict(user_id,item_code) do update
    set quantity=public.golden_inventory.quantity+excluded.quantity;

  select name into v_output_name from public.golden_item_catalog where code=v_output;
  return jsonb_build_object('recipe_code',p_recipe_code,'item_code',v_output,'item_name',v_output_name,'quantity',v_output_qty);
end
$function$;

CREATE OR REPLACE FUNCTION private.golden_mine(p_x integer, p_y integer, p_player_x integer, p_player_y integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_state public.golden_player_state%rowtype;
  v_presence public.golden_player_presence%rowtype;
  v_tiles jsonb;
  v_tile integer;
  v_roll numeric;
  v_code text;
  v_name text;
  v_qty integer := 1;
  v_now timestamptz := clock_timestamp();
  v_crystal_rush boolean := false;
  v_rare_bonus numeric := 0;
  v_cx integer;
  v_cy integer;
  v_lx integer;
  v_ly integer;
  v_revision integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_x is null or p_y is null or p_player_x is null or p_player_y is null
     or p_x not between 0 and 359 or p_y not between 0 and 117
     or p_player_x not between 0 and 359 or p_player_y not between 0 and 117 then
    raise exception 'INVALID_MINE_TARGET';
  end if;

  select * into v_state
  from public.golden_player_state
  where user_id = v_uid
  for update;
  if not found then raise exception 'PLAYER_NOT_STARTED'; end if;
  if v_state.last_mined_at is not null and v_state.last_mined_at > v_now - interval '350 milliseconds' then
    raise exception 'MINING_TOO_FAST';
  end if;

  select * into v_presence
  from public.golden_player_presence
  where user_id = v_uid
    and world_id = 'main'
    and last_seen > v_now - interval '15 seconds';
  if not found then raise exception 'PRESENCE_NOT_READY'; end if;
  if (p_player_x - v_presence.x)^2 + (p_player_y - v_presence.y)^2 > 64 then
    raise exception 'PLAYER_POSITION_INVALID';
  end if;
  if (p_x - p_player_x)^2 + (p_y - p_player_y)^2 > 49 then
    raise exception 'BLOCK_TOO_FAR';
  end if;

  v_cx := p_x / 32;
  v_cy := p_y / 32;
  v_lx := p_x % 32;
  v_ly := p_y % 32;

  select tiles, revision into v_tiles, v_revision
  from public.golden_world_chunks
  where world_id = 'main' and chunk_x = v_cx and chunk_y = v_cy
  for update;

  if not found then
    select jsonb_agg(row_tiles order by ly) into v_tiles
    from (
      select ly,
        (select jsonb_agg(private.golden_world_tile_at(v_cx * 32 + lx, v_cy * 32 + ly) order by lx)
         from generate_series(0, 31) as lx) as row_tiles
      from generate_series(0, 31) as ly
    ) as rows_for_chunk;
    v_tile := coalesce((v_tiles -> v_ly ->> v_lx)::integer, -1);
    if v_tile < 0 or v_tile = 7 then raise exception 'BLOCK_NOT_MINABLE'; end if;
    v_tiles := jsonb_set(v_tiles, array[v_ly::text, v_lx::text], to_jsonb(-1), false);
    insert into public.golden_world_chunks(world_id, chunk_x, chunk_y, tiles, revision, updated_by)
    values ('main', v_cx, v_cy, v_tiles, 1, v_uid)
    on conflict (world_id, chunk_x, chunk_y) do nothing
    returning revision into v_revision;

    if v_revision is null then
      select tiles, revision into v_tiles, v_revision
      from public.golden_world_chunks
      where world_id = 'main' and chunk_x = v_cx and chunk_y = v_cy
      for update;
      v_tile := coalesce((v_tiles -> v_ly ->> v_lx)::integer, -1);
      if v_tile < 0 or v_tile = 7 then raise exception 'BLOCK_ALREADY_MINED'; end if;
      v_tiles := jsonb_set(v_tiles, array[v_ly::text, v_lx::text], to_jsonb(-1), false);
      update public.golden_world_chunks
      set tiles = v_tiles, revision = revision + 1, updated_by = v_uid, updated_at = v_now
      where world_id = 'main' and chunk_x = v_cx and chunk_y = v_cy
      returning revision into v_revision;
    end if;
  else
    v_tile := coalesce((v_tiles -> v_ly ->> v_lx)::integer, -1);
    if v_tile < 0 or v_tile = 7 then raise exception 'BLOCK_ALREADY_MINED'; end if;
    v_tiles := jsonb_set(v_tiles, array[v_ly::text, v_lx::text], to_jsonb(-1), false);
    update public.golden_world_chunks
    set tiles = v_tiles, revision = revision + 1, updated_by = v_uid, updated_at = v_now
    where world_id = 'main' and chunk_x = v_cx and chunk_y = v_cy
    returning revision into v_revision;
  end if;

  v_rare_bonus := least(12, greatest(0, (v_state.pickaxe_level - 1) * 1.5));
  select exists(
    select 1 from public.golden_world_events
    where code = 'crystal_rush' and is_published = true
      and starts_at <= v_now and ends_at >= v_now
  ) into v_crystal_rush;

  if v_tile = 3 then
    v_code := 'copper_ore';
  elsif v_tile = 4 then
    v_code := 'iron_ore';
  elsif v_tile = 5 then
    v_code := 'gold_ore';
  elsif v_tile = 6 then
    v_code := 'crystal_shard';
  else
    v_roll := random() * 100;
    if v_crystal_rush then
      v_code := case
        when v_roll < greatest(25, 45 - v_rare_bonus) then 'copper_ore'
        when v_roll < greatest(55, 72 - v_rare_bonus) then 'iron_ore'
        when v_roll < greatest(70, 84 - v_rare_bonus) then 'gold_ore'
        when v_roll < greatest(96, 98 - v_rare_bonus / 2) then 'crystal_shard'
        else 'ancient_gem'
      end;
    else
      v_code := case
        when v_roll < greatest(25, 48 - v_rare_bonus) then 'copper_ore'
        when v_roll < greatest(55, 78 - v_rare_bonus) then 'iron_ore'
        when v_roll < greatest(70, 92 - v_rare_bonus) then 'gold_ore'
        when v_roll < greatest(96, 99 - v_rare_bonus / 2) then 'crystal_shard'
        else 'ancient_gem'
      end;
    end if;
  end if;

  if v_state.pickaxe_level >= 4 and random() < 0.25 then v_qty := 2; end if;
  select name into v_name from public.golden_item_catalog where code = v_code;

  insert into public.golden_inventory(user_id, item_code, quantity)
  values (v_uid, v_code, v_qty)
  on conflict (user_id, item_code) do update
    set quantity = public.golden_inventory.quantity + excluded.quantity;

  update public.golden_player_state
  set total_mined = total_mined + v_qty,
      experience = experience + 5 * v_qty,
      level = greatest(1, 1 + floor((experience + 5 * v_qty) / 100)::integer),
      last_mined_at = v_now,
      updated_at = v_now
  where user_id = v_uid;

  return jsonb_build_object(
    'item_code', v_code,
    'item_name', v_name,
    'quantity', v_qty,
    'tile_type', v_tile,
    'chunk_x', v_cx,
    'chunk_y', v_cy,
    'chunk_revision', v_revision,
    'experience_gained', 5 * v_qty,
    'mined_at', v_now,
    'event_bonus', v_crystal_rush,
    'pickaxe_rare_bonus', v_rare_bonus
  );
end
$function$;

CREATE OR REPLACE FUNCTION private.golden_player_position_save(p_x integer, p_y integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid:=auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_x is null or p_y is null or p_x not between 0 and 359 or p_y not between 0 and 119 then
    raise exception 'INVALID_PLAYER_POSITION';
  end if;
  update public.golden_player_state
  set world_x=p_x,world_y=p_y,updated_at=now()
  where user_id=v_uid;
  if not found then raise exception 'PLAYER_NOT_STARTED'; end if;
  return jsonb_build_object('world_x',p_x,'world_y',p_y,'saved_at',now());
end
$function$;

CREATE OR REPLACE FUNCTION private.golden_presence_leave()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  delete from public.golden_player_presence where user_id=auth.uid();
$function$;

CREATE OR REPLACE FUNCTION private.golden_presence_update(p_world_id text, p_x integer, p_y integer, p_facing smallint, p_animation text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_uid uuid:=auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_world_id !~ '^[a-z0-9_-]{1,32}$' or p_x not between -1000000 and 1000000 or p_y not between 0 and 1000000 or p_facing not in (-1,1) or p_animation not in ('idle','walk','jump','mine') then raise exception 'INVALID_PRESENCE'; end if;
  insert into public.golden_player_presence(user_id,world_id,x,y,facing,animation,last_seen)
  values(v_uid,p_world_id,p_x,p_y,p_facing,p_animation,now())
  on conflict(user_id) do update set world_id=excluded.world_id,x=excluded.x,y=excluded.y,facing=excluded.facing,animation=excluded.animation,last_seen=now();
  return jsonb_build_object('ok',true,'last_seen',now());
end $function$;

CREATE OR REPLACE FUNCTION private.golden_sell_all()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_uid uuid := auth.uid(); v_total bigint; v_count bigint;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform 1 from public.golden_player_state where user_id=v_uid for update;
  if not found then raise exception 'PLAYER_NOT_STARTED'; end if;
  select coalesce(sum(i.quantity*c.sell_value),0),coalesce(sum(i.quantity),0)
    into v_total,v_count from public.golden_inventory i join public.golden_item_catalog c on c.code=i.item_code
    where i.user_id=v_uid;
  if v_count=0 then return jsonb_build_object('gold_earned',0,'items_sold',0); end if;
  delete from public.golden_inventory where user_id=v_uid;
  update public.golden_player_state set gold=gold+v_total,updated_at=now() where user_id=v_uid;
  insert into public.golden_ledger(user_id,delta,reason) values(v_uid,v_total,'sell_all_ores');
  return jsonb_build_object('gold_earned',v_total,'items_sold',v_count);
end $function$;

CREATE OR REPLACE FUNCTION private.golden_start(p_username text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_username text := lower(trim(p_username));
  v_candidate text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_username !~ '^[a-z0-9_]{3,20}$' then raise exception 'USERNAME_INVALID'; end if;

  if not exists(select 1 from public.golden_profiles where user_id=v_uid) then
    v_candidate := v_username;
    if exists(select 1 from public.golden_profiles where username=v_candidate and user_id<>v_uid) then
      v_candidate := left(v_username,15)||'_'||substr(replace(v_uid::text,'-',''),1,4);
    end if;
    insert into public.golden_profiles(user_id,username)
    values(v_uid,v_candidate)
    on conflict(user_id) do nothing;
  end if;

  insert into public.golden_player_state(user_id)
  values(v_uid)
  on conflict(user_id) do nothing;

  return (
    select jsonb_build_object(
      'username',p.username,'gold',s.gold,'level',s.level,
      'pickaxe_level',s.pickaxe_level,'total_mined',s.total_mined,
      'world_x',s.world_x,'world_y',s.world_y
    )
    from public.golden_profiles p
    join public.golden_player_state s on s.user_id=p.user_id
    where p.user_id=v_uid
  );
end
$function$;

CREATE OR REPLACE FUNCTION private.golden_trade_accept(p_offer_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_offer public.golden_trade_offers%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_offer from public.golden_trade_offers where id = p_offer_id for update;
  if not found or v_offer.status <> 'open' then raise exception 'OFFER_NOT_AVAILABLE'; end if;
  if v_offer.seller_id = v_uid then raise exception 'CANNOT_BUY_OWN_OFFER'; end if;
  perform 1 from public.golden_player_state where user_id = v_uid for update;
  if not found then raise exception 'PLAYER_NOT_STARTED'; end if;
  perform 1 from public.golden_player_state where user_id = v_offer.seller_id for update;
  if not found then raise exception 'SELLER_NOT_AVAILABLE'; end if;
  update public.golden_player_state
  set gold = gold - v_offer.gold_price, updated_at = now()
  where user_id = v_uid and gold >= v_offer.gold_price;
  if not found then raise exception 'NOT_ENOUGH_GOLD'; end if;
  update public.golden_player_state
  set gold = gold + v_offer.gold_price, updated_at = now()
  where user_id = v_offer.seller_id;
  insert into public.golden_inventory(user_id,item_code,quantity)
  values(v_uid,v_offer.item_code,v_offer.quantity)
  on conflict(user_id,item_code) do update
  set quantity = public.golden_inventory.quantity + excluded.quantity;
  update public.golden_trade_offers
  set status = 'completed', buyer_id = v_uid, updated_at = now()
  where id = p_offer_id;
  insert into public.golden_ledger(user_id,delta,reason,reference_id)
  values(v_uid,-v_offer.gold_price,'trade_purchase',p_offer_id),
        (v_offer.seller_id,v_offer.gold_price,'trade_sale',p_offer_id);
  return jsonb_build_object('offer_id',p_offer_id,'item_code',v_offer.item_code,'quantity',v_offer.quantity,'gold_paid',v_offer.gold_price);
end;
$function$;

CREATE OR REPLACE FUNCTION private.golden_trade_cancel(p_offer_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_offer public.golden_trade_offers%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_offer from public.golden_trade_offers where id = p_offer_id for update;
  if not found or v_offer.status <> 'open' then raise exception 'OFFER_NOT_AVAILABLE'; end if;
  if v_offer.seller_id <> v_uid then raise exception 'NOT_OFFER_OWNER'; end if;
  insert into public.golden_inventory(user_id,item_code,quantity)
  values(v_uid,v_offer.item_code,v_offer.quantity)
  on conflict(user_id,item_code) do update
  set quantity = public.golden_inventory.quantity + excluded.quantity;
  update public.golden_trade_offers
  set status = 'cancelled', updated_at = now()
  where id = p_offer_id;
  return jsonb_build_object('offer_id',p_offer_id,'returned_quantity',v_offer.quantity);
end;
$function$;

CREATE OR REPLACE FUNCTION private.golden_trade_create(p_item_code text, p_quantity integer, p_gold_price bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_available integer;
  v_offer uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_quantity is null or p_quantity<1 or p_quantity>10000 then raise exception 'INVALID_QUANTITY'; end if;
  if p_gold_price is null or p_gold_price<1 or p_gold_price>1000000000 then raise exception 'INVALID_PRICE'; end if;
  perform 1 from public.golden_player_state where user_id=v_uid for update;
  if not found then raise exception 'PLAYER_NOT_STARTED'; end if;

  select quantity into v_available from public.golden_inventory
  where user_id=v_uid and item_code=p_item_code for update;
  if not found or v_available<p_quantity then raise exception 'NOT_ENOUGH_ITEMS'; end if;

  if v_available=p_quantity then
    delete from public.golden_inventory where user_id=v_uid and item_code=p_item_code;
  else
    update public.golden_inventory set quantity=quantity-p_quantity
    where user_id=v_uid and item_code=p_item_code;
  end if;

  insert into public.golden_trade_offers(seller_id,item_code,quantity,gold_price,status)
  values(v_uid,p_item_code,p_quantity,p_gold_price,'open')
  returning id into v_offer;
  return jsonb_build_object('offer_id',v_offer,'item_code',p_item_code,'quantity',p_quantity,'gold_price',p_gold_price);
end
$function$;

CREATE OR REPLACE FUNCTION private.golden_upgrade_pickaxe()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_uid uuid := auth.uid(); v_state public.golden_player_state%rowtype; v_cost bigint;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_state from public.golden_player_state where user_id=v_uid for update;
  if not found then raise exception 'PLAYER_NOT_STARTED'; end if;
  v_cost := floor(180 * power(1.68, v_state.pickaxe_level-1))::bigint;
  if v_state.gold < v_cost then raise exception 'NOT_ENOUGH_GOLD'; end if;
  update public.golden_player_state set gold=gold-v_cost,pickaxe_level=pickaxe_level+1,updated_at=now() where user_id=v_uid;
  insert into public.golden_ledger(user_id,delta,reason) values(v_uid,-v_cost,'pickaxe_upgrade');
  return jsonb_build_object('cost',v_cost,'pickaxe_level',v_state.pickaxe_level+1);
end $function$;

CREATE OR REPLACE FUNCTION private.golden_world_save_chunk(p_world_id text, p_chunk_x integer, p_chunk_y integer, p_tiles jsonb, p_expected_revision integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_uid uuid:=auth.uid(); v_rev integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_world_id !~ '^[a-z0-9_-]{1,32}$' or p_chunk_x not between -10000 and 10000 or p_chunk_y not between 0 and 10000 then raise exception 'INVALID_CHUNK'; end if;
  if jsonb_typeof(p_tiles)<>'array' or jsonb_array_length(p_tiles)<>32 then raise exception 'INVALID_CHUNK_HEIGHT'; end if;
  if exists(select 1 from jsonb_array_elements(p_tiles) r where jsonb_typeof(r)<>'array' or jsonb_array_length(r)<>32) then raise exception 'INVALID_CHUNK_WIDTH'; end if;
  if exists(select 1 from jsonb_array_elements(p_tiles) r, jsonb_array_elements(r) t where jsonb_typeof(t)<>'number' or (t::text)::integer not between -1 and 7) then raise exception 'INVALID_TILE_VALUE'; end if;
  insert into public.golden_world_chunks(world_id,chunk_x,chunk_y,tiles,revision,updated_by)
  values(p_world_id,p_chunk_x,p_chunk_y,p_tiles,1,v_uid)
  on conflict(world_id,chunk_x,chunk_y) do update
    set tiles=excluded.tiles,revision=public.golden_world_chunks.revision+1,updated_by=v_uid,updated_at=now()
    where public.golden_world_chunks.revision=p_expected_revision
  returning revision into v_rev;
  if v_rev is null then raise exception 'CHUNK_REVISION_CONFLICT'; end if;
  return jsonb_build_object('world_id',p_world_id,'chunk_x',p_chunk_x,'chunk_y',p_chunk_y,'revision',v_rev);
end $function$;

CREATE OR REPLACE FUNCTION public.golden_craft(p_recipe_code text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$SELECT private.golden_craft($1)$function$;

CREATE OR REPLACE FUNCTION public.golden_mine(p_x integer, p_y integer, p_player_x integer, p_player_y integer)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$SELECT private.golden_mine($1, $2, $3, $4)$function$;

CREATE OR REPLACE FUNCTION public.golden_player_position_save(p_x integer, p_y integer)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$SELECT private.golden_player_position_save($1, $2)$function$;

CREATE OR REPLACE FUNCTION public.golden_presence_leave()
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$SELECT private.golden_presence_leave()$function$;

CREATE OR REPLACE FUNCTION public.golden_presence_update(p_world_id text, p_x integer, p_y integer, p_facing smallint, p_animation text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$SELECT private.golden_presence_update($1, $2, $3, $4, $5)$function$;

CREATE OR REPLACE FUNCTION public.golden_sell_all()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$SELECT private.golden_sell_all()$function$;

CREATE OR REPLACE FUNCTION public.golden_start(p_username text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$SELECT private.golden_start($1)$function$;

CREATE OR REPLACE FUNCTION public.golden_trade_accept(p_offer_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$SELECT private.golden_trade_accept($1)$function$;

CREATE OR REPLACE FUNCTION public.golden_trade_cancel(p_offer_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$SELECT private.golden_trade_cancel($1)$function$;

CREATE OR REPLACE FUNCTION public.golden_trade_create(p_item_code text, p_quantity integer, p_gold_price bigint)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$SELECT private.golden_trade_create($1, $2, $3)$function$;

CREATE OR REPLACE FUNCTION public.golden_upgrade_pickaxe()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$SELECT private.golden_upgrade_pickaxe()$function$;

CREATE OR REPLACE FUNCTION public.golden_world_save_chunk(p_world_id text, p_chunk_x integer, p_chunk_y integer, p_tiles jsonb, p_expected_revision integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$SELECT private.golden_world_save_chunk($1, $2, $3, $4, $5)$function$;

GRANT USAGE ON SCHEMA private TO authenticated;
REVOKE USAGE ON SCHEMA private FROM anon;

REVOKE ALL ON FUNCTION private.golden_craft(p_recipe_code text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.golden_craft(p_recipe_code text) TO authenticated;
REVOKE ALL ON FUNCTION private.golden_mine(p_x integer, p_y integer, p_player_x integer, p_player_y integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.golden_mine(p_x integer, p_y integer, p_player_x integer, p_player_y integer) TO authenticated;
REVOKE ALL ON FUNCTION private.golden_player_position_save(p_x integer, p_y integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.golden_player_position_save(p_x integer, p_y integer) TO authenticated;
REVOKE ALL ON FUNCTION private.golden_presence_leave() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.golden_presence_leave() TO authenticated;
REVOKE ALL ON FUNCTION private.golden_presence_update(p_world_id text, p_x integer, p_y integer, p_facing smallint, p_animation text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.golden_presence_update(p_world_id text, p_x integer, p_y integer, p_facing smallint, p_animation text) TO authenticated;
REVOKE ALL ON FUNCTION private.golden_sell_all() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.golden_sell_all() TO authenticated;
REVOKE ALL ON FUNCTION private.golden_start(p_username text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.golden_start(p_username text) TO authenticated;
REVOKE ALL ON FUNCTION private.golden_trade_accept(p_offer_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.golden_trade_accept(p_offer_id uuid) TO authenticated;
REVOKE ALL ON FUNCTION private.golden_trade_cancel(p_offer_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.golden_trade_cancel(p_offer_id uuid) TO authenticated;
REVOKE ALL ON FUNCTION private.golden_trade_create(p_item_code text, p_quantity integer, p_gold_price bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.golden_trade_create(p_item_code text, p_quantity integer, p_gold_price bigint) TO authenticated;
REVOKE ALL ON FUNCTION private.golden_upgrade_pickaxe() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.golden_upgrade_pickaxe() TO authenticated;
REVOKE ALL ON FUNCTION private.golden_world_save_chunk(p_world_id text, p_chunk_x integer, p_chunk_y integer, p_tiles jsonb, p_expected_revision integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.golden_world_save_chunk(p_world_id text, p_chunk_x integer, p_chunk_y integer, p_tiles jsonb, p_expected_revision integer) TO authenticated;
REVOKE ALL ON FUNCTION private.golden_world_tile_at(p_x integer, p_y integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.golden_craft(p_recipe_code text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.golden_craft(p_recipe_code text) TO authenticated;
REVOKE ALL ON FUNCTION public.golden_mine(p_x integer, p_y integer, p_player_x integer, p_player_y integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.golden_mine(p_x integer, p_y integer, p_player_x integer, p_player_y integer) TO authenticated;
REVOKE ALL ON FUNCTION public.golden_player_position_save(p_x integer, p_y integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.golden_player_position_save(p_x integer, p_y integer) TO authenticated;
REVOKE ALL ON FUNCTION public.golden_presence_leave() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.golden_presence_leave() TO authenticated;
REVOKE ALL ON FUNCTION public.golden_presence_update(p_world_id text, p_x integer, p_y integer, p_facing smallint, p_animation text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.golden_presence_update(p_world_id text, p_x integer, p_y integer, p_facing smallint, p_animation text) TO authenticated;
REVOKE ALL ON FUNCTION public.golden_sell_all() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.golden_sell_all() TO authenticated;
REVOKE ALL ON FUNCTION public.golden_start(p_username text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.golden_start(p_username text) TO authenticated;
REVOKE ALL ON FUNCTION public.golden_trade_accept(p_offer_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.golden_trade_accept(p_offer_id uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.golden_trade_cancel(p_offer_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.golden_trade_cancel(p_offer_id uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.golden_trade_create(p_item_code text, p_quantity integer, p_gold_price bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.golden_trade_create(p_item_code text, p_quantity integer, p_gold_price bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.golden_upgrade_pickaxe() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.golden_upgrade_pickaxe() TO authenticated;
REVOKE ALL ON FUNCTION public.golden_world_save_chunk(p_world_id text, p_chunk_x integer, p_chunk_y integer, p_tiles jsonb, p_expected_revision integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.golden_world_save_chunk(p_world_id text, p_chunk_x integer, p_chunk_y integer, p_tiles jsonb, p_expected_revision integer) TO authenticated;

CREATE INDEX IF NOT EXISTS golden_player_trades_initiator_id_idx
  ON public.golden_player_trades(initiator_id);
CREATE INDEX IF NOT EXISTS golden_player_trades_recipient_id_idx
  ON public.golden_player_trades(recipient_id);
CREATE INDEX IF NOT EXISTS golden_player_trades_status_expires_idx
  ON public.golden_player_trades(status, expires_at);
CREATE INDEX IF NOT EXISTS golden_player_presence_world_last_seen_idx
  ON public.golden_player_presence(world_id, last_seen DESC);

DO $publication$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'golden_world_chunks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.golden_world_chunks;
  END IF;
END
$publication$;
