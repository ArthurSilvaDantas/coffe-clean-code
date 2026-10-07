const express = require('express');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.use(express.json());

app.use(function (req, res, next) {
  if (process.env.NODE_ENV !== 'test') {
    console.log(new Date().toISOString() + ' ' + req.method + ' ' + req.url);
  }
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
