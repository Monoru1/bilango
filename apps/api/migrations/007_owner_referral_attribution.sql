-- Attribution unique à l'inscription ; crédits conservés séparément, sans prolongation automatique.
alter table owner_referral_codes add constraint owner_referral_owner_code_unique unique (owner_id,code);
create table owner_referral_attributions (
  referred_user_id uuid primary key references users(id),
  owner_id uuid not null,
  code text not null,
  created_at timestamptz not null,
  check (referred_user_id <> owner_id),
  foreign key (owner_id,code) references owner_referral_codes(owner_id,code)
);
create trigger owner_referral_attributions_append_only before update or delete on owner_referral_attributions
  for each row execute function forbid_mutation();

create table owner_referral_rewards (
  referred_user_id uuid primary key references owner_referral_attributions(referred_user_id),
  payment_id uuid not null unique references payments(id),
  days integer not null default 30 check (days = 30),
  created_at timestamptz not null
);
create trigger owner_referral_rewards_append_only before update or delete on owner_referral_rewards
  for each row execute function forbid_mutation();
