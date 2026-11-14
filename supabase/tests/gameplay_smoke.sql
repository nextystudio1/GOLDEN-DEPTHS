-- GOLDEN DEPTHS transactional backend smoke test.
-- Run as the Supabase SQL editor/database owner.
-- The final ROLLBACK removes both temporary auth users and all test rows.
begin;

do $golden_depths_smoke$
declare
  v_seller uuid := gen_random_uuid();
  v_buyer uuid := gen_random_uuid();
  v_offer uuid;
  v_cancel_offer uuid;
  v_result jsonb;
  v_tiles jsonb;
  v_qty integer;
  v_gold bigint;
  v_level integer;
  v_world_x integer;
  v_world_y integer;
  v_username_seller text;
  v_username_buyer text;
  v_count integer;
begin
  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
  values
    (v_seller,'authenticated','authenticated','gd-smoke-'||replace(v_seller::text,'-','')||'@example.test','',now(),now(),now()),
    (v_buyer,'authenticated','authenticated','gd-smoke-'||replace(v_buyer::text,'-','')||'@example.test','',now(),now(),now());

  -- Start both players with the same requested username; the second must get a unique suffix.
  perform set_config('request.jwt.claim.sub',v_seller::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_seller,'role','authenticated','aud','authenticated')::text,true);
  perform public.golden_start('gdsmoke');
  insert into public.golden_inventory(user_id,item_code,quantity) values(v_seller,'copper_ore',5);
  update public.golden_player_state set gold=0 where user_id=v_seller;

  perform set_config('request.jwt.claim.sub',v_buyer::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_buyer,'role','authenticated','aud','authenticated')::text,true);
  perform public.golden_start('gdsmoke');
  update public.golden_player_state set gold=500 where user_id=v_buyer;

  select username into v_username_seller from public.golden_profiles where user_id=v_seller;
  select username into v_username_buyer from public.golden_profiles where user_id=v_buyer;
  if v_username_seller=v_username_buyer then raise exception 'USERNAME_COLLISION_TEST_FAILED'; end if;

  -- Seller escrows two ores; buyer pays; both balances and inventory must update.
  perform set_config('request.jwt.claim.sub',v_seller::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_seller,'role','authenticated','aud','authenticated')::text,true);
  v_result:=public.golden_trade_create('copper_ore',2,80);
  v_offer:=(v_result->>'offer_id')::uuid;
  select quantity into v_qty from public.golden_inventory where user_id=v_seller and item_code='copper_ore';
  if v_qty<>3 then raise exception 'TRADE_ESCROW_TEST_FAILED'; end if;

  perform set_config('request.jwt.claim.sub',v_buyer::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_buyer,'role','authenticated','aud','authenticated')::text,true);
  perform public.golden_trade_accept(v_offer);
  select quantity into v_qty from public.golden_inventory where user_id=v_buyer and item_code='copper_ore';
  if v_qty<>2 then raise exception 'TRADE_BUYER_ITEM_TEST_FAILED'; end if;
  select gold into v_gold from public.golden_player_state where user_id=v_buyer;
  if v_gold<>420 then raise exception 'TRADE_BUYER_GOLD_TEST_FAILED'; end if;

  perform set_config('request.jwt.claim.sub',v_seller::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_seller,'role','authenticated','aud','authenticated')::text,true);
  select gold into v_gold from public.golden_player_state where user_id=v_seller;
  if v_gold<>80 then raise exception 'TRADE_SELLER_GOLD_TEST_FAILED'; end if;
  v_result:=public.golden_trade_create('copper_ore',1,50);
  v_cancel_offer:=(v_result->>'offer_id')::uuid;
  perform public.golden_trade_cancel(v_cancel_offer);
  select quantity into v_qty from public.golden_inventory where user_id=v_seller and item_code='copper_ore';
  if v_qty<>3 then raise exception 'TRADE_CANCEL_RETURN_TEST_FAILED'; end if;

  -- Online crafting consumes server inventory atomically.
  v_result:=public.golden_craft('stone_platform');
  select quantity into v_qty from public.golden_inventory where user_id=v_seller and item_code='stone_platform';
  if v_qty<>5 then raise exception 'STONE_PLATFORM_CRAFT_TEST_FAILED'; end if;
  select quantity into v_qty from public.golden_inventory where user_id=v_seller and item_code='copper_ore';
  if coalesce(v_qty,0)<>0 then raise exception 'STONE_PLATFORM_INGREDIENT_TEST_FAILED'; end if;

  perform set_config('request.jwt.claim.sub',v_buyer::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_buyer,'role','authenticated','aud','authenticated')::text,true);
  insert into public.golden_inventory(user_id,item_code,quantity) values(v_buyer,'crystal_shard',2);
  v_result:=public.golden_craft('crystal_lamp');
  select quantity into v_qty from public.golden_inventory where user_id=v_buyer and item_code='crystal_lamp';
  if v_qty<>1 then raise exception 'CRYSTAL_LAMP_CRAFT_TEST_FAILED'; end if;

  -- Pickaxe upgrade pricing and rarity progression.
  perform set_config('request.jwt.claim.sub',v_buyer::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_buyer,'role','authenticated','aud','authenticated')::text,true);
  v_result:=public.golden_upgrade_pickaxe();
  if (v_result->>'cost')::integer<>180 or (v_result->>'pickaxe_level')::integer<>2 then
    raise exception 'PICKAXE_UPGRADE_TEST_FAILED';
  end if;

  v_result:=public.golden_player_position_save(180,20);
  select world_x,world_y into v_world_x,v_world_y from public.golden_player_state where user_id=v_buyer;
  if v_world_x<>180 or v_world_y<>20 then raise exception 'PLAYER_POSITION_SAVE_TEST_FAILED'; end if;
  v_result:=public.golden_start('gdsmoke');
  if (v_result->>'world_x')::integer<>180 or (v_result->>'world_y')::integer<>20 then raise exception 'PLAYER_POSITION_RESTORE_TEST_FAILED'; end if;

  -- 32x32 chunk save, optimistic revision conflict, and player presence upsert.
  select jsonb_agg(row_data order by y) into v_tiles
  from (select y,jsonb_agg(-1 order by x) row_data
        from generate_series(0,31) y cross join generate_series(0,31) x group by y) rows32;
  v_result:=public.golden_world_save_chunk('gd-smoke',9999,9999,v_tiles,0);
  if (v_result->>'revision')::integer<>1 then raise exception 'CHUNK_SAVE_TEST_FAILED'; end if;
  begin
    perform public.golden_world_save_chunk('gd-smoke',9999,9999,v_tiles,0);
    raise exception 'CHUNK_REVISION_CONFLICT_TEST_FAILED';
  exception when others then
    if sqlerrm<>'CHUNK_REVISION_CONFLICT' then raise; end if;
  end;
  perform public.golden_presence_update('gd-smoke',20,25,1::smallint,'idle');
  select count(*) into v_count from public.golden_player_presence where user_id=v_buyer;
  if v_count<>1 then raise exception 'PRESENCE_UPSERT_TEST_FAILED'; end if;

  -- Server mining rewards, pickaxe rarity bonus, and server cooldown.
  v_result:=public.golden_mine();
  if (v_result->>'pickaxe_rare_bonus')::numeric<>1.5 then raise exception 'MINING_PICKAXE_BONUS_TEST_FAILED'; end if;
  begin
    perform public.golden_mine();
    raise exception 'MINING_COOLDOWN_TEST_FAILED';
  exception when others then
    if sqlerrm<>'MINING_TOO_FAST' then raise; end if;
  end;

  raise notice 'GOLDEN_DEPTHS_BACKEND_SMOKE_TESTS_PASSED';
end
$golden_depths_smoke$;

rollback;
