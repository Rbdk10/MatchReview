-- MatchReview: opponent tracker schema
create extension if not exists "pgcrypto";

-- Profiles: one per auth user (coach)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  sport text check (sport in ('tennis')),
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

-- Players on the coach's team
create table public.players (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now()
);
create index players_coach_idx on public.players(coach_id);

-- Opponents registered by the coach
create table public.opponents (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  school text,
  created_at timestamptz not null default now()
);
create index opponents_coach_idx on public.opponents(coach_id);
create unique index opponents_coach_name_uniq on public.opponents(coach_id, lower(trim(name)));

-- Match results
create table public.results (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  opponent_id uuid not null references public.opponents(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  player_name text not null,
  sport text not null default 'tennis' check (sport in ('tennis')),
  played_on date not null default current_date,
  outcome text not null check (outcome in ('win','loss')),
  sets jsonb not null default '[]'::jsonb,
  did_well text,
  struggled_with text,
  notes text,
  created_at timestamptz not null default now()
);
create index results_coach_idx on public.results(coach_id);
create index results_opponent_idx on public.results(opponent_id);
create index results_player_idx on public.results(player_id);

-- Row level security
alter table public.profiles enable row level security;
alter table public.players enable row level security;
alter table public.opponents enable row level security;
alter table public.results enable row level security;

create policy "profiles: own" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "players: own" on public.players
  for all using (auth.uid() = coach_id) with check (auth.uid() = coach_id);

create policy "opponents: own" on public.opponents
  for all using (auth.uid() = coach_id) with check (auth.uid() = coach_id);

create policy "results: own" on public.results
  for all using (auth.uid() = coach_id) with check (auth.uid() = coach_id);

-- Auto-create a profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
