-- Structured scouting tags alongside the written notes, e.g. 'Backhand · Volley · Low ball'.
alter table public.results
  add column if not exists did_well_tags text[] not null default '{}',
  add column if not exists struggled_tags text[] not null default '{}';
