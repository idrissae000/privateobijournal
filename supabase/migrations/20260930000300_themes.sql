-- Free-form theme tags for chapters and for the characters/ideas that shape them.
alter table public.months add column themes text[] not null default '{}';
alter table public.influences add column themes text[] not null default '{}';
