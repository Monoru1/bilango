-- Pending allowlist changes require email confirmation by the authenticated initiating admin.
create table admin_allowlist_changes (
  id uuid primary key references otp_codes(id),
  requested_by text not null references admin_users(email),
  target_email text not null check (target_email = lower(target_email)),
  action text not null check (action in ('add','remove')),
  password_hash text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  check ((action = 'add' and password_hash is not null) or (action = 'remove' and password_hash is null))
);
create index admin_allowlist_pending on admin_allowlist_changes(requested_by, expires_at) where consumed_at is null;
