create table public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone_number_id text not null unique,
  business_account_id text,
  display_phone_number text,
  status text not null default 'active' check (status in ('active', 'paused', 'disconnected')),
  created_at timestamptz not null default now()
);

create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.whatsapp_connections(id) on delete cascade,
  wa_message_id text not null unique,
  from_phone text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  message_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index whatsapp_connections_user_id_idx on public.whatsapp_connections(user_id);
create index whatsapp_messages_user_id_idx on public.whatsapp_messages(user_id);
create index whatsapp_messages_connection_id_idx on public.whatsapp_messages(connection_id);

alter table public.whatsapp_connections enable row level security;
alter table public.whatsapp_messages enable row level security;
revoke all on table public.whatsapp_connections, public.whatsapp_messages from anon, authenticated;
grant select, insert, update, delete on table public.whatsapp_connections, public.whatsapp_messages to authenticated;

create policy "whatsapp_connections_select_own" on public.whatsapp_connections for select to authenticated using ((select auth.uid()) = user_id);
create policy "whatsapp_connections_insert_own" on public.whatsapp_connections for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "whatsapp_connections_update_own" on public.whatsapp_connections for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "whatsapp_connections_delete_own" on public.whatsapp_connections for delete to authenticated using ((select auth.uid()) = user_id);
create policy "whatsapp_messages_select_own" on public.whatsapp_messages for select to authenticated using ((select auth.uid()) = user_id);
create policy "whatsapp_messages_insert_own" on public.whatsapp_messages for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "whatsapp_messages_update_own" on public.whatsapp_messages for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "whatsapp_messages_delete_own" on public.whatsapp_messages for delete to authenticated using ((select auth.uid()) = user_id);
