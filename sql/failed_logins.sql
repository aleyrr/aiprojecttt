-- Run once, after schema_update.sql. Stores failed logins for the lockout (5 per email / 20 per IP in 15 minutes).
create table if not exists failed_logins (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  ip text,
  attempted_at timestamptz not null default now()
);
create index if not exists failed_logins_email_idx on failed_logins (email, attempted_at desc);
create index if not exists failed_logins_ip_idx on failed_logins (ip, attempted_at desc);
create index if not exists failed_logins_time_idx on failed_logins (attempted_at);
alter table failed_logins enable row level security;
