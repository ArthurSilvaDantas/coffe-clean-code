const { AppError } = require('../errors/AppError');

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Rota não encontrada' });
}

function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido' });
  }
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

module.exports = { notFoundHandler, errorHandler };
