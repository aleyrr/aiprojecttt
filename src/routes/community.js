const router = require('express').Router();
const { q } = require('../db');
const { wrap, HttpError } = require('../http');
const { requireClient } = require('../auth');
const v = require('../validate');

// People you have no request with yet. Same-city people come first.
router.get('/community/suggestions', requireClient, wrap(async (req, res) => {
  const { rows } = await q(
    `select c.id, c.name, c.city, c.struggling_with as "strugglingWith"
     from clients c
     where c.id <> $1
       and exists (select 1 from users u where u.client_id = c.id)
       and not exists (
         select 1 from friend_requests fr
         where (fr.sender_id = $1 and fr.receiver_id = c.id) or (fr.sender_id = c.id and fr.receiver_id = $1))
     order by coalesce(c.city = (select city from clients where id = $1), false) desc, c.created_at desc
     limit 20`,
    [req.user.clientId]
  );
  res.json(rows);
}));

router.post('/community/requests', requireClient, wrap(async (req, res) => {
  const receiverId = v.uuid((req.body ?? {}).receiverId, 'Person');
  if (receiverId === req.user.clientId) throw new HttpError(400, 'You cannot send a friend request to yourself');
  const exists = await q('select 1 from clients where id = $1', [receiverId]);
  if (!exists.rowCount) throw new HttpError(404, 'That person was not found');
  try {
    const { rows } = await q(
      `insert into friend_requests (sender_id, receiver_id) values ($1, $2)
       returning id, status, created_at as "createdAt"`,
      [req.user.clientId, receiverId]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') throw new HttpError(409, 'A friend request between you two already exists');
    throw e;
  }
}));

router.get('/community/requests', requireClient, wrap(async (req, res) => {
  const { rows } = await q(
    `select fr.id, fr.status, fr.created_at as "createdAt",
            case when fr.sender_id = $1 then 'sent' else 'received' end as direction,
            c.id as "personId", c.name, c.city, c.struggling_with as "strugglingWith"
     from friend_requests fr
     join clients c on c.id = case when fr.sender_id = $1 then fr.receiver_id else fr.sender_id end
     where $1 in (fr.sender_id, fr.receiver_id)
     order by fr.created_at desc`,
    [req.user.clientId]
  );
  res.json({
    sent: rows.filter((r) => r.direction === 'sent'),
    received: rows.filter((r) => r.direction === 'received'),
  });
}));

const respond = (status) => wrap(async (req, res) => {
  const id = v.uuid(req.params.id, 'Request id');
  const { rows } = await q(
    `update friend_requests set status = $3, responded_at = now()
     where id = $1 and receiver_id = $2 and status = 'pending'
     returning id, status`,
    [id, req.user.clientId, status]
  );
  if (!rows.length) throw new HttpError(404, 'No pending request for you was found with that id');
  res.json(rows[0]);
});

router.post('/community/requests/:id/accept', requireClient, respond('accepted'));
router.post('/community/requests/:id/decline', requireClient, respond('declined'));

router.get('/community/friends', requireClient, wrap(async (req, res) => {
  const { rows } = await q(
    `select c.id, c.name, c.city, c.struggling_with as "strugglingWith"
     from friend_requests fr
     join clients c on c.id = case when fr.sender_id = $1 then fr.receiver_id else fr.sender_id end
     where fr.status = 'accepted' and $1 in (fr.sender_id, fr.receiver_id)
     order by c.name`,
    [req.user.clientId]
  );
  res.json(rows);
}));

module.exports = router;
