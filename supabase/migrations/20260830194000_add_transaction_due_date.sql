alter table public.transactions
  add column due_on date;

create index transactions_user_due_on_idx
  on public.transactions (user_id, due_on)
  where due_on is not null and status <> 'ignored';
