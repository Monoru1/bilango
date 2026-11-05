-- A provider acknowledgement is durable before fetching the checkout token.
alter table payments add column request_key uuid;
alter table payments add column checkout_url text;
alter table payments add column initialization_started_at timestamptz;
create unique index payments_request_key on payments(business_id,request_key) where request_key is not null;
