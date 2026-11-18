class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Lets async route functions send their errors to errorHandler.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const notFound = (req, res) => res.status(404).json({ error: 'Route not found' });

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
}

module.exports = { HttpError, wrap, notFound, errorHandler };
