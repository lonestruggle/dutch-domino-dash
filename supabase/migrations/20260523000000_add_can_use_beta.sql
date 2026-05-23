alter table public.user_permissions
  add column if not exists can_use_beta boolean not null default false;
