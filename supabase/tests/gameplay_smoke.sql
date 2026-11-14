-- GOLDEN DEPTHS transactional backend smoke test.
-- Run as the Supabase SQL editor/database owner.
-- All temporary users, trades and world edits are rolled back at the end.
begin;

do $golden_depths_smoke$
declare
  v_seller uuid := gen_random_uuid();
  v_buyer uuid := gen_random_uuid();
  v_delete_user uuid := gen_random_uuid();
  v_offer uuid;
  v_cancel_offer uuid;
  v_direct_trade uuid;
  v_result jsonb;
  v_tiles jsonb;
  v_qty integer;
  v_gold bigint;
  v_gold_seller bigint;
  v_gold_buyer bigint;
  v_level integer;
  v_world_x integer;
  v_world_y integer;
  v_username_seller text;
  v_username_buyer text;
  v_count integer;
  v_mine_x integer;
  v_mine_y integer;
  v_mine_tile integer;
  v_mined_tile integer;
  v_chunk_revision integer;
begin
  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
  values
    (v_seller,'authenticated','authenticated','gd-smoke-'||replace(v_seller::text,'-','')||'@example.test','',now(),now(),now()),
    (v_buyer,'authenticated','authenticated','gd-smoke-'||replace(v_buyer::text,'-','')||'@example.test','',now(),now(),now()),
    (v_delete_user,'authenticated','authenticated','gd-delete-'||replace(v_delete_user::text,'-','')||'@example.test','',now(),now(),now());

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
  v_result:=public.golden_upgrade_pickaxe();
  if (v_result->>'cost')::integer<>180 or (v_result->>'pickaxe_level')::integer<>2 then
    raise exception 'PICKAXE_UPGRADE_TEST_FAILED';
  end if;

  v_result:=public.golden_player_position_save(180,20);
  select world_x,world_y into v_world_x,v_world_y from public.golden_player_state where user_id=v_buyer;
  if v_world_x<>180 or v_world_y<>20 then raise exception 'PLAYER_POSITION_SAVE_TEST_FAILED'; end if;
  v_result:=public.golden_start('gdsmoke');
  if (v_result->>'world_x')::integer<>180 or (v_result->>'world_y')::integer<>20 then raise exception 'PLAYER_POSITION_RESTORE_TEST_FAILED'; end if;

  -- 32x32 chunk save, optimistic revision conflict, and presence upsert.
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

  -- Direct player trade: request, accept, escrow both offers, and require two confirmations.
  insert into public.golden_inventory(user_id,item_code,quantity)
  values (v_seller,'copper_ore',4),(v_buyer,'iron_ore',3);
  perform set_config('request.jwt.claim.sub',v_buyer::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_buyer,'role','authenticated','aud','authenticated')::text,true);
  perform public.golden_presence_update('main',102,30,-1::smallint,'idle');

  perform set_config('request.jwt.claim.sub',v_seller::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_seller,'role','authenticated','aud','authenticated')::text,true);
  perform public.golden_presence_update('main',100,30,1::smallint,'idle');
  v_result:=public.golden_player_trade_request(v_buyer);
  v_direct_trade:=(v_result->>'trade_id')::uuid;

  perform set_config('request.jwt.claim.sub',v_buyer::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_buyer,'role','authenticated','aud','authenticated')::text,true);
  perform public.golden_player_trade_respond(v_direct_trade,true);
  perform public.golden_player_trade_offer(v_direct_trade,'[{"item_code":"iron_ore","quantity":1}]'::jsonb,20);

  perform set_config('request.jwt.claim.sub',v_seller::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_seller,'role','authenticated','aud','authenticated')::text,true);
  perform public.golden_player_trade_offer(v_direct_trade,'[{"item_code":"copper_ore","quantity":2}]'::jsonb,50);
  perform public.golden_player_trade_confirm(v_direct_trade);

  perform set_config('request.jwt.claim.sub',v_buyer::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_buyer,'role','authenticated','aud','authenticated')::text,true);
  v_result:=public.golden_player_trade_confirm(v_direct_trade);
  if coalesce((v_result->>'completed')::boolean,false) is not true then raise exception 'DIRECT_TRADE_CONFIRM_TEST_FAILED'; end if;

  select gold into v_gold_seller from public.golden_player_state where user_id=v_seller;
  select gold into v_gold_buyer from public.golden_player_state where user_id=v_buyer;
  select quantity into v_qty from public.golden_inventory where user_id=v_seller and item_code='iron_ore';
  if v_gold_seller<>50 or v_qty<>1 then raise exception 'DIRECT_TRADE_SELLER_RESULT_FAILED'; end if;
  select quantity into v_qty from public.golden_inventory where user_id=v_buyer and item_code='copper_ore';
  if v_gold_buyer<>270 or v_qty<>4 then raise exception 'DIRECT_TRADE_BUYER_RESULT_FAILED gold=% copper=%',v_gold_buyer,v_qty; end if;

  -- Server-side mining selects an unpersisted solid tile, validates reach and writes the chunk atomically.
  select gx.x,gy.y,private.golden_world_tile_at(gx.x,gy.y)
    into v_mine_x,v_mine_y,v_mine_tile
  from generate_series(0,359) as gx(x)
  cross join generate_series(0,117) as gy(y)
  where private.golden_world_tile_at(gx.x,gy.y) between 0 and 6
    and not exists (
      select 1 from public.golden_world_chunks c
      where c.world_id='main' and c.chunk_x=gx.x/32 and c.chunk_y=gy.y/32
    )
  order by gx.x,gy.y
  limit 1;
  if v_mine_x is null then raise exception 'NO_UNPERSISTED_TEST_BLOCK_FOUND'; end if;

  perform set_config('request.jwt.claim.sub',v_buyer::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_buyer,'role','authenticated','aud','authenticated')::text,true);
  perform public.golden_presence_update('main',v_mine_x,v_mine_y,1::smallint,'idle');
  v_result:=public.golden_mine(v_mine_x,v_mine_y,v_mine_x,v_mine_y);
  v_mined_tile:=(v_result->>'tile_type')::integer;
  v_chunk_revision:=(v_result->>'chunk_revision')::integer;
  if v_mined_tile<>v_mine_tile or v_chunk_revision<1 then raise exception 'SERVER_MINING_TARGET_TEST_FAILED'; end if;
  if (v_result->>'pickaxe_rare_bonus')::numeric<>1.5 then raise exception 'MINING_PICKAXE_BONUS_TEST_FAILED'; end if;
  perform pg_sleep(0.4);
  begin
    perform public.golden_mine(v_mine_x,v_mine_y,v_mine_x,v_mine_y);
    raise exception 'MINING_DUPLICATE_BLOCK_TEST_FAILED';
  exception when others then
    if sqlerrm<>'BLOCK_ALREADY_MINED' then raise; end if;
  end;

  -- Account deletion removes player-owned data but must preserve shared world chunks.
  insert into public.golden_profiles(user_id,username) values(v_delete_user,'gd_delete_smoke');
  insert into public.golden_player_state(user_id) values(v_delete_user);
  insert into public.golden_inventory(user_id,item_code,quantity) values(v_delete_user,'copper_ore',2);
  insert into public.golden_world_chunks(world_id,chunk_x,chunk_y,tiles,revision,updated_by)
  values('gd-smoke-delete',9999,9999,v_tiles,1,v_delete_user);
  delete from auth.users where id=v_delete_user;
  if exists(select 1 from public.golden_profiles where user_id=v_delete_user)
     or exists(select 1 from public.golden_player_state where user_id=v_delete_user)
     or exists(select 1 from public.golden_inventory where user_id=v_delete_user) then
    raise exception 'ACCOUNT_DELETE_CASCADE_TEST_FAILED';
  end if;
  if not exists(select 1 from public.golden_world_chunks where world_id='gd-smoke-delete' and updated_by is null) then
    raise exception 'SHARED_WORLD_CHUNK_PRESERVE_TEST_FAILED';
  end if;

  -- Shared-world chunks are part of Supabase Realtime publication.
  select count(*) into v_count from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public' and tablename='golden_world_chunks';
  if v_count<>1 then raise exception 'WORLD_CHUNK_REALTIME_PUBLICATION_TEST_FAILED'; end if;

  raise notice 'GOLDEN_DEPTHS_BACKEND_SMOKE_TESTS_PASSED';
end
$golden_depths_smoke$;

rollback;
