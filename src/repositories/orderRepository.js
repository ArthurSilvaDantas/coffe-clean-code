const { db } = require('../data/db');
const { ORDER_STATUS } = require('../constants/domain');

function save(order) {
  order.id = db.counters.order++;
  db.orders.push(order);
  return order;
}

function findById(id) {
  return db.orders.find((o) => o.id === Number(id));
}

function countOpenByCustomer(customerId) {
  return db.orders.filter((o) => o.customerId === customerId && o.status === ORDER_STATUS.CREATED)
    .length;
}

function hasPaidOrders(customerId) {
  return db.orders.some(
    (o) =>
      o.customerId === customerId &&
      o.status !== ORDER_STATUS.CREATED &&
      o.status !== ORDER_STATUS.CANCELLED,
  );
}

module.exports = { save, findById, countOpenByCustomer, hasPaidOrders };
