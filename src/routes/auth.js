const router = require('express').Router();
const { q, tx } = require('../db');
const { wrap, HttpError } = require('../http');
const { hashPassword, verifyPassword, issueToken, clearToken, requireLogin } = require('../auth');
const { assertNotLocked, recordFailure, clearFailures } = require('../loginLimit');
const { getProfile } = require('../profile');
const v = require('../validate');

router.post('/register', wrap(async (req, res) => {
  const b = req.body ?? {};
  const name = v.text(b.name, 'Name', { min: 2, max: 100 });
  const email = v.email(b.email);
  const password = v.password(b.password);
  const hash = await hashPassword(password);

  let user;
  try {
    user = await tx(async (c) => {
      const client = await c.query('insert into clients (name, email) values ($1, $2) returning id', [name, email]);
      const u = await c.query(
        `insert into users (email, password_hash, role, client_id)
         values ($1, $2, 'client', $3) returning id, role, client_id`,
        [email, hash, client.rows[0].id]
      );
      return u.rows[0];
    });
  } catch (e) {
    if (e.code === '23505') throw new HttpError(409, 'An account with this email already exists');
    throw e;
  }

  issueToken(res, user);
  res.status(201).json({ role: user.role, profile: await getProfile(user.client_id) });
}));

router.post('/login', wrap(async (req, res) => {
  const b = req.body ?? {};
  const email = v.email(b.email);
  if (typeof b.password !== 'string' || !b.password) throw new HttpError(400, 'Password is required');

  try {
    await assertNotLocked(email, req.ip);
  } catch (e) {
    if (e.retryAfter) res.set('Retry-After', String(e.retryAfter));
    throw e;
  }

  const { rows } = await q(
    'select id, password_hash, role, client_id from users where lower(email) = lower($1)',
    [email]
  );
  const user = rows[0];
  const ok = await verifyPassword(b.password, user?.password_hash);
  if (!user || !ok) {
    await recordFailure(email, req.ip); // counted the same whether or not the email exists
    throw new HttpError(401, 'Incorrect email or password');
  }

  await clearFailures(email);
  issueToken(res, user);
  const profile = user.client_id ? await getProfile(user.client_id) : null;
  res.json({ role: user.role, profile });
}));

router.post('/logout', (req, res) => {
  clearToken(res);
  res.json({ ok: true });
});

router.get('/me', requireLogin, wrap(async (req, res) => {
  const profile = req.user.clientId ? await getProfile(req.user.clientId) : null;
  res.json({ role: req.user.role, profile });
}));

module.exports = router;
