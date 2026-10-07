const orderService = require('../services/orderService');
const orderRepository = require('../repositories/orderRepository');
const customerRepository = require('../repositories/customerRepository');
const productRepository = require('../repositories/productRepository');
const paymentRepository = require('../repositories/paymentRepository');
const helpers = require('../utils/helpers');
const { CANCELLATION } = require('../constants/businessRules');
const { ORDER_STATUS, DELIVERY_TYPE } = require('../constants/domain');
const { badRequest, notFound } = require('../errors/AppError');

exports.create = (req, res) => {
  const body = req.body || {};
  if (!body.customerId) {
    throw badRequest('customerId é obrigatório');
  }
  const order = orderService.createOrder(
    body.customerId,
    body.deliveryType,
    body.distance,
    body.address,
    body.notes,
    body.items,
  );
  res.status(201).json(order);
};

exports.list = (req, res) => {
  let orders = orderRepository.findAll();
  if (req.query.status) {
    orders = orders.filter((o) => o.status === req.query.status.toUpperCase());
  }
  if (req.query.customerId) {
    orders = orders.filter((o) => o.customerId === Number(req.query.customerId));
  }
  res.json(orders);
};

exports.listByCustomer = (req, res) => {
  const customer = customerRepository.findById(req.params.id);
  if (!customer) {
    throw notFound('Cliente não encontrado');
  }
  let orders = orderRepository.findByCustomerId(customer.id);
  if (req.query.status) {
    orders = orders.filter((o) => o.status === req.query.status.toUpperCase());
  }
  res.json(orders);
};

exports.get = (req, res) => {
  const order = orderRepository.findById(req.params.id);
  if (!order) throw notFound('Pedido não encontrado');
  res.json(order);
};

exports.addItem = (req, res) => {
  orderService.addItem(req, res);
};

exports.applyCoupon = (req, res) => {
  const order = orderService.applyCoupon(req.params.id, (req.body || {}).code);
  res.json(order);
};

const NEXT_STATUS = Object.freeze({
  [ORDER_STATUS.PAID]: ORDER_STATUS.PREPARING,
  [ORDER_STATUS.PREPARING]: ORDER_STATUS.READY,
  [ORDER_STATUS.OUT_FOR_DELIVERY]: ORDER_STATUS.DELIVERED,
});

function getNextStatus(order) {
  if (order.status !== ORDER_STATUS.READY) {
    return NEXT_STATUS[order.status];
  }
  return order.deliveryType === DELIVERY_TYPE.DELIVERY
    ? ORDER_STATUS.OUT_FOR_DELIVERY
    : ORDER_STATUS.DELIVERED;
}

exports.updateStatus = (req, res) => {
  const order = orderRepository.findById(req.params.id);
  if (!order) {
    throw notFound('Pedido não encontrado');
  }

  const newStatus = (req.body || {}).status;
  if (!newStatus) {
    throw badRequest('Status é obrigatório');
  }
  if (newStatus !== getNextStatus(order)) {
    throw badRequest('Transição de status inválida: ' + order.status + ' -> ' + newStatus);
  }

  order.status = newStatus;
  order.history.push({ status: newStatus, at: new Date().toISOString() });
  if (newStatus === ORDER_STATUS.DELIVERED) {
    order.deliveredAt = new Date().toISOString();
  }
  res.json(order);
};

const CANCELLABLE_STATUSES = Object.freeze([
  ORDER_STATUS.CREATED,
  ORDER_STATUS.PAID,
  ORDER_STATUS.PREPARING,
]);

function calculateRefund(order) {
  if (order.status === ORDER_STATUS.PAID) {
    return order.payment.total;
  }
  if (order.status === ORDER_STATUS.PREPARING) {
    return order.payment.total * CANCELLATION.PREPARING_REFUND_RATE;
  }
  return 0;
}

function restoreStock(order) {
  for (const item of order.items) {
    productRepository.increaseStock(item.productId, item.quantity);
  }
}

function reverseLoyaltyPoints(order) {
  const customer = customerRepository.findById(order.customerId);
  customer.points = Math.max(customer.points - order.payment.points, 0);
}

exports.cancel = (req, res) => {
  const order = orderRepository.findById(req.params.id);
  if (!order) {
    throw notFound('Pedido não encontrado');
  }
  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    throw badRequest('Pedido não pode mais ser cancelado');
  }

  const reason = (req.body || {}).reason;
  const wasPaid = order.status !== ORDER_STATUS.CREATED;
  if (wasPaid && !reason) {
    throw badRequest('Informe o motivo do cancelamento');
  }

  const refund = helpers.roundToCents(calculateRefund(order));
  restoreStock(order);
  if (wasPaid) {
    reverseLoyaltyPoints(order);
    const payment = paymentRepository.findByOrderId(order.id);
    payment.refunded = refund;
  }

  order.status = ORDER_STATUS.CANCELLED;
  order.refund = refund;
  order.cancelReason = reason || null;
  order.history.push({ status: ORDER_STATUS.CANCELLED, at: new Date().toISOString() });

  res.json(order);
};
