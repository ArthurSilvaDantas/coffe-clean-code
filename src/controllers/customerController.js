const customerService = require('../services/customerService');

function create(req, res) {
  const customer = customerService.createCustomer(req.body || {});
  res.status(201).json(customer);
}

function list(req, res) {
  res.json(customerService.listCustomers({ type: req.query.type }));
}

function get(req, res) {
  res.json(customerService.getCustomer(req.params.id));
}

module.exports = { create, list, get };
