const { db } = require('../data/db');

function save(payment) {
  const savedPayment = { id: db.counters.payment++, ...payment };
  db.payments.push(savedPayment);
  return savedPayment;
}

function findByOrderId(orderId) {
  return db.payments.find((p) => p.orderId === orderId);
}

module.exports = { save, findByOrderId };
