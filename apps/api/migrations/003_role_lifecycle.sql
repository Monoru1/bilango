alter table roles add column archived_at timestamptz;
alter table partners add column agreement_renewal_required boolean not null default false;
