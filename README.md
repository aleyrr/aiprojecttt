# NutriCare

A nutrition coaching web app for clients in Cairo. This repo holds the website (`public/`) and the back-end API (`api/`, `src/`): Node.js + Express, a Supabase Postgres database, and our own login (bcrypt passwords, JWT in an httpOnly cookie). Hosted on Vercel.

## Run it locally

1. In the Supabase SQL editor run, in this order: `sql/schema.sql`, `sql/schema_update.sql`, `sql/failed_logins.sql`.
2. `npm install`
3. Copy `.env.example` to `.env` and fill it in (never commit `.env`):
   - `DATABASE_URL`: Supabase **Transaction pooler** string (port 6543). Supabase dashboard, Connect button.
   - `JWT_SECRET`: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - `PAYMENT_WEBHOOK_SECRET`: another random string made the same way
4. `npm start`, then open http://localhost:3000 and http://localhost:3000/api/health
5. Create the admin: `ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-long-password' npm run create-admin`

There is no build step. The site is one HTML file in `public/` that talks to the API (`/api/...`); the API runs as one Vercel function.

## Deploy on Vercel

1. vercel.com, Sign Up with GitHub (free Hobby plan), then Add New, Project, Import `aiprojecttt`.
2. Framework Preset: **Other**. Leave Build Command and Output Directory empty.
3. Environment Variables (same names as `.env`): `DATABASE_URL`, `JWT_SECRET`, `PAYMENT_WEBHOOK_SECRET`.
4. Deploy, then open the live link.
5. Test: `/api/health` returns `{"ok":true}`, then register, log in, book an appointment.

Supabase Auth is not used (login is our own code), so there is no Site URL or Redirect URL to set in Supabase.

Vercel's free Hobby plan is for non-commercial use; check their terms before charging real clients.

## Layout

```
public/index.html         the website (one file, pages switch by URL hash)
api/index.js            Express app (exported for Vercel)
src/db.js               pg Pool + transaction helper
src/auth.js             bcrypt, JWT cookie, role checks
src/loginLimit.js       failed-login lockout
src/payments.js         settlePayment + webhook signature check
src/profile.js          profile read/update helpers
src/validate.js         input validators
src/routes/*.js         auth, clients, plans, coaches, appointments, community, messages, admin, webhooks
scripts/create-admin.js creates the admin account
sql/                    schema.sql, schema_update.sql, failed_logins.sql
```

## Payments

`POST /api/subscriptions` creates a **pending** payment. The coach and the Intro session are set only when the payment is confirmed, by the signed webhook (`POST /api/webhooks/payments`, header `x-signature` = HMAC-SHA256 hex of the raw body) or by an admin (`POST /api/admin/payments/:reference/confirm`). The webhook format is a placeholder; adapt `src/routes/webhooks.js` and `verifySignature()` in `src/payments.js` to your provider.
