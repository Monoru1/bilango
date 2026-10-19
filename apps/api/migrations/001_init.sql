-- GoBilan — schéma initial (PostgreSQL 15+).
-- Conventions :
--  * jours métier (`day`) stockés en TEXT 'YYYY-MM-DD' : jamais de conversion de fuseau implicite ;
--  * instants en timestamptz (UTC) ; montants FCFA en bigint ENTIERS ;
--  * aucune suppression en cascade : les bilans d'un membre retiré sont conservés (cahier §5.4) ;
--  * tables d'audit et de commissions en AJOUT SEUL, appliqué par déclencheur (cahier §13.4).

create function forbid_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'La table % est en ajout seul : % interdit.', tg_table_name, tg_op using errcode = 'restrict_violation';
end $$;

-- ===== Utilisateurs de l'application (patrons, employés) =====================================
create table users (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique check (phone ~ '^\+[0-9]{9,15}$'),
  country text not null check (country in ('BJ','CI','TG')),
  name text not null default '',
  pin_hash text,
  pin_failed_attempts int not null default 0 check (pin_failed_attempts >= 0),
  pin_lock_count int not null default 0 check (pin_lock_count >= 0),
  pin_locked_until timestamptz,
  referral_partner_code text,
  created_at timestamptz not null
);

create table devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  device_key text not null,
  label text,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  revoked_at timestamptz,
  unique (user_id, device_key)
);

create table user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  device_id uuid not null references devices(id),
  token_hash text not null unique,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index user_sessions_user_idx on user_sessions(user_id);

-- Codes à usage unique. `subject` = numéro E.164 (WhatsApp) ou e-mail (partenaires, admin).
create table otp_codes (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  channel text not null check (channel in ('whatsapp','email')),
  purpose text not null,
  code_hash text not null,
  device_key text,
  ip text,
  issued_at timestamptz not null,
  attempts int not null default 0,
  consumed_at timestamptz
);
create index otp_codes_subject_idx on otp_codes(subject, issued_at);
create index otp_codes_device_idx on otp_codes(device_key, issued_at);
create index otp_codes_ip_idx on otp_codes(ip, issued_at);

-- Preuve émise après validation d'un OTP ; échangée une seule fois contre la création du PIN.
create table otp_proofs (
  token_hash text primary key,
  subject text not null,
  purpose text not null,
  device_key text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz
);

-- ===== Business, rôles, équipe ===============================================================
create table businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id),
  name text not null,
  country text not null check (country in ('BJ','CI','TG')),
  sector text not null check (sector in ('bar_restaurant','boutique','ecommerce','other')),
  stock_enabled boolean not null default false,
  reminder_time text not null default '20:00' check (reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  opening_cash_amount bigint check (opening_cash_amount >= 0),
  opening_cash_day text check (opening_cash_day ~ '^\d{4}-\d{2}-\d{2}$'),
  opening_cash_by uuid references users(id),
  -- NULL = aucun essai accordé (un seul essai par numéro et par appareil, §8.1 — décision D-014).
  trial_ends_at timestamptz,
  paid_until timestamptz,
  created_device_key text,
  created_at timestamptz not null
);

create table roles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id),
  name text not null,
  level text not null check (level in ('entry','full','readonly'))
);
create index roles_business_idx on roles(business_id);

create table members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id),
  user_id uuid not null references users(id),
  role_id uuid references roles(id),            -- NULL pour le propriétaire
  is_owner boolean not null default false,
  status text not null default 'active' check (status in ('active','removed')),
  joined_at timestamptz not null,
  removed_at timestamptz,
  unique (business_id, user_id),
  check (is_owner = (role_id is null))
);
create unique index one_owner_per_business on members(business_id) where is_owner;
create index members_user_idx on members(user_id);

create table invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id),
  phone text not null,
  role_id uuid not null references roles(id),
  invited_by uuid not null references users(id),
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null,
  responded_at timestamptz
);
create unique index one_pending_invitation on invitations(business_id, phone) where status = 'pending';
create index invitations_phone_idx on invitations(phone) where status = 'pending';

create table stock_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id),
  name text not null,
  initial_quantity int not null check (initial_quantity >= 0)
);

-- ===== Bilans : versions immuables ============================================================
create table reports (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id),
  day text not null check (day ~ '^\d{4}-\d{2}-\d{2}$'),
  author_id uuid not null references users(id),
  author_name text not null,                    -- conservé même si l'auteur est retiré (§5.4)
  submitted_at timestamptz not null,
  client_request_id text not null,
  unique (business_id, author_id, client_request_id)
);
create index reports_business_day_idx on reports(business_id, day);

create table report_versions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id),
  version_no int not null check (version_no >= 1),
  content jsonb not null,
  saved_at timestamptz not null,
  unique (report_id, version_no)
);
create trigger report_versions_append_only before update or delete on report_versions for each row execute function forbid_mutation();
create trigger reports_no_mutation before update or delete on reports for each row execute function forbid_mutation();

-- ===== Abonnements et paiements FedaPay ==========================================================
create table payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id),
  merchant_reference text not null unique,       -- jamais réutilisé (§8.2)
  fedapay_transaction_id text unique,
  status text not null default 'pending' check (status in ('pending','confirmed','failed','cancelled','refunded','disputed')),
  amount bigint not null check (amount > 0),
  provider text,
  created_at timestamptz not null,
  confirmed_at timestamptz,
  extended_until timestamptz
);
create index payments_business_idx on payments(business_id);

-- Idempotence des webhooks : un évènement n'est traité qu'une fois.
create table webhook_events (
  event_id text primary key,
  received_at timestamptz not null,
  payload jsonb not null,
  processed_at timestamptz
);

-- ===== Programme partenaires =================================================================
create table partners (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  country text not null check (country in ('BJ','CI','TG')),
  role text not null check (role in ('agent','manager','influencer')),
  manager_id uuid references partners(id),
  password_hash text,
  status text not null default 'invited' check (status in ('invited','active','suspended','removed')),
  promo_code text unique,
  -- Coordonnées de versement chiffrées au repos (AES-256-GCM, §13.6).
  payout_phone_enc text,
  payout_network text check (payout_network in ('MTN','Moov','Orange','Wave','TMoney')),
  payout_name_enc text,
  activated_at timestamptz,
  created_at timestamptz not null,
  -- Un e-mail ne correspond qu'à UN rôle (§10.1).
  check (role <> 'agent' or manager_id is not null)
);
create unique index partners_email_unique on partners(lower(email));

create table partner_activation_tokens (
  token_hash text primary key,
  partner_id uuid not null references partners(id),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create table partner_sessions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id),
  token_hash text not null unique,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create table partner_login_state (
  email text primary key,
  failed_attempts int not null default 0,
  locked_until timestamptz
);

-- Une ligne par acceptation d'accord : date, heure, version, identifiant (§10.3). Ajout seul.
create table agreement_acceptances (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id),
  role text not null,
  version text not null,
  accepted_at timestamptz not null,
  ip text
);
create trigger agreement_acceptances_append_only before update or delete on agreement_acceptances for each row execute function forbid_mutation();

-- Une personne parrainée n'a qu'un seul code (§10.8) : business_id unique.
create table referrals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references businesses(id),
  partner_id uuid not null references partners(id),
  partner_role text not null check (partner_role in ('agent','influencer')),
  manager_id uuid references partners(id),
  registered_at timestamptz not null,
  rates jsonb not null,                          -- montants figés à la date du parrainage
  agreement_version text not null,
  excluded_reason text
);
create index referrals_partner_idx on referrals(partner_id);

-- Journal des commissions : AJOUT SEUL. Une correction = une ligne d'annulation (§13.4).
create table commission_ledger (
  key text primary key,                          -- idempotence : paymentId:role
  partner_id uuid not null references partners(id),
  role text not null check (role in ('agent','manager','influencer')),
  referral_id uuid not null references referrals(id),
  payment_id uuid references payments(id),
  amount bigint not null check (amount <> 0),
  payout_date text not null check (payout_date ~ '^\d{4}-\d{2}-\d{2}$'),
  confirmed_at timestamptz not null,
  reverses text references commission_ledger(key),
  payment_index int,
  created_at timestamptz not null
);
create index commission_ledger_partner_idx on commission_ledger(partner_id, payout_date);
create trigger commission_ledger_append_only before update or delete on commission_ledger for each row execute function forbid_mutation();

-- Versements validés manuellement par l'administrateur ; une ligne validée ne se modifie plus (§10.9).
create table payouts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id),
  cycle_date text not null check (cycle_date ~ '^\d{4}-\d{2}-\d{2}$'),
  gross bigint not null check (gross >= 2000),   -- seuil de 2 000 FCFA (§10.9)
  fees bigint not null check (fees >= 0),
  net bigint not null,
  transfer_reference text,
  validated_by text not null,
  validated_at timestamptz not null,
  check (net = gross - fees and net >= 0)
);
create trigger payouts_append_only before update or delete on payouts for each row execute function forbid_mutation();

create table payout_entries (
  payout_id uuid not null references payouts(id),
  ledger_key text not null references commission_ledger(key),  -- une ligne ne peut être versée qu'une fois, sauf si son versement a été ANNULÉ (trigger ci-dessous)
  primary key (payout_id, ledger_key)
);
-- Un virement échoué se corrige par une annulation, jamais par une modification (§10.9, §13.4).
create table payout_reversals (
  payout_id uuid primary key references payouts(id),
  reason text not null,
  reversed_by text not null,
  reversed_at timestamptz not null
);
create trigger payout_reversals_append_only before update or delete on payout_reversals for each row execute function forbid_mutation();

create function forbid_double_payout() returns trigger language plpgsql as $$
begin
  if exists (select 1 from payout_entries pe where pe.ledger_key = new.ledger_key
               and not exists (select 1 from payout_reversals r where r.payout_id = pe.payout_id)) then
    raise exception 'ledger line % already paid', new.ledger_key using errcode = '23505';
  end if;
  return new;
end $$;
create trigger payout_entries_no_double before insert on payout_entries for each row execute function forbid_double_payout();
create trigger payout_entries_append_only before update or delete on payout_entries for each row execute function forbid_mutation();

-- ===== Administration =========================================================================
create table admin_users (
  email text primary key check (email = lower(email)),
  password_hash text,
  active boolean not null default true,
  created_at timestamptz not null
);

create table admin_challenges (
  id uuid primary key default gen_random_uuid(),
  email text not null references admin_users(email),
  issued_at timestamptz not null,
  consumed_at timestamptz
);

create table admin_sessions (
  id uuid primary key default gen_random_uuid(),
  email text not null references admin_users(email),
  token_hash text not null unique,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create table admin_login_state (
  email text primary key,
  failed_attempts int not null default 0,
  locked_until timestamptz
);

-- Journal des actions admin : auteur, date, ancienne valeur (§13.4). Ajout seul.
create table audit_log (
  id bigserial primary key,
  at timestamptz not null,
  actor text not null,
  action text not null,
  target text,
  old_value jsonb,
  new_value jsonb
);
create trigger audit_log_append_only before update or delete on audit_log for each row execute function forbid_mutation();

-- ===== Notifications Web Push ================================================================
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  device_id uuid references devices(id),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null
);
