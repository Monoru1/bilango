-- Web Push : suivi de livraison des abonnements et journal de déduplication des notifications.
-- Additif uniquement : aucune donnée existante n'est modifiée ni supprimée.

alter table push_subscriptions add column if not exists user_agent text;
alter table push_subscriptions add column if not exists last_success_at timestamptz;
alter table push_subscriptions add column if not exists failure_count integer not null default 0;
-- Un abonnement révoqué (désinscription, 404/410 du service push, échecs répétés) n'est plus utilisé mais conservé pour l'audit.
alter table push_subscriptions add column if not exists revoked_at timestamptz;

create index if not exists push_subscriptions_user_active_idx on push_subscriptions(user_id) where revoked_at is null;

-- Une notification planifiée (rappel, expiration proche) ne part qu'UNE fois par clé de déduplication,
-- même si l'ordonnanceur tourne plusieurs fois ou sur plusieurs instances (contrainte unique + insertion atomique).
create table if not exists notification_log (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  kind text not null check (kind in ('reminder', 'expiring')),
  user_id uuid not null references users(id),
  business_id uuid references businesses(id),
  created_at timestamptz not null
);
create index if not exists notification_log_business_idx on notification_log(business_id, kind);
