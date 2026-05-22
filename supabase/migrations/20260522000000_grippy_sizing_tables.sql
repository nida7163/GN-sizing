-- Grippy Sizing Tool tables

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.sizing_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  hand text not null check (hand in ('left', 'right')),
  recommended_size text not null check (recommended_size in ('XS', 'S', 'M', 'L')),
  confidence integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.measurements (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sizing_sessions(id) on delete cascade,
  thumb numeric(5,1),
  index_finger numeric(5,1),
  middle_finger numeric(5,1),
  ring_finger numeric(5,1),
  pinky numeric(5,1),
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists sizing_sessions_profile_id_idx on public.sizing_sessions(profile_id);
create index if not exists measurements_session_id_idx on public.measurements(session_id);

-- RLS
alter table public.profiles enable row level security;
alter table public.sizing_sessions enable row level security;
alter table public.measurements enable row level security;

-- Allow anonymous inserts (placeholder auth — tighten when auth is wired)
create policy "anon insert profiles" on public.profiles for insert to anon with check (true);
create policy "anon insert sessions" on public.sizing_sessions for insert to anon with check (true);
create policy "anon insert measurements" on public.measurements for insert to anon with check (true);
create policy "anon read sessions" on public.sizing_sessions for select to anon using (true);
create policy "anon read measurements" on public.measurements for select to anon using (true);
