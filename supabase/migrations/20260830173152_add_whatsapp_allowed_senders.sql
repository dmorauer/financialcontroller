create table public.whatsapp_allowed_senders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  phone text not null check (phone ~ '^[0-9]{10,15}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, phone)
);

create index whatsapp_allowed_senders_user_active_idx
  on public.whatsapp_allowed_senders (user_id, active);

alter table public.whatsapp_allowed_senders enable row level security;
revoke all on table public.whatsapp_allowed_senders from anon, authenticated;
grant select, insert, update, delete on table public.whatsapp_allowed_senders to authenticated;

create policy "whatsapp_allowed_senders_select_own" on public.whatsapp_allowed_senders
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "whatsapp_allowed_senders_insert_own" on public.whatsapp_allowed_senders
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "whatsapp_allowed_senders_update_own" on public.whatsapp_allowed_senders
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "whatsapp_allowed_senders_delete_own" on public.whatsapp_allowed_senders
  for delete to authenticated using ((select auth.uid()) = user_id);
