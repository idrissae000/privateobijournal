-- Obis Journal: single-user schema. Every table is scoped to auth.uid() via RLS.

create table public.months (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  year smallint not null check (year between 1900 and 2200),
  month smallint not null check (month between 1 and 12),
  title text,
  cover_image_key text,
  month_end_reflection text,
  how_it_changed_me text,
  is_retrospective boolean not null default false,
  sealed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, year, month)
);

create table public.influences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month_id uuid not null references public.months(id) on delete cascade,
  name text not null,
  image_key text,
  why_it_resonates text,
  date_added date not null default current_date,
  source_note text,
  created_at timestamptz not null default now()
);
create index influences_month_id_idx on public.influences(month_id);
create index influences_user_name_idx on public.influences(user_id, lower(name));

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  month_id uuid not null references public.months(id) on delete cascade,
  rating smallint check (rating between 1 and 10),
  note text,
  weigh_in numeric(5,1),
  created_at timestamptz not null default now(),
  unique (user_id, date)
);
create index entries_month_id_idx on public.entries(month_id);

create table public.entry_influences (
  entry_id uuid not null references public.entries(id) on delete cascade,
  influence_id uuid not null references public.influences(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  primary key (entry_id, influence_id)
);
create index entry_influences_influence_id_idx on public.entry_influences(influence_id);

create table public.entry_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_id uuid references public.entries(id) on delete cascade,
  influence_id uuid references public.influences(id) on delete cascade,
  month_id uuid references public.months(id) on delete cascade,
  storage_key text not null,
  is_progress_photo boolean not null default false,
  is_hidden boolean not null default false,
  -- collage placement: {x, y, w, h, rotation, z}
  layout jsonb,
  created_at timestamptz not null default now(),
  check (num_nonnulls(entry_id, influence_id, month_id) = 1)
);
create index entry_photos_entry_id_idx on public.entry_photos(entry_id);
create index entry_photos_influence_id_idx on public.entry_photos(influence_id);
create index entry_photos_month_id_idx on public.entry_photos(month_id);

-- Row level security: only the owning user can touch their rows.
do $$
declare t text;
begin
  foreach t in array array['months','influences','entries','entry_influences','entry_photos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "owner full access" on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;
