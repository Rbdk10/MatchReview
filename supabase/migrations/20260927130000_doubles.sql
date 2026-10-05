alter table public.results
  add column if not exists format text not null default 'singles' check (format in ('singles','doubles')),
  add column if not exists player2_id uuid references public.players(id) on delete set null,
  add column if not exists player2_name text,
  add column if not exists opponent2_id uuid references public.opponents(id) on delete set null;
create index if not exists results_opponent2_idx on public.results(opponent2_id);
