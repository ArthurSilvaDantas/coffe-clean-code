const { isValidCard, maskCard } = require('../utils/card');
const { formatCurrency, roundToCents } = require('../utils/money');
const { PAYMENT } = require('../constants/businessRules');
const { DELIVERY_TYPE, PAYMENT_METHOD } = require('../constants/domain');
const { badRequest } = require('../errors/AppError');

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
  if (!isValidCard(paymentData.cardNumber)) {
    throw badRequest('Cartão inválido');
  }

  const installments = paymentData.installments || PAYMENT.MIN_INSTALLMENTS;
  if (installments < PAYMENT.MIN_INSTALLMENTS || installments > PAYMENT.MAX_INSTALLMENTS) {
    throw badRequest('Número de parcelas inválido');
  }

  const isInstallmentTooSmall =
    installments > PAYMENT.MIN_INSTALLMENTS && total / installments < PAYMENT.MIN_INSTALLMENT_VALUE;
  if (isInstallmentTooSmall) {
    const minInstallmentValue = formatCurrency(PAYMENT.MIN_INSTALLMENT_VALUE);
    throw badRequest(`O valor mínimo da parcela é ${minInstallmentValue}`);
  }

  const totalWithInterest = total + calculateInstallmentInterest(total, installments);
  return {
    total: totalWithInterest,
    details: {
      installments,
      installmentValue: roundToCents(totalWithInterest / installments),
      card: maskCard(paymentData.cardNumber),
    },
  };
}

function payWithDebitCard({ total, paymentData }) {
  if (!isValidCard(paymentData.cardNumber)) {
    throw badRequest('Cartão inválido');
  }
  return { total, details: { card: maskCard(paymentData.cardNumber) } };
}

function payWithCash({ total, paymentData, order }) {
  if (paymentData.cashGiven === undefined || paymentData.cashGiven < total) {
    throw badRequest('Valor em dinheiro insuficiente');
  }

  const change = paymentData.cashGiven - total;
  const isChangeAboveDeliveryLimit =
    order.deliveryType === DELIVERY_TYPE.DELIVERY && change > PAYMENT.MAX_CHANGE_FOR_DELIVERY;
  if (isChangeAboveDeliveryLimit) {
    const maxChange = formatCurrency(PAYMENT.MAX_CHANGE_FOR_DELIVERY);
    throw badRequest(`Troco máximo para entrega é de ${maxChange}`);
  }

  return {
    total,
    details: { cashGiven: paymentData.cashGiven, change: roundToCents(change) },
  };
}

const PAYMENT_HANDLERS = new Map([
  [PAYMENT_METHOD.PIX, payWithPix],
  [PAYMENT_METHOD.CREDIT_CARD, payWithCreditCard],
  [PAYMENT_METHOD.DEBIT_CARD, payWithDebitCard],
  [PAYMENT_METHOD.CASH, payWithCash],
]);

function getPaymentHandler(method) {
  return PAYMENT_HANDLERS.get(method);
}

module.exports = { getPaymentHandler };
