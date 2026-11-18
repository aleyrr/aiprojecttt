const router = require('express').Router();
const { wrap, HttpError } = require('../http');
const { validReference, verifySignature, settlePayment } = require('../payments');
const v = require('../validate');

// Expected body: { "reference": "...", "status": "paid" | "failed", "amountEgp": 570 (optional) }
// Header: x-signature = HMAC-SHA256 (hex) of the raw body using PAYMENT_WEBHOOK_SECRET.
// Real providers (Paymob, Fawry...) each send their own format and signature. When you pick one,
// change only this file and verifySignature() in src/payments.js.
router.post('/payments', wrap(async (req, res) => {
  if (!process.env.PAYMENT_WEBHOOK_SECRET) throw new HttpError(503, 'Payment confirmation is not set up yet');
  if (!verifySignature(req.rawBody, req.headers['x-signature'])) throw new HttpError(401, 'Invalid signature');

  const b = req.body ?? {};
  const reference = validReference(b.reference);
  const status = v.oneOf(b.status, 'Status', ['paid', 'failed']);
  const amount = b.amountEgp === undefined ? undefined : v.num(b.amountEgp, 'Amount', 0, 10000000);
  res.json(await settlePayment(reference, status, amount));
}));

module.exports = router;
