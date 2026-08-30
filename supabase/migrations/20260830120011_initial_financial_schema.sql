create extension if not exists pgcrypto;

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  kind text not null check (kind in ('checking', 'savings', 'cash', 'credit_card', 'investment')),
  institution text,
  opening_balance numeric(14,2) not null default 0,
  currency char(3) not null default 'BRL',
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null check (kind in ('income', 'expense')),
  color text not null default '#708078',
  created_at timestamptz not null default now(),
  unique (user_id, name, kind)
);

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('csv', 'ofx', 'pdf', 'image', 'whatsapp', 'manual')),
  filename text,
  storage_path text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'review', 'completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  import_id uuid references public.imports(id) on delete set null,
  description text not null check (char_length(description) between 1 and 240),
  amount numeric(14,2) not null check (amount <> 0),
  occurred_on date not null default current_date,
  status text not null default 'confirmed' check (status in ('review', 'confirmed', 'ignored')),
  merchant text,
  document_number text,
  external_id text,
  fingerprint text,
  confidence numeric(4,3) check (confidence between 0 and 1),
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index transactions_user_fingerprint_key
  on public.transactions (user_id, fingerprint)
  where fingerprint is not null and status <> 'ignored';
create index accounts_user_id_idx on public.accounts (user_id);
create index categories_user_id_idx on public.categories (user_id);
create index imports_user_id_idx on public.imports (user_id);
create index transactions_user_date_idx on public.transactions (user_id, occurred_on desc);
create index transactions_account_id_idx on public.transactions (account_id);
create index transactions_category_id_idx on public.transactions (category_id);
create index transactions_import_id_idx on public.transactions (import_id);

alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.imports enable row level security;
alter table public.transactions enable row level security;

revoke all on table public.accounts, public.categories, public.imports, public.transactions from anon, authenticated;
grant select, insert, update, delete on table public.accounts, public.categories, public.imports, public.transactions to authenticated;

create policy "accounts_select_own" on public.accounts for select to authenticated using ((select auth.uid()) = user_id);
create policy "accounts_insert_own" on public.accounts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "accounts_update_own" on public.accounts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "accounts_delete_own" on public.accounts for delete to authenticated using ((select auth.uid()) = user_id);

create policy "categories_select_own" on public.categories for select to authenticated using ((select auth.uid()) = user_id);
create policy "categories_insert_own" on public.categories for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "categories_update_own" on public.categories for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "categories_delete_own" on public.categories for delete to authenticated using ((select auth.uid()) = user_id);

create policy "imports_select_own" on public.imports for select to authenticated using ((select auth.uid()) = user_id);
create policy "imports_insert_own" on public.imports for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "imports_update_own" on public.imports for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "imports_delete_own" on public.imports for delete to authenticated using ((select auth.uid()) = user_id);

create policy "transactions_select_own" on public.transactions for select to authenticated using ((select auth.uid()) = user_id);
create policy "transactions_insert_own" on public.transactions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "transactions_update_own" on public.transactions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "transactions_delete_own" on public.transactions for delete to authenticated using ((select auth.uid()) = user_id);
