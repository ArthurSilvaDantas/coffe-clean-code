const { roundToCents } = require('../utils/money');
const { now } = require('../utils/date');
const orderRepository = require('../repositories/orderRepository');
const paymentRepository = require('../repositories/paymentRepository');
const { getPaymentHandler } = require('./paymentMethods');
const { awardLoyaltyPoints } = require('./loyaltyService');
const { ORDER_STATUS } = require('../constants/domain');
const { badRequest, conflict, notFound } = require('../errors/AppError');

function payOrder(orderId, paymentData) {
  const order = orderRepository.findById(orderId);
  if (!order) {
    throw notFound('Pedido não encontrado');
  }
  if (order.status === ORDER_STATUS.CANCELLED) {
    throw badRequest('Pedido cancelado');
  }
  if (order.status !== ORDER_STATUS.CREATED) {
    throw conflict('Pedido já foi pago');
  }
  if (order.items.length === 0) {
    throw badRequest('Pedido sem itens');
  }

  const payWithMethod = getPaymentHandler(paymentData.method);
  if (!payWithMethod) {
    throw badRequest('Forma de pagamento inválida');
  }

  const methodResult = payWithMethod({ total: order.total, paymentData, order });

  const total = roundToCents(methodResult.total);
  const points = awardLoyaltyPoints(order.customerId, total);

  const payment = paymentRepository.save({
    orderId: order.id,
    method: paymentData.method,
    total,
    points,
    ...methodResult.details,
    paidAt: now(),
  });

  order.status = ORDER_STATUS.PAID;
  order.payment = payment;
  order.history.push({ status: ORDER_STATUS.PAID, at: payment.paidAt });

  return order;
}

module.exports = { payOrder };
