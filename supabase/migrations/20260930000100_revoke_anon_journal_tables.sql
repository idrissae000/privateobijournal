-- Private app: the anon role should not see or touch any journal table.
revoke all on public.months, public.influences, public.entries, public.entry_influences, public.entry_photos from anon;
