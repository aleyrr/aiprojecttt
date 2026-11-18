const { HttpError } = require('./http');

const bad = (m) => new HttpError(400, m);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const toNumber = (x) => (typeof x === 'string' && x.trim() !== '' ? Number(x) : x);

const text = (x, name, { min = 1, max = 200 } = {}) => {
  if (typeof x !== 'string') throw bad(`${name} is required`);
  const s = x.trim();
  if (s.length < min || s.length > max) throw bad(`${name} must be between ${min} and ${max} characters`);
  return s;
};

const email = (x) => {
  const s = text(x, 'Email', { max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw bad('Email is not a valid email address');
  return s;
};

const password = (x) => {
  if (typeof x !== 'string' || x.length < 8) throw bad('Password must be at least 8 characters');
  if (Buffer.byteLength(x) > 72) throw bad('Password must be at most 72 bytes long');
  return x;
};

const int = (x, name, min, max) => {
  const n = toNumber(x);
  if (!Number.isInteger(n) || n < min || n > max) throw bad(`${name} must be a whole number between ${min} and ${max}`);
  return n;
};

const num = (x, name, min, max) => {
  const n = toNumber(x);
  if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) throw bad(`${name} must be a number between ${min} and ${max}`);
  return n;
};

const oneOf = (x, name, list) => {
  if (!list.includes(x)) throw bad(`${name} must be one of: ${list.join(', ')}`);
  return x;
};

const bool = (x, name) => {
  if (typeof x !== 'boolean') throw bad(`${name} must be true or false`);
  return x;
};

const uuid = (x, name) => {
  if (typeof x !== 'string' || !UUID.test(x)) throw bad(`${name} is not a valid id`);
  return x;
};

const date = (x, name) => {
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x)) throw bad(`${name} must look like 2026-12-31`);
  const d = new Date(`${x}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== x) throw bad(`${name} is not a real date`);
  return x;
};

const time = (x, name) => {
  if (typeof x !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(x)) throw bad(`${name} must look like 14:30`);
  return x;
};

// Empty value -> null, otherwise run the rule.
const optional = (fn) => (x) => (x === undefined || x === null || x === '' ? null : fn(x));

// Validates only the fields that were sent. rules = { field: (value) => cleanValue }
const pick = (body, rules) => {
  const out = {};
  for (const [key, rule] of Object.entries(rules)) if (body[key] !== undefined) out[key] = rule(body[key]);
  return out;
};

module.exports = { text, email, password, int, num, oneOf, bool, uuid, date, time, optional, pick };
