-- Add user_id to profiles
alter table public.profiles
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists profiles_user_id_idx on public.profiles(user_id);

-- Add user_id and shape to sizing_sessions
alter table public.sizing_sessions
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists shape text check (shape in ('short-round', 'short-oval'));

create index if not exists sizing_sessions_user_id_idx on public.sizing_sessions(user_id);

-- Authenticated users can read and insert their own sessions
create policy "users insert own sessions" on public.sizing_sessions
  for insert to authenticated with check (user_id = auth.uid());

create policy "users read own sessions" on public.sizing_sessions
  for select to authenticated using (user_id = auth.uid());

-- Authenticated users can read measurements for their own sessions
create policy "users read own measurements" on public.measurements
  for select to authenticated using (
    session_id in (
      select id from public.sizing_sessions where user_id = auth.uid()
    )
  );
