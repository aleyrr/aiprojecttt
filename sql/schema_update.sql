-- NutriCare schema update (run once, after schema.sql).
-- Adds only what the pages need. Nothing is dropped or deleted.

begin;

-- 1. Login accounts (own auth code). Hash only, never a plain password.
create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,               -- bcrypt output from the backend
  role text not null check (role in ('client','admin')),
  client_id uuid unique references clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((role = 'client' and client_id is not null) or (role = 'admin' and client_id is null))
);

-- 2. Case-insensitive unique login email
create unique index users_email_lower_idx on users (lower(email));

-- 3. Keep password hashes unreadable through any public API key (the backend's owner role still works)
alter table users enable row level security;

-- 4. Community: short "struggling with" text on the client
alter table clients add column struggling_with text;

-- 5. Admin can verify products
alter table products add column verified boolean not null default false;

-- 6. Appointment reminder on/off
alter table appointments add column reminder boolean not null default false;

-- 7. Restrict appointment types (NOT VALID so existing rows can't make the script fail)
alter table appointments add constraint appointments_type_check
  check (type in ('Check-in call','Meal plan review','Progress review','Intro session')) not valid;

-- 8. Meal plans: one plan per goal
create table meal_plans (
  id uuid primary key default gen_random_uuid(),
  goal text not null unique check (goal in ('lose','maintain','gain')),
  title text not null
);

-- 9. Meal plan variants: 4 slots x 3 variants per plan
create table meal_plan_variants (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references meal_plans(id) on delete cascade,
  slot text not null check (slot in ('breakfast','lunch','snack','dinner')),
  variant_no smallint not null check (variant_no between 1 and 3),
  unique (plan_id, slot, variant_no)
);

-- 10. Foods inside each variant (a food in use cannot be deleted)
create table meal_variant_foods (
  variant_id uuid not null references meal_plan_variants(id) on delete cascade,
  food_id uuid not null references foods(id) on delete restrict,
  primary key (variant_id, food_id)
);

-- 11. Payment history (method, amount, reference only; no card data)
create table payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  coach_id uuid references coaches(id) on delete set null,
  method text not null check (method in ('card','fawry','vodafone_cash','instapay')),
  subtotal_egp numeric(10,2) not null check (subtotal_egp >= 0),
  vat_egp numeric(10,2) not null check (vat_egp >= 0),
  total_egp numeric(10,2) not null check (total_egp >= 0),
  reference text not null unique,            -- gateway/Fawry/wallet reference
  status text not null default 'paid' check (status in ('pending','paid','failed','refunded')),
  paid_at timestamptz not null default now(),
  check (total_egp = subtotal_egp + vat_egp)
);
create index payments_client_idx on payments (client_id, paid_at desc);
create index payments_coach_idx on payments (coach_id);

-- 12. Friend requests (one row per pair, any direction; friends = accepted rows)
create table friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references clients(id) on delete cascade,
  receiver_id uuid not null references clients(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (sender_id <> receiver_id)
);
create unique index friend_requests_pair_idx
  on friend_requests (least(sender_id, receiver_id), greatest(sender_id, receiver_id));
create index friend_requests_receiver_idx on friend_requests (receiver_id, status);

-- 13. Chat between friends
create table friend_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references clients(id) on delete cascade,
  receiver_id uuid not null references clients(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  check (sender_id <> receiver_id)
);
create index friend_messages_pair_idx
  on friend_messages (least(sender_id, receiver_id), greatest(sender_id, receiver_id), created_at);

-- 14. Chat between a client and their coach
create table coach_messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  coach_id uuid references coaches(id) on delete set null,
  sender text not null check (sender in ('client','coach')),
  body text not null,
  created_at timestamptz not null default now()
);
create index coach_messages_thread_idx on coach_messages (client_id, coach_id, created_at);

-- 15. Faster admin dashboard (clients per coach)
create index clients_coach_idx on clients (coach_id);

commit;
