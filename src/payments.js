const crypto = require('crypto');
const { tx } = require('./db');
const { HttpError } = require('./http');

const REFERENCE = /^[A-Za-z0-9_-]{6,64}$/;
const validReference = (x) => {
  if (typeof x !== 'string' || !REFERENCE.test(x)) throw new HttpError(400, 'Reference must be 6-64 letters, numbers, dashes or underscores');
  return x;
};

// Checks that the webhook body was signed with PAYMENT_WEBHOOK_SECRET (HMAC-SHA256, hex).
function verifySignature(rawBody, signature) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret || !rawBody || typeof signature !== 'string') return false;
  const expected = Buffer.from(crypto.createHmac('sha256', secret).update(rawBody).digest('hex'));
  const given = Buffer.from(signature);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

// outcome: 'paid' or 'failed'. Safe to call twice for the same reference.
async function settlePayment(reference, outcome, amountEgp) {
  return tx(async (c) => {
    const { rows } = await c.query(
      `select id, client_id, coach_id, status, total_egp::float8 as total
       from payments where reference = $1 for update`,
      [reference]
    );
    const p = rows[0];
    if (!p) throw new HttpError(404, 'No payment found with that reference');
    if (amountEgp !== undefined && Math.abs(amountEgp - p.total) > 0.001) {
      throw new HttpError(409, 'The amount does not match this payment');
    }

    if (outcome === 'failed') {
      if (p.status === 'pending') await c.query(`update payments set status = 'failed' where id = $1`, [p.id]);
      return { reference, status: p.status === 'pending' ? 'failed' : p.status };
    }

    if (p.status === 'paid') return { reference, status: 'paid' }; // already done, nothing repeated
    if (p.status !== 'pending') throw new HttpError(409, `This payment is ${p.status} and cannot be confirmed`);
    if (!p.coach_id) throw new HttpError(409, 'The coach for this payment no longer exists');

    await c.query(`update payments set status = 'paid', paid_at = now() where id = $1`, [p.id]);
    await c.query('update clients set coach_id = $1 where id = $2', [p.coach_id, p.client_id]);
    await c.query(
      `insert into appointments (client_id, coach_id, appt_date, appt_time, type, reminder)
       values ($1, $2, (now() at time zone 'Africa/Cairo')::date + 2, '10:00', 'Intro session', true)`,
      [p.client_id, p.coach_id]
    );
    return { reference, status: 'paid' };
  });
}

module.exports = { validReference, verifySignature, settlePayment };
