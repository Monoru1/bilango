-- Répertoire unique partagé entre codes partenaires et owners, y compris codes retirés.
create table referral_code_registry (
  code text primary key,
  kind text not null check (kind in ('partner','owner')),
  unique (code, kind)
);
insert into referral_code_registry(code,kind)
  select upper(promo_code), 'partner' from partners where promo_code is not null;
create trigger referral_code_registry_immutable before update or delete on referral_code_registry
  for each row execute function forbid_mutation();

create function reserve_partner_referral_code() returns trigger language plpgsql as $$
begin
  if new.promo_code is not null and (tg_op = 'INSERT' or new.promo_code is distinct from old.promo_code) then
    insert into referral_code_registry(code,kind) values(upper(new.promo_code),'partner');
  end if;
  return new;
end $$;
create trigger reserve_partner_referral_code before insert or update of promo_code on partners
  for each row execute function reserve_partner_referral_code();

create table owner_referral_codes (
  owner_id uuid primary key references users(id),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  kind text not null default 'owner' check (kind = 'owner'),
  active boolean not null default true,
  created_at timestamptz not null,
  foreign key (code,kind) references referral_code_registry(code,kind)
);
create function owner_referral_code_immutable() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'Un code de parrainage owner ne peut pas être supprimé'; end if;
  if new.code <> old.code or new.owner_id <> old.owner_id or new.created_at <> old.created_at or new.kind <> old.kind then
    raise exception 'Un code de parrainage owner ne peut pas être réattribué';
  end if;
  return new;
end $$;
create trigger owner_referral_code_immutable before update or delete on owner_referral_codes
  for each row execute function owner_referral_code_immutable();
