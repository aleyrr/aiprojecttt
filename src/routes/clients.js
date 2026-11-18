const router = require('express').Router();
const { q, tx } = require('../db');
const { wrap, HttpError } = require('../http');
const { requireClient } = require('../auth');
const { getProfile, updateProfile } = require('../profile');
const v = require('../validate');

const CALCULATOR_RULES = {
  age: (x) => v.int(x, 'Age', 10, 120),
  sex: (x) => v.oneOf(x, 'Sex', ['f', 'm']),
  heightCm: (x) => v.num(x, 'Height', 50, 250),
  activityFactor: (x) => v.num(x, 'Activity factor', 1, 2.5),
  goal: (x) => v.oneOf(x, 'Goal', ['lose', 'maintain', 'gain']),
  goalWeightKg: (x) => v.num(x, 'Goal weight', 30, 300),
};

const PROFILE_RULES = {
  name: (x) => v.text(x, 'Name', { min: 2, max: 100 }),
  email: (x) => v.email(x),
  phone: v.optional((x) => v.text(x, 'Phone', { max: 30 })),
  city: v.optional((x) => v.text(x, 'City', { max: 80 })),
  notes: v.optional((x) => v.text(x, 'Health notes', { max: 1000 })),
  strugglingWith: v.optional((x) => v.text(x, 'Struggling with', { max: 140 })),
};

router.get('/calculator', requireClient, wrap(async (req, res) => {
  res.json(await getProfile(req.user.clientId));
}));

router.put('/calculator', requireClient, wrap(async (req, res) => {
  const fields = v.pick(req.body ?? {}, CALCULATOR_RULES);
  await tx((c) => updateProfile(c, req.user.clientId, fields));
  res.json(await getProfile(req.user.clientId));
}));

router.get('/profile', requireClient, wrap(async (req, res) => {
  res.json(await getProfile(req.user.clientId));
}));

router.put('/profile', requireClient, wrap(async (req, res) => {
  const fields = v.pick(req.body ?? {}, PROFILE_RULES);
  try {
    await tx(async (c) => {
      await updateProfile(c, req.user.clientId, fields);
      if (fields.email) await c.query('update users set email = $1 where id = $2', [fields.email, req.user.id]);
    });
  } catch (e) {
    if (e.code === '23505') throw new HttpError(409, 'That email is already used by another account');
    throw e;
  }
  res.json(await getProfile(req.user.clientId));
}));

router.get('/weights', requireClient, wrap(async (req, res) => {
  const { rows } = await q(
    `select entry_date::text as date, weight_kg::float8 as "weightKg"
     from weight_entries where client_id = $1 order by entry_date`,
    [req.user.clientId]
  );
  res.json({ entries: rows, currentWeightKg: rows.length ? rows[rows.length - 1].weightKg : null });
}));

// Replaces today's entry if it exists (today = Cairo date).
router.post('/weights', requireClient, wrap(async (req, res) => {
  const weightKg = v.num((req.body ?? {}).weightKg, 'Weight', 30, 300);
  const { rows } = await q(
    `insert into weight_entries (client_id, entry_date, weight_kg)
     values ($1, (now() at time zone 'Africa/Cairo')::date, $2)
     on conflict (client_id, entry_date) do update set weight_kg = excluded.weight_kg
     returning entry_date::text as date, weight_kg::float8 as "weightKg"`,
    [req.user.clientId, weightKg]
  );
  res.status(201).json(rows[0]);
}));

module.exports = router;
