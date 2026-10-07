const helpers = require('../utils/helpers');
const orderRepository = require('../repositories/orderRepository');
const customerRepository = require('../repositories/customerRepository');
const paymentRepository = require('../repositories/paymentRepository');
const { PAYMENT, LOYALTY } = require('../constants/businessRules');
const { badRequest, conflict, notFound } = require('../errors/AppError');
const {
  ORDER_STATUS,
  CUSTOMER_TYPE,
  DELIVERY_TYPE,
  PAYMENT_METHOD,
} = require('../constants/domain');

function payWithPix({ total }) {
  return {
    total: total - total * PAYMENT.PIX_DISCOUNT_RATE,
    details: { pixKey: PAYMENT.PIX_KEY },
  };
}

function calculateInstallmentInterest(total, installments) {
  if (installments <= PAYMENT.INTEREST_FREE_INSTALLMENTS) {
    return 0;
  }
  return (
    total *
    PAYMENT.INTEREST_RATE_PER_EXTRA_INSTALLMENT *
    (installments - PAYMENT.INTEREST_FREE_INSTALLMENTS)
  );
}

function payWithCreditCard({ total, paymentData }) {
  if (!helpers.isValidCard(paymentData.cardNumber)) {
    throw badRequest('Cartão inválido');
  }

  const installments = paymentData.installments || PAYMENT.MIN_INSTALLMENTS;
  if (installments < PAYMENT.MIN_INSTALLMENTS || installments > PAYMENT.MAX_INSTALLMENTS) {
    throw badRequest('Número de parcelas inválido');
  }

  const isInstallmentTooSmall =
    installments > PAYMENT.MIN_INSTALLMENTS && total / installments < PAYMENT.MIN_INSTALLMENT_VALUE;
  if (isInstallmentTooSmall) {
    const minInstallmentValue = helpers.formatCurrency(PAYMENT.MIN_INSTALLMENT_VALUE);
    throw badRequest(`O valor mínimo da parcela é ${minInstallmentValue}`);
  }

  const totalWithInterest = total + calculateInstallmentInterest(total, installments);
  return {
    total: totalWithInterest,
    details: {
      installments,
      installmentValue: helpers.roundToCents(totalWithInterest / installments),
      card: helpers.maskCard(paymentData.cardNumber),
    },
  };
}

function payWithDebitCard({ total, paymentData }) {
  if (!helpers.isValidCard(paymentData.cardNumber)) {
    throw badRequest('Cartão inválido');
  }
  return { total, details: { card: helpers.maskCard(paymentData.cardNumber) } };
}

function payWithCash({ total, paymentData, order }) {
  if (paymentData.cashGiven === undefined || paymentData.cashGiven < total) {
    throw badRequest('Valor em dinheiro insuficiente');
  }

  const change = paymentData.cashGiven - total;
  const isChangeAboveDeliveryLimit =
    order.deliveryType === DELIVERY_TYPE.DELIVERY && change > PAYMENT.MAX_CHANGE_FOR_DELIVERY;
  if (isChangeAboveDeliveryLimit) {
    const maxChange = helpers.formatCurrency(PAYMENT.MAX_CHANGE_FOR_DELIVERY);
    throw badRequest(`Troco máximo para entrega é de ${maxChange}`);
  }

  return {
    total,
    details: { cashGiven: paymentData.cashGiven, change: helpers.roundToCents(change) },
  };
}

const PAYMENT_HANDLERS = new Map([
  [PAYMENT_METHOD.PIX, payWithPix],
  [PAYMENT_METHOD.CREDIT_CARD, payWithCreditCard],
  [PAYMENT_METHOD.DEBIT_CARD, payWithDebitCard],
  [PAYMENT_METHOD.CASH, payWithCash],
]);

function awardLoyaltyPoints(customer, total) {
  let points = Math.floor(total * LOYALTY.POINTS_PER_REAL);
  if (customer.type === CUSTOMER_TYPE.PREMIUM) {
    points = points * LOYALTY.PREMIUM_POINTS_MULTIPLIER;
  }

  customer.points = customer.points + points;
  const reachedPremium =
    customer.type === CUSTOMER_TYPE.REGULAR && customer.points >= LOYALTY.PREMIUM_UPGRADE_POINTS;
  if (reachedPremium) {
    customer.type = CUSTOMER_TYPE.PREMIUM;
  }
  return points;
}

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

  const payWithMethod = PAYMENT_HANDLERS.get(paymentData.method);
  if (!payWithMethod) {
    throw badRequest('Forma de pagamento inválida');
  }

  const methodResult = payWithMethod({ total: order.total, paymentData, order });

  const total = helpers.roundToCents(methodResult.total);
  const customer = customerRepository.findById(order.customerId);
  const points = awardLoyaltyPoints(customer, total);

  const payment = paymentRepository.save({
    orderId: order.id,
    method: paymentData.method,
    total,
    points,
    ...methodResult.details,
    paidAt: helpers.now(),
  });

  order.status = ORDER_STATUS.PAID;
  order.payment = payment;
  order.history.push({ status: ORDER_STATUS.PAID, at: payment.paidAt });

  return order;
}

module.exports = { payOrder };
