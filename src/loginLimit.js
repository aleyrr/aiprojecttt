const { q } = require('./db');
const { HttpError } = require('./http');

const MAX_PER_EMAIL = 5;
const MAX_PER_IP = 20;

// Call before checking the password. Throws 429 when the email or IP has too many recent failures.
async function assertNotLocked(email, ip) {
  const { rows } = await q(
    `select count(*) filter (where email = $1)::int as by_email,
            count(*) filter (where ip = $2)::int as by_ip,
            greatest(1, ceil(extract(epoch from (min(attempted_at) + interval '15 minutes' - now()))))::int as retry_seconds
     from failed_logins
     where attempted_at > now() - interval '15 minutes' and (email = $1 or ip = $2)`,
    [email, ip]
  );
  const r = rows[0];
  if (r.by_email >= MAX_PER_EMAIL || r.by_ip >= MAX_PER_IP) {
    const err = new HttpError(429, `Too many failed login attempts. Please try again in about ${Math.ceil(r.retry_seconds / 60)} minute(s)`);
    err.retryAfter = r.retry_seconds;
    throw err;
  }
}

async function recordFailure(email, ip) {
  await q('insert into failed_logins (email, ip) values ($1, $2)', [email, ip]);
  if (Math.random() < 0.02) await q(`delete from failed_logins where attempted_at < now() - interval '1 day'`);
}

const clearFailures = (email) => q('delete from failed_logins where email = $1', [email]);

module.exports = { assertNotLocked, recordFailure, clearFailures };
