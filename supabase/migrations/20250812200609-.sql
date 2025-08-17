-- Create per-user permissions table
create table if not exists public.user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  can_hard_slam boolean not null default true,
  can_invite boolean not null default true,
  can_chat boolean not null default true,
  can_create_lobby boolean not null default true,
  can_use_custom_backgrounds boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_permissions_user_unique unique (user_id)
);

-- Enable RLS
alter table public.user_permissions enable row level security;

-- Policies
create policy "Admins manage user permissions"
  on public.user_permissions
  as permissive
  for all
  to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

create policy "Users can view own permissions"
  on public.user_permissions
  as permissive
  for select
  to authenticated
  using (user_id = auth.uid());

-- Optional: Moderators can view permissions
create policy "Moderators can view permissions"
  on public.user_permissions
  as permissive
  for select
  to authenticated
  using (can_moderate(auth.uid()));

-- Trigger to update updated_at
create trigger update_user_permissions_updated_at
before update on public.user_permissions
for each row execute function public.update_updated_at_column();

-- Helpful index
create index if not exists idx_user_permissions_user_id on public.user_permissions(user_id);
