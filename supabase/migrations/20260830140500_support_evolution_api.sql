alter table public.whatsapp_connections
  drop constraint whatsapp_connections_phone_number_id_key;

alter table public.whatsapp_connections
  alter column phone_number_id drop not null,
  add column provider text not null default 'meta' check (provider in ('meta', 'evolution')),
  add column instance_name text;

alter table public.whatsapp_connections
  add constraint whatsapp_connections_provider_identifier_check check (
    (provider = 'meta' and phone_number_id is not null)
    or (provider = 'evolution' and instance_name is not null)
  );

create unique index whatsapp_connections_meta_phone_idx
  on public.whatsapp_connections(phone_number_id)
  where provider = 'meta';

create unique index whatsapp_connections_evolution_instance_idx
  on public.whatsapp_connections(instance_name)
  where provider = 'evolution';
