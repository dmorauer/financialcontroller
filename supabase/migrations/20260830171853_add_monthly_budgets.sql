create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (char_length(trim(category)) between 1 and 60),
  month date not null check (month = date_trunc('month', month)::date),
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category, month)
);

create index budgets_user_month_idx on public.budgets (user_id, month);

alter table public.budgets enable row level security;

revoke all on table public.budgets from anon, authenticated;
grant select, insert, update, delete on table public.budgets to authenticated;

create policy "budgets_select_own" on public.budgets
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "budgets_insert_own" on public.budgets
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "budgets_update_own" on public.budgets
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "budgets_delete_own" on public.budgets
  for delete to authenticated
  using ((select auth.uid()) = user_id);
