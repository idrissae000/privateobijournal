-- "declined": the user discarded the suggested traits; automatic catch-up must not suggest them again.
alter table public.influences drop constraint influences_traits_status_check;
alter table public.influences add constraint influences_traits_status_check
  check (traits_status in ('none', 'pending', 'suggested', 'done', 'failed', 'skipped', 'declined'));
