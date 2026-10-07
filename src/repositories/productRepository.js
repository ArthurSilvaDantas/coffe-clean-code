const { db } = require('../data/db');

function getProducts() {
  return db.products;
}

function getProduct(id) {
  return db.products.find((p) => p.id == id);
}

function addProduct(product) {
  product.id = db.counters.product++;
  db.products.push(product);
  return product;
}

function decreaseStock(id, qty) {
  const product = getProduct(id);
  product.stock = product.stock - qty;
  return product;
}

module.exports = { getProducts, getProduct, addProduct, decreaseStock };
