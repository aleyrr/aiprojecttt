const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { HttpError } = require('./http');

const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to a random string of at least 32 characters');
}

const ROUNDS = 10;
const COOKIE = 'token';
// Compared against when the email is unknown, so login takes the same time either way.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', ROUNDS);

const hashPassword = (plain) => bcrypt.hash(plain, ROUNDS);

async function verifyPassword(plain, hashOrNull) {
  const ok = await bcrypt.compare(plain, hashOrNull || DUMMY_HASH);
  return Boolean(hashOrNull) && ok;
}

// Signs a 7-day token and puts it in an httpOnly cookie. The token is never sent in JSON.
function issueToken(res, user) {
  const token = jwt.sign({ role: user.role, clientId: user.client_id }, SECRET, {
    subject: user.id,
    expiresIn: '7d',
  });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

const clearToken = (res) => res.clearCookie(COOKIE, { path: '/' });

function requireLogin(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return next(new HttpError(401, 'Please log in first'));
  try {
    const p = jwt.verify(token, SECRET, { algorithms: ['HS256'] });
    req.user = { id: p.sub, role: p.role, clientId: p.clientId };
    next();
  } catch {
    next(new HttpError(401, 'Your session has expired. Please log in again'));
  }
}

const requireRole = (role, message) => (req, res, next) =>
  req.user.role === role ? next() : next(new HttpError(403, message));

const requireClient = [requireLogin, requireRole('client', 'This page is for client accounts')];
const requireAdmin = [requireLogin, requireRole('admin', 'Only administrators can do this')];

module.exports = { hashPassword, verifyPassword, issueToken, clearToken, requireLogin, requireClient, requireAdmin };
