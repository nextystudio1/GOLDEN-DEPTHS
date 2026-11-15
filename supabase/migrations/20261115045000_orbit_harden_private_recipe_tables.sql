-- Keep private crafting tables inaccessible to API roles and index their output foreign key.
create index if not exists item_recipes_output_item_idx on orbit_private.item_recipes(output_item_id);
drop policy if exists item_recipes_deny_client_access on orbit_private.item_recipes;
create policy item_recipes_deny_client_access on orbit_private.item_recipes for all to public using (false) with check (false);
drop policy if exists item_recipe_ingredients_deny_client_access on orbit_private.item_recipe_ingredients;
create policy item_recipe_ingredients_deny_client_access on orbit_private.item_recipe_ingredients for all to public using (false) with check (false);
