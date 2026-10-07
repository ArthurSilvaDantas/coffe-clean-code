const express = require('express');
const path = require('path');
const routes = require('./routes');

const app = express();

app.use(express.json());

app.use(function (req, res, next) {
  if (process.env.NODE_ENV != 'test') {
    console.log(new Date().toISOString() + ' ' + req.method + ' ' + req.url);
  }
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(routes);

app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

app.use((err, req, res, next) => {
  if (err.type == 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido' });
  }
  console.error(err);
  res.status(500).json({ message: 'Erro interno do servidor' });
});

module.exports = app;
