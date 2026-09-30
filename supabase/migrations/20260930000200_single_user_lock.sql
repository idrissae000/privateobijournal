-- Only one account may ever exist. Any further sign-up (even with signups enabled) is rejected.
create or replace function public.enforce_single_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from auth.users) then
    raise exception 'Sign-ups are closed: this journal has a single owner.';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_single_user() from public, anon, authenticated;

create trigger enforce_single_user
  before insert on auth.users
  for each row execute function public.enforce_single_user();
