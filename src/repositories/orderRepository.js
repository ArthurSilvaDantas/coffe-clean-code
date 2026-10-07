const { db } = require('../data/db');

function saveOrder(order) {
  order.id = db.counters.order++;
  db.orders.push(order);
  return order;
}

function getOrder(id) {
  return db.orders.find((o) => o.id === Number(id));
}

function countOpenByCustomer(customerId) {
  return db.orders.filter((o) => o.customerId === customerId && o.status === 'CREATED').length;
}

function hasPaidOrders(customerId) {
  return db.orders.some(
    (o) => o.customerId === customerId && o.status !== 'CREATED' && o.status !== 'CANCELLED',
  );
}

module.exports = { saveOrder, getOrder, countOpenByCustomer, hasPaidOrders };
