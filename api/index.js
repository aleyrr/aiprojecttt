const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { notFound, errorHandler } = require('../src/http');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // behind Vercel's proxy, so req.ip is the visitor's IP
app.use(express.json({
  limit: '10kb',
  verify: (req, res, buf) => { req.rawBody = buf; }, // the webhook signature needs the exact bytes
}));
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/health/db', async (req, res) => {
  try { await require('../src/db').q('select 1'); res.json({ ok: true, db: true }); }
  catch (e) { res.status(500).json({ ok: false, db: false }); }
});
app.use('/api/auth', require('../src/routes/auth'));
app.use('/api', require('../src/routes/clients'));
app.use('/api', require('../src/routes/plans'));
app.use('/api', require('../src/routes/coaches'));
app.use('/api', require('../src/routes/appointments'));
app.use('/api', require('../src/routes/community'));
app.use('/api/messages', require('../src/routes/messages'));
app.use('/api/admin', require('../src/routes/admin'));
app.use('/api/webhooks', require('../src/routes/webhooks'));

app.use('/api', notFound);
app.use(express.static(path.join(__dirname, '..', 'public'))); // local only; Vercel serves public/ itself
app.use(errorHandler);

module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`NutriCare running on http://localhost:${port}`));
}
