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

-- Final step: row level security on every NutriCare table. The backend connects as the database
-- owner (bypasses RLS), so the app keeps working, while the public Supabase API key can read or
-- change nothing. (Already applied to the live project.)
alter table coaches enable row level security;
alter table clients enable row level security;
alter table foods enable row level security;
alter table products enable row level security;
alter table weight_entries enable row level security;
alter table appointments enable row level security;
alter table users enable row level security;
alter table meal_plans enable row level security;
alter table meal_plan_variants enable row level security;
alter table meal_variant_foods enable row level security;
alter table payments enable row level security;
alter table friend_requests enable row level security;
alter table friend_messages enable row level security;
alter table coach_messages enable row level security;
alter table failed_logins enable row level security;
