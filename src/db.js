const { Pool } = require('pg');

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  ssl: { rejectUnauthorized: false }, // Supabase requires SSL
});

const q = (text, params) => pool.query(text, params);

// Runs several queries as one all-or-nothing transaction.
async function tx(work) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    const result = await work(c);
    await c.query('commit');
    return result;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

module.exports = { pool, q, tx };
