const orderService = require('./orderService');
const productRepository = require('../repositories/productRepository');
const paymentRepository = require('../repositories/paymentRepository');
const { reverseLoyaltyPoints } = require('./loyaltyService');
const helpers = require('../utils/helpers');
const { CANCELLATION } = require('../constants/businessRules');
const { ORDER_STATUS, DELIVERY_TYPE } = require('../constants/domain');
const { badRequest } = require('../errors/AppError');

const NEXT_STATUS = Object.freeze({
  [ORDER_STATUS.PAID]: ORDER_STATUS.PREPARING,
  [ORDER_STATUS.PREPARING]: ORDER_STATUS.READY,
  [ORDER_STATUS.OUT_FOR_DELIVERY]: ORDER_STATUS.DELIVERED,
});

const CANCELLABLE_STATUSES = Object.freeze([
  ORDER_STATUS.CREATED,
  ORDER_STATUS.PAID,
  ORDER_STATUS.PREPARING,
]);

function getNextStatus(order) {
  if (order.status !== ORDER_STATUS.READY) {
    return NEXT_STATUS[order.status];
  }
  return order.deliveryType === DELIVERY_TYPE.DELIVERY
    ? ORDER_STATUS.OUT_FOR_DELIVERY
    : ORDER_STATUS.DELIVERED;
}

function updateStatus(orderId, newStatus) {
  const order = orderService.getOrder(orderId);
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
  return order;
}

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

function cancelOrder(orderId, reason) {
  const order = orderService.getOrder(orderId);
  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    throw badRequest('Pedido não pode mais ser cancelado');
  }

  const wasPaid = order.status !== ORDER_STATUS.CREATED;
  if (wasPaid && !reason) {
    throw badRequest('Informe o motivo do cancelamento');
  }

  const refund = helpers.roundToCents(calculateRefund(order));
  restoreStock(order);
  if (wasPaid) {
    reverseLoyaltyPoints(order.customerId, order.payment.points);
    paymentRepository.findByOrderId(order.id).refunded = refund;
  }

  order.status = ORDER_STATUS.CANCELLED;
  order.refund = refund;
  order.cancelReason = reason || null;
  order.history.push({ status: ORDER_STATUS.CANCELLED, at: new Date().toISOString() });
  return order;
}

module.exports = { updateStatus, cancelOrder };
