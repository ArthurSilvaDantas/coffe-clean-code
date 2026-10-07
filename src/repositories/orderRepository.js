const { db } = require('../data/db');

function savePurchase(purchase) {
  purchase.id = db.counters.order++;
  db.orders.push(purchase);
  return purchase;
}

function getPurchase(id) {
  return db.orders.find((o) => o.id === Number(id));
}

function countOpenByClient(clientId) {
  return db.orders.filter((o) => o.clientId === clientId && o.status === 'CREATED').length;
}

function hasPaidPurchases(clientId) {
  return db.orders.some(
    (o) => o.clientId === clientId && o.status !== 'CREATED' && o.status !== 'CANCELLED',
  );
}

module.exports = { savePurchase, getPurchase, countOpenByClient, hasPaidPurchases };
