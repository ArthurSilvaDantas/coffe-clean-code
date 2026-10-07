const { db } = require('../data/db');

function save(customer) {
  customer.id = db.counters.customer++;
  db.customers.push(customer);
  return customer;
}

function findById(id) {
  return db.customers.find((c) => c.id === Number(id));
}

function findByEmail(email) {
  return db.customers.find((c) => c.email.toLowerCase() === email.toLowerCase());
}

function all() {
  return db.customers;
}

module.exports = { save, findById, findByEmail, all };
