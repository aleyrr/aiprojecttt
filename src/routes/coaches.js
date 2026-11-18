const crypto = require('crypto');
const router = require('express').Router();
const { q } = require('../db');
const { wrap, HttpError } = require('../http');
const { requireLogin, requireClient } = require('../auth');
const { validReference } = require('../payments');
const v = require('../validate');

const METHODS = ['card', 'fawry', 'vodafone_cash', 'instapay'];
const CARD_FIELDS = ['cardNumber', 'card', 'cvc', 'cvv', 'expiry', 'pan'];

const makeReference = () =>
  `NC-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

router.get('/coaches', requireLogin, wrap(async (req, res) => {
  const { rows } = await q(
    `select c.id, c.name, c.specialty, c.bio, c.monthly_price_egp as "monthlyPriceEgp",
            c.rating::float8 as rating, count(cl.id)::int as "clientCount"
     from coaches c left join clients cl on cl.coach_id = c.id
     group by c.id order by c.name`
  );
  res.json(rows);
}));

// Step 1 of subscribing: creates a PENDING payment (price + 14% VAT). Nothing else changes yet.
// The coach and the Intro session are set when the payment is confirmed (see src/payments.js).
router.post('/subscriptions', requireClient, wrap(async (req, res) => {
  const b = req.body ?? {};
  for (const k of CARD_FIELDS) {
    if (k in b) throw new HttpError(400, 'Do not send card details to this server. Send only the payment method and reference');
  }
  const coachId = v.uuid(b.coachId, 'Coach');
  const method = v.oneOf(b.method, 'Payment method', METHODS);
  const reference = b.reference === undefined ? makeReference() : validReference(b.reference);

  const open = await q(
    `select reference from payments
     where client_id = $1 and status = 'pending' and paid_at > now() - interval '1 hour' limit 1`,
    [req.user.clientId]
  );
  if (open.rowCount) {
    throw new HttpError(409, `You already have a payment waiting for confirmation (reference ${open.rows[0].reference}). Complete it, or try again in an hour`);
  }

  const coach = (await q('select id, name, monthly_price_egp from coaches where id = $1', [coachId])).rows[0];
  if (!coach) throw new HttpError(404, 'Coach not found');

  try {
    const { rows } = await q(
      `insert into payments (client_id, coach_id, method, subtotal_egp, vat_egp, total_egp, reference, status)
       values ($1, $2, $3, $4::numeric, round($4::numeric * 0.14, 2),
               $4::numeric + round($4::numeric * 0.14, 2), $5, 'pending')
       returning id, reference, method, status, paid_at as "paidAt",
                 subtotal_egp::float8 as "subtotalEgp", vat_egp::float8 as "vatEgp", total_egp::float8 as "totalEgp"`,
      [req.user.clientId, coachId, method, coach.monthly_price_egp, reference]
    );
    res.status(201).json({
      coach: { id: coach.id, name: coach.name },
      payment: rows[0],
      message: 'Payment created. Your coach and Intro session are set once the payment is confirmed.',
    });
  } catch (e) {
    if (e.code === '23505') throw new HttpError(409, 'That payment reference was already used');
    throw e;
  }
}));

router.get('/payments', requireClient, wrap(async (req, res) => {
  const { rows } = await q(
    `select p.id, p.paid_at as "paidAt", p.reference, c.name as "coachName", p.method, p.status,
            p.subtotal_egp::float8 as "subtotalEgp", p.vat_egp::float8 as "vatEgp", p.total_egp::float8 as "totalEgp"
     from payments p left join coaches c on c.id = p.coach_id
     where p.client_id = $1 order by p.paid_at desc`,
    [req.user.clientId]
  );
  res.json(rows);
}));

module.exports = router;
