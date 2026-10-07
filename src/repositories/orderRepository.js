const { db } = require('../data/db');

function savePurchase(purchase) {
  purchase.id = db.counters.order++;
  db.orders.push(purchase);
  return purchase;
}

function getPurchase(id) {
  return db.orders.find((o) => o.id === Number(id));
}

function countOpenByCustomer(customerId) {
  return db.orders.filter((o) => o.customerId === customerId && o.status === 'CREATED').length;
}

function hasPaidPurchases(customerId) {
  return db.orders.some(
    (o) => o.customerId === customerId && o.status !== 'CREATED' && o.status !== 'CANCELLED',
  );
}

module.exports = { savePurchase, getPurchase, countOpenByCustomer, hasPaidPurchases };
