create or replace function orbit_private.orbit_release_claims_on_leave()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
 delete from public.world_claims
 where world_id=old.world_id and owner_id=old.user_id;
 return old;
end;
$function$;
revoke all on function orbit_private.orbit_release_claims_on_leave() from public,anon,authenticated;
drop trigger if exists release_world_claims_after_member_leave on public.world_members;
create trigger release_world_claims_after_member_leave
after delete on public.world_members
for each row execute function orbit_private.orbit_release_claims_on_leave();
