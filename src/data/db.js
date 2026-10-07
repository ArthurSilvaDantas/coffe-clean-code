const initialProducts = require('./products.json')

const db = {
  customers: [],
  products: [],
  orders: [],
  payments: [],
  counters: {}
}

// reinicia o banco
function reset() {
  db.customers = []
  db.products = JSON.parse(JSON.stringify(initialProducts))
  db.orders = []
  db.payments = []
  db.counters = {
    customer: 1,
    product: initialProducts.length + 1,
    order: 1,
    payment: 1
  }
}

reset()

module.exports = { db, reset }
