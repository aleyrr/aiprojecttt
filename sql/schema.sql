-- NutriCare base schema (run first, before schema_update.sql).
create extension if not exists pgcrypto;

create table coaches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  specialty text,
  bio text,
  monthly_price_egp integer not null check (monthly_price_egp >= 0),
  rating numeric(2,1),
  created_at timestamptz not null default now()
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  phone text,
  city text,
  age integer check (age between 10 and 120),
  sex text check (sex in ('f','m')),
  height_cm numeric(5,1),
  activity_factor numeric(4,3) not null default 1.375,
  goal text not null default 'maintain' check (goal in ('lose','maintain','gain')),
  goal_weight_kg numeric(5,1),
  notes text,
  coach_id uuid references coaches(id) on delete set null,
  created_at timestamptz not null default now()
);

create table foods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  emoji text,
  kcal integer not null,
  protein_g numeric(5,1) not null default 0,
  carbs_g numeric(5,1) not null default 0,
  fat_g numeric(5,1) not null default 0
);

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  price_egp integer,
  ingredients text,
  kcal integer,
  protein_g numeric(5,1)
);

create table weight_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  entry_date date not null,
  weight_kg numeric(5,1) not null check (weight_kg between 30 and 300),
  unique (client_id, entry_date)
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  coach_id uuid references coaches(id) on delete set null,
  appt_date date not null,
  appt_time time not null,
  type text not null
);
