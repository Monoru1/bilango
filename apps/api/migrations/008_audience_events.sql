create table audience_events (
  event_key text primary key,
  visitor_key text not null,
  visit_key text,
  kind text not null check (kind in ('visit', 'install_click', 'android_install', 'first_open', 'registration')),
  platform text not null check (platform in ('android', 'ios', 'other')),
  source text not null check (source in ('direct', 'whatsapp', 'facebook', 'tiktok', 'agent', 'influencer', 'other')),
  day date not null,
  check ((kind = 'visit') = (visit_key is not null))
);
create index audience_events_by_day on audience_events(day);
create index audience_events_by_visitor on audience_events(visitor_key, day);
create unique index audience_events_once_per_visitor
  on audience_events(visitor_key, kind) where kind in ('first_open', 'android_install');
create unique index audience_events_once_per_visit
  on audience_events(visit_key, day) where kind = 'visit';

create table audience_collection (
  singleton boolean primary key check (singleton),
  started_on date not null
);
