const router = require('express').Router();
const { q } = require('../db');
const { wrap, HttpError } = require('../http');
const { requireClient } = require('../auth');
const v = require('../validate');

const TYPES = ['Check-in call', 'Meal plan review', 'Progress review', 'Intro session'];
const RETURNING = `id, appt_date::text as date, to_char(appt_time, 'HH24:MI') as time,
                   type, reminder, coach_id as "coachId"`;

router.get('/appointments', requireClient, wrap(async (req, res) => {
  const { rows } = await q(
    `select a.id, a.appt_date::text as date, to_char(a.appt_time, 'HH24:MI') as time,
            a.type, a.reminder, a.coach_id as "coachId", c.name as "coachName"
     from appointments a left join coaches c on c.id = a.coach_id
     where a.client_id = $1 order by a.appt_date, a.appt_time`,
    [req.user.clientId]
  );
  res.json(rows);
}));

router.post('/appointments', requireClient, wrap(async (req, res) => {
  const b = req.body ?? {};
  const type = v.oneOf(b.type, 'Appointment type', TYPES);
  const date = v.date(b.date, 'Date');
  const time = v.time(b.time, 'Time');
  const reminder = b.reminder === undefined ? false : v.bool(b.reminder, 'Reminder');

  const { rows: [me] } = await q(
    `select coach_id, (now() at time zone 'Africa/Cairo')::date::text as today from clients where id = $1`,
    [req.user.clientId]
  );
  if (!me) throw new HttpError(401, 'Your account no longer exists');
  if (!me.coach_id) throw new HttpError(400, 'Choose a coach before booking an appointment');
  if (date < me.today) throw new HttpError(400, 'Date cannot be in the past');

  const taken = await q(
    'select 1 from appointments where coach_id = $1 and appt_date = $2 and appt_time = $3',
    [me.coach_id, date, time]
  );
  if (taken.rowCount) throw new HttpError(409, 'That time is already booked. Please choose another time');

  const { rows } = await q(
    `insert into appointments (client_id, coach_id, appt_date, appt_time, type, reminder)
     values ($1, $2, $3, $4, $5, $6) returning ${RETURNING}`,
    [req.user.clientId, me.coach_id, date, time, type, reminder]
  );
  res.status(201).json(rows[0]);
}));

router.delete('/appointments/:id', requireClient, wrap(async (req, res) => {
  const id = v.uuid(req.params.id, 'Appointment id');
  const { rowCount } = await q('delete from appointments where id = $1 and client_id = $2', [id, req.user.clientId]);
  if (!rowCount) throw new HttpError(404, 'Appointment not found');
  res.json({ deleted: true });
}));

router.patch('/appointments/:id/reminder', requireClient, wrap(async (req, res) => {
  const id = v.uuid(req.params.id, 'Appointment id');
  const reminder = v.bool((req.body ?? {}).reminder, 'Reminder');
  const { rows } = await q(
    `update appointments set reminder = $1 where id = $2 and client_id = $3 returning ${RETURNING}`,
    [reminder, id, req.user.clientId]
  );
  if (!rows.length) throw new HttpError(404, 'Appointment not found');
  res.json(rows[0]);
}));

module.exports = router;
