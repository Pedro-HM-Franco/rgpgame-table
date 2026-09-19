create table if not exists public.rpg_player_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rpg_player_data enable row level security;

drop policy if exists "Jogadores visualizam os proprios dados" on public.rpg_player_data;
create policy "Jogadores visualizam os proprios dados"
on public.rpg_player_data for select
using (auth.uid() = user_id);

drop policy if exists "Jogadores criam os proprios dados" on public.rpg_player_data;
create policy "Jogadores criam os proprios dados"
on public.rpg_player_data for insert
with check (auth.uid() = user_id);

drop policy if exists "Jogadores atualizam os proprios dados" on public.rpg_player_data;
create policy "Jogadores atualizam os proprios dados"
on public.rpg_player_data for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Jogadores removem os proprios dados" on public.rpg_player_data;
create policy "Jogadores removem os proprios dados"
on public.rpg_player_data for delete
using (auth.uid() = user_id);

grant select, insert, update, delete on public.rpg_player_data to authenticated;
