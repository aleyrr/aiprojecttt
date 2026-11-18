# NutriCare backend

Node.js + Express REST API on Supabase Postgres, hosted on Vercel. Login is our own code (bcrypt + JWT in an httpOnly cookie).

## Setup

1. Run the SQL in the Supabase SQL editor, in this order:
   1. your existing `schema.sql` (already run)
   2. `sql/schema_update.sql`
   3. `sql/failed_logins.sql`
2. `npm install`
3. Copy `.env.example` to `.env` and fill it in:
   - `DATABASE_URL`: Supabase **Transaction pooler** string (port 6543)
   - `JWT_SECRET`: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - `PAYMENT_WEBHOOK_SECRET`: another random string
4. `npm start` then open http://localhost:3000/api/health
5. Create the admin: `ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-long-password' npm run create-admin`
6. Replace `public/index.html` with your front end (see `docs/appointments-page-snippet.html`).

## Deploy to Vercel

Push to GitHub, import the repo in Vercel, and add `DATABASE_URL`, `JWT_SECRET` and `PAYMENT_WEBHOOK_SECRET` under Environment Variables. (Vercel's free Hobby plan is for non-commercial use; check their terms once you charge clients.)

## Layout

```
api/index.js            Express app (exported for Vercel)
src/db.js               pg Pool + transaction helper
src/auth.js             bcrypt, JWT cookie, role checks
src/loginLimit.js       failed-login lockout
src/payments.js         settlePayment + webhook signature check
src/profile.js          profile read/update helpers
src/validate.js         input validators
src/routes/*.js         auth, clients, plans, coaches, appointments, community, messages, admin, webhooks
scripts/create-admin.js creates the admin account
sql/                    schema_update.sql, failed_logins.sql
```

## Payments

`POST /api/subscriptions` creates a **pending** payment. The coach and the Intro session are set only when the payment is confirmed, by the signed webhook (`POST /api/webhooks/payments`, header `x-signature` = HMAC-SHA256 hex of the raw body) or by an admin (`POST /api/admin/payments/:reference/confirm`). The webhook format is a placeholder; adapt `src/routes/webhooks.js` and `verifySignature()` in `src/payments.js` to your provider.
