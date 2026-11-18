const { pool } = require('./db');
const { HttpError } = require('./http');

const COLUMNS = `id, name, email, phone, city, age, sex,
  height_cm::float8 as "heightCm",
  activity_factor::float8 as "activityFactor",
  goal,
  goal_weight_kg::float8 as "goalWeightKg",
  notes,
  struggling_with as "strugglingWith",
  coach_id as "coachId"`;

async function getProfile(clientId, db = pool) {
  const { rows } = await db.query(`select ${COLUMNS} from clients where id = $1`, [clientId]);
  return rows[0] || null;
}

// Field names come only from validators, never from the request, so this map is the whitelist.
const FIELD_COLUMNS = {
  name: 'name', email: 'email', phone: 'phone', city: 'city', notes: 'notes',
  strugglingWith: 'struggling_with', age: 'age', sex: 'sex', heightCm: 'height_cm',
  activityFactor: 'activity_factor', goal: 'goal', goalWeightKg: 'goal_weight_kg',
};

async function updateProfile(db, clientId, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) throw new HttpError(400, 'Send at least one field to update');
  const sets = keys.map((k, i) => `${FIELD_COLUMNS[k]} = $${i + 2}`);
  await db.query(`update clients set ${sets.join(', ')} where id = $1`, [clientId, ...keys.map((k) => fields[k])]);
}

module.exports = { getProfile, updateProfile };
