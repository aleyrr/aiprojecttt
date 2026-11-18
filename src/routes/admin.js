const router = require('express').Router();
const { q } = require('../db');
const { wrap, HttpError } = require('../http');
const { requireAdmin } = require('../auth');
const { validReference, settlePayment } = require('../payments');
const v = require('../validate');

router.use(requireAdmin); // every route below is admin-only

router.get('/clients', wrap(async (req, res) => {
  const { rows } = await q(
    `select c.id, c.name, c.email, c.goal,
            co.name as "coachName", mp.title as "planTitle",
            fw.weight_kg::float8 as "startWeightKg", lw.weight_kg::float8 as "currentWeightKg"
     from clients c
     left join coaches co on co.id = c.coach_id
     left join meal_plans mp on mp.goal = c.goal
     left join lateral (select weight_kg from weight_entries w where w.client_id = c.id
                        order by entry_date asc limit 1) fw on true
     left join lateral (select weight_kg from weight_entries w where w.client_id = c.id
                        order by entry_date desc limit 1) lw on true
     order by c.name`
  );
  res.json(rows);
}));

router.get('/revenue', wrap(async (req, res) => {
  const { rows } = await q(
    `select co.id as "coachId", co.name,
            coalesce(sum(p.total_egp) filter (where p.status = 'paid'), 0)::float8 as "revenueEgp",
            coalesce(sum(p.vat_egp) filter (where p.status = 'paid'), 0)::float8 as "vatEgp",
            (count(p.id) filter (where p.status = 'paid'))::int as payments
     from coaches co left join payments p on p.coach_id = co.id
     group by co.id order by "revenueEgp" desc, co.name`
  );
  res.json(rows);
}));

router.patch('/coaches/:id/price', wrap(async (req, res) => {
  const id = v.uuid(req.params.id, 'Coach id');
  const price = v.int((req.body ?? {}).monthlyPriceEgp, 'Monthly price', 0, 100000);
  const { rows } = await q(
    `update coaches set monthly_price_egp = $1 where id = $2
     returning id, name, monthly_price_egp as "monthlyPriceEgp"`,
    [price, id]
  );
  if (!rows.length) throw new HttpError(404, 'Coach not found');
  res.json(rows[0]);
}));

router.patch('/products/:id/verified', wrap(async (req, res) => {
  const id = v.uuid(req.params.id, 'Product id');
  const verified = v.bool((req.body ?? {}).verified, 'Verified');
  const { rows } = await q(
    'update products set verified = $1 where id = $2 returning id, name, verified',
    [verified, id]
  );
  if (!rows.length) throw new HttpError(404, 'Product not found');
  res.json(rows[0]);
}));

const PRODUCT_RULES = {
  name: (x) => v.text(x, 'Name', { max: 150 }),
  brand: v.optional((x) => v.text(x, 'Brand', { max: 100 })),
  priceEgp: v.optional((x) => v.int(x, 'Price', 0, 1000000)),
  ingredients: v.optional((x) => v.text(x, 'Ingredients', { max: 2000 })),
  kcal: v.optional((x) => v.int(x, 'Calories', 0, 5000)),
  proteinG: v.optional((x) => v.num(x, 'Protein', 0, 500)),
};

router.post('/products', wrap(async (req, res) => {
  const p = v.pick(req.body ?? {}, PRODUCT_RULES);
  if (!p.name) throw new HttpError(400, 'Name is required');
  const { rows } = await q(
    `insert into products (name, brand, price_egp, ingredients, kcal, protein_g, verified)
     values ($1, $2, $3, $4, $5, $6, false)
     returning id, name, brand, price_egp as "priceEgp", ingredients, kcal,
               protein_g::float8 as "proteinG", verified`,
    [p.name, p.brand ?? null, p.priceEgp ?? null, p.ingredients ?? null, p.kcal ?? null, p.proteinG ?? null]
  );
  res.status(201).json(rows[0]);
}));

// ---- payments the admin can confirm by hand (Fawry, Vodafone Cash, InstaPay transfers...) ----
router.get('/payments', wrap(async (req, res) => {
  const status = req.query.status === undefined
    ? 'pending'
    : v.oneOf(req.query.status, 'Status', ['pending', 'paid', 'failed', 'refunded']);
  const { rows } = await q(
    `select p.reference, p.method, p.status, p.paid_at as "createdAt", p.total_egp::float8 as "totalEgp",
            c.name as "clientName", co.name as "coachName"
     from payments p
     join clients c on c.id = p.client_id
     left join coaches co on co.id = p.coach_id
     where p.status = $1 order by p.paid_at desc limit 100`,
    [status]
  );
  res.json(rows);
}));

router.post('/payments/:reference/confirm', wrap(async (req, res) => {
  res.json(await settlePayment(validReference(req.params.reference), 'paid'));
}));

// ---- coach chat: an admin answers as the client's coach ----
async function coachOf(clientId) {
  const { rows } = await q('select coach_id from clients where id = $1', [clientId]);
  if (!rows.length) throw new HttpError(404, 'Client not found');
  if (!rows[0].coach_id) throw new HttpError(400, 'This client has no coach yet');
  return rows[0].coach_id;
}

router.get('/coach-messages', wrap(async (req, res) => {
  const { rows } = await q(
    `select * from (
       select distinct on (m.client_id)
              m.client_id as "clientId", c.name as "clientName", co.name as "coachName",
              (m.sender = 'client') as "needsReply", m.body as "lastMessage", m.created_at as "lastAt"
       from coach_messages m
       join clients c on c.id = m.client_id and c.coach_id = m.coach_id
       left join coaches co on co.id = m.coach_id
       order by m.client_id, m.created_at desc) t
     order by "needsReply" desc, "lastAt" desc`
  );
  res.json(rows);
}));

router.get('/coach-messages/:clientId', wrap(async (req, res) => {
  const clientId = v.uuid(req.params.clientId, 'Client id');
  const coachId = await coachOf(clientId);
  const { rows } = await q(
    `select * from (
       select id, sender, body, created_at as "createdAt" from coach_messages
       where client_id = $1 and coach_id = $2 order by created_at desc limit 200) t
     order by "createdAt"`,
    [clientId, coachId]
  );
  res.json(rows);
}));

router.post('/coach-messages/:clientId', wrap(async (req, res) => {
  const clientId = v.uuid(req.params.clientId, 'Client id');
  const text = v.text((req.body ?? {}).body, 'Message', { max: 1000 });
  const coachId = await coachOf(clientId);
  const { rows } = await q(
    `insert into coach_messages (client_id, coach_id, sender, body) values ($1, $2, 'coach', $3)
     returning id, sender, body, created_at as "createdAt"`,
    [clientId, coachId, text]
  );
  res.status(201).json(rows[0]);
}));

module.exports = router;
