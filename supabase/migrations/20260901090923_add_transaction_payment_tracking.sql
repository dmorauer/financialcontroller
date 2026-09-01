alter table public.transactions
  add column paid_at timestamptz;

create index transactions_user_unpaid_due_idx
  on public.transactions (user_id, due_on)
  where due_on is not null and paid_at is null and status = 'confirmed';
