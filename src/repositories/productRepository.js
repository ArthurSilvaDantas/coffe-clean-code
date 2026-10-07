const { db } = require('../data/db');

function findAll() {
  return db.products;
}

function findById(id) {
  return db.products.find((p) => p.id === Number(id));
}

function save(product) {
  product.id = db.counters.product++;
  db.products.push(product);
  return product;
}

function decreaseStock(id, quantity) {
  const product = findById(id);
  product.stock = product.stock - quantity;
  return product;
}

module.exports = { findAll, findById, save, decreaseStock };
