const orderService = require('../services/orderService');
const orderStatusService = require('../services/orderStatusService');

exports.create = (req, res) => {
  const order = orderService.createOrder(req.body || {});
  res.status(201).json(order);
};

exports.list = (req, res) => {
  const { status, customerId } = req.query;
  res.json(orderService.listOrders({ status, customerId }));
};

exports.listByCustomer = (req, res) => {
  res.json(orderService.listCustomerOrders(req.params.id, { status: req.query.status }));
};

exports.get = (req, res) => {
  res.json(orderService.getOrder(req.params.id));
};

exports.addItem = (req, res) => {
  const order = orderService.addItem(req.params.id, req.body || {});
  res.status(201).json(order);
};

exports.applyCoupon = (req, res) => {
  const order = orderService.applyCoupon(req.params.id, (req.body || {}).code);
  res.json(order);
};

exports.updateStatus = (req, res) => {
  const order = orderStatusService.updateStatus(req.params.id, (req.body || {}).status);
  res.json(order);
};

exports.cancel = (req, res) => {
  const order = orderStatusService.cancelOrder(req.params.id, (req.body || {}).reason);
  res.json(order);
};
