const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');

(async () => {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Set ADMIN_EMAIL to a valid email');
  if (password.length < 10) throw new Error('Set ADMIN_PASSWORD to at least 10 characters');

  const hash = await bcrypt.hash(password, 10);
  await pool.query(`insert into users (email, password_hash, role) values ($1, $2, 'admin')`, [email, hash]);
  console.log(`Admin created: ${email}`);
})()
  .catch((e) => console.error(e.code === '23505' ? 'That email already has an account' : e.message))
  .finally(() => pool.end());
