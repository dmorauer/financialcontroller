alter table public.accounts
  add column credit_limit numeric(14,2),
  add column statement_close_day smallint,
  add column payment_due_day smallint;

alter table public.accounts
  add constraint accounts_credit_limit_nonnegative
    check (credit_limit is null or credit_limit >= 0),
  add constraint accounts_statement_close_day_valid
    check (statement_close_day is null or statement_close_day between 1 and 31),
  add constraint accounts_payment_due_day_valid
    check (payment_due_day is null or payment_due_day between 1 and 31),
  add constraint accounts_credit_card_billing_fields
    check (
      kind = 'credit_card'
      or (credit_limit is null and statement_close_day is null and payment_due_day is null)
    );
