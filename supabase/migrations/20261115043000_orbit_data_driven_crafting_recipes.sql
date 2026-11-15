-- ORBIT: database-driven crafting recipes; private tables are never exposed through the client API.
create table orbit_private.item_recipes (
 recipe_id text primary key check (char_length(recipe_id) between 1 and 80),
 output_item_id text not null references public.item_catalog(item_id) on update cascade on delete restrict,
 output_quantity integer not null check (output_quantity between 1 and 9999),
 is_enabled boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table orbit_private.item_recipe_ingredients (
 recipe_id text not null references orbit_private.item_recipes(recipe_id) on delete cascade,
 item_id text not null references public.item_catalog(item_id) on update cascade on delete restrict,
 quantity integer not null check (quantity between 1 and 9999),
 primary key (recipe_id,item_id)
);
create index item_recipe_ingredients_item_idx on orbit_private.item_recipe_ingredients(item_id);
alter table orbit_private.item_recipes enable row level security;
alter table orbit_private.item_recipe_ingredients enable row level security;
revoke all on orbit_private.item_recipes,orbit_private.item_recipe_ingredients from public,anon,authenticated;
insert into orbit_private.item_recipes(recipe_id,output_item_id,output_quantity) values
('glow_seed','glow_seed',2),('stone_pickaxe','stone_pickaxe',1),('copper_pickaxe','copper_pickaxe',1),('crystal_pickaxe','crystal_pickaxe',1),
('amber_plank_block','amber_plank_block',2),('copper_brick_block','copper_brick_block',2),('crystal_glass_block','crystal_glass_block',1),('moss_stone_block','moss_stone_block',2)
on conflict(recipe_id) do update set output_item_id=excluded.output_item_id,output_quantity=excluded.output_quantity,is_enabled=true,updated_at=now();
insert into orbit_private.item_recipe_ingredients(recipe_id,item_id,quantity) values
('glow_seed','soil_block',4),('glow_seed','amber_wood',1),('stone_pickaxe','slate_block',12),('stone_pickaxe','amber_wood',8),
('copper_pickaxe','copper_ore',12),('copper_pickaxe','amber_wood',8),('crystal_pickaxe','sky_crystal',10),('crystal_pickaxe','amber_wood',12),
('amber_plank_block','amber_wood',3),('amber_plank_block','soil_block',1),('copper_brick_block','copper_ore',4),('copper_brick_block','amber_wood',2),
('crystal_glass_block','sky_crystal',3),('crystal_glass_block','amber_wood',2),('moss_stone_block','slate_block',3),('moss_stone_block','glow_seed',1)
on conflict(recipe_id,item_id) do update set quantity=excluded.quantity;
create or replace function orbit_private.orbit_craft_item(p_recipe_id text)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_uid uuid:=auth.uid();v_output text;v_output_qty integer;v_output_name text;v_stack_limit integer;v_output_have bigint;v_ingredient_count integer;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_recipe_id is null or char_length(p_recipe_id)>80 then raise exception 'UNKNOWN_RECIPE'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text,0));
 select r.output_item_id,r.output_quantity,c.display_name into v_output,v_output_qty,v_output_name
 from orbit_private.item_recipes r join public.item_catalog c on c.item_id=r.output_item_id where r.recipe_id=p_recipe_id and r.is_enabled;
 if not found then raise exception 'UNKNOWN_RECIPE'; end if;
 if exists(select 1 from orbit_private.item_recipe_ingredients i where i.recipe_id=p_recipe_id and i.item_id=v_output) then raise exception 'INVALID_RECIPE'; end if;
 select count(*) into v_ingredient_count from orbit_private.item_recipe_ingredients where recipe_id=p_recipe_id;
 if v_ingredient_count=0 then raise exception 'INVALID_RECIPE'; end if;
 select stack_limit into v_stack_limit from public.item_catalog where item_id=v_output;
 select quantity into v_output_have from public.player_inventory where user_id=v_uid and item_id=v_output for update;
 if coalesce(v_output_have,0)+v_output_qty>v_stack_limit then raise exception 'OUTPUT_STACK_LIMIT'; end if;
 perform 1 from public.player_inventory pi join orbit_private.item_recipe_ingredients i on i.item_id=pi.item_id
 where pi.user_id=v_uid and i.recipe_id=p_recipe_id order by pi.item_id for update of pi;
 if exists(select 1 from orbit_private.item_recipe_ingredients i left join public.player_inventory pi on pi.user_id=v_uid and pi.item_id=i.item_id
 where i.recipe_id=p_recipe_id and coalesce(pi.quantity,0)<i.quantity) then raise exception 'MATERIALS_MISSING'; end if;
 update public.player_inventory pi set quantity=pi.quantity-i.quantity,updated_at=now()
 from orbit_private.item_recipe_ingredients i where i.recipe_id=p_recipe_id and pi.user_id=v_uid and pi.item_id=i.item_id;
 delete from public.player_inventory pi where pi.user_id=v_uid and pi.quantity<=0
 and exists(select 1 from orbit_private.item_recipe_ingredients i where i.recipe_id=p_recipe_id and i.item_id=pi.item_id);
 insert into public.player_inventory(user_id,item_id,quantity) values(v_uid,v_output,v_output_qty)
 on conflict(user_id,item_id) do update set quantity=public.player_inventory.quantity+excluded.quantity,updated_at=now();
 return jsonb_build_object('recipe_id',p_recipe_id,'item_id',v_output,'item_name',v_output_name,'quantity',v_output_qty);
end;
$function$;
create or replace function orbit_private.orbit_list_crafting_recipes()
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_uid uuid:=auth.uid();v_recipes jsonb;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('recipe_id',r.recipe_id,'output_item_id',r.output_item_id,'output_quantity',r.output_quantity,'output_name',out_item.display_name,
 'ingredients',(select coalesce(jsonb_agg(jsonb_build_object('item_id',i.item_id,'display_name',in_item.display_name,'quantity',i.quantity) order by in_item.display_name),'[]'::jsonb)
 from orbit_private.item_recipe_ingredients i join public.item_catalog in_item on in_item.item_id=i.item_id where i.recipe_id=r.recipe_id)
 ) order by out_item.display_name),'[]'::jsonb) into v_recipes
 from orbit_private.item_recipes r join public.item_catalog out_item on out_item.item_id=r.output_item_id where r.is_enabled;
 return v_recipes;
end;
$function$;
revoke all on function orbit_private.orbit_list_crafting_recipes() from public,anon;
grant execute on function orbit_private.orbit_list_crafting_recipes() to authenticated;
create or replace function public.orbit_list_crafting_recipes()
returns jsonb language sql set search_path to ''
as $function$ select orbit_private.orbit_list_crafting_recipes(); $function$;
revoke all on function public.orbit_list_crafting_recipes() from public,anon;
grant execute on function public.orbit_list_crafting_recipes() to authenticated;
