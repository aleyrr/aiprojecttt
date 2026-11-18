const router = require('express').Router();
const { q } = require('../db');
const { wrap, HttpError } = require('../http');
const { requireClient } = require('../auth');
const v = require('../validate');

const body = (req) => v.text((req.body ?? {}).body, 'Message', { max: 1000 });

async function requireFriend(me, friendId) {
  const { rowCount } = await q(
    `select 1 from friend_requests
     where status = 'accepted'
       and least(sender_id, receiver_id) = least($1::uuid, $2::uuid)
       and greatest(sender_id, receiver_id) = greatest($1::uuid, $2::uuid)`,
    [me, friendId]
  );
  if (!rowCount) throw new HttpError(403, 'You can only chat with accepted friends');
}

async function myCoachId(clientId) {
  const { rows } = await q('select coach_id from clients where id = $1', [clientId]);
  if (!rows[0]?.coach_id) throw new HttpError(400, 'Choose a coach first to chat with them');
  return rows[0].coach_id;
}

router.get('/friends/:friendId', requireClient, wrap(async (req, res) => {
  const friendId = v.uuid(req.params.friendId, 'Friend');
  await requireFriend(req.user.clientId, friendId);
  const { rows } = await q(
    `select * from (
       select id, sender_id = $1 as mine, body, created_at as "createdAt"
       from friend_messages
       where least(sender_id, receiver_id) = least($1::uuid, $2::uuid)
         and greatest(sender_id, receiver_id) = greatest($1::uuid, $2::uuid)
       order by created_at desc limit 200) t
     order by "createdAt"`,
    [req.user.clientId, friendId]
  );
  res.json(rows);
}));

router.post('/friends/:friendId', requireClient, wrap(async (req, res) => {
  const friendId = v.uuid(req.params.friendId, 'Friend');
  const text = body(req);
  await requireFriend(req.user.clientId, friendId);
  const { rows } = await q(
    `insert into friend_messages (sender_id, receiver_id, body) values ($1, $2, $3)
     returning id, true as mine, body, created_at as "createdAt"`,
    [req.user.clientId, friendId, text]
  );
  res.status(201).json(rows[0]);
}));

router.get('/coach', requireClient, wrap(async (req, res) => {
  const coachId = await myCoachId(req.user.clientId);
  const { rows } = await q(
    `select * from (
       select id, sender, body, created_at as "createdAt" from coach_messages
       where client_id = $1 and coach_id = $2 order by created_at desc limit 200) t
     order by "createdAt"`,
    [req.user.clientId, coachId]
  );
  res.json(rows);
}));

router.post('/coach', requireClient, wrap(async (req, res) => {
  const text = body(req);
  const coachId = await myCoachId(req.user.clientId);
  const { rows } = await q(
    `insert into coach_messages (client_id, coach_id, sender, body) values ($1, $2, 'client', $3)
     returning id, sender, body, created_at as "createdAt"`,
    [req.user.clientId, coachId, text]
  );
  res.status(201).json(rows[0]);
}));

module.exports = router;
