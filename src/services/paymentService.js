const { db } = require('../data/db');
const helpers = require('../utils/helpers');
const orderRepository = require('../repositories/orderRepository');
const { PAYMENT, LOYALTY } = require('../constants/businessRules');
const {
  ORDER_STATUS,
  CUSTOMER_TYPE,
  DELIVERY_TYPE,
  PAYMENT_METHOD,
} = require('../constants/domain');

function payOrder(orderId, paymentData) {
  const order = orderRepository.findById(orderId);
  if (!order) return { ok: false, status: 404, message: 'Pedido não encontrado' };

  if (order.status === ORDER_STATUS.CREATED) {
    if (order.items.length > 0) {
      const customer = db.customers.find((c) => c.id === order.customerId);
      let total = order.total;
      const methodDetails = {};

      if (paymentData.method === PAYMENT_METHOD.PIX) {
        total = total - total * PAYMENT.PIX_DISCOUNT_RATE;
        methodDetails.pixKey = PAYMENT.PIX_KEY;
      } else if (paymentData.method === PAYMENT_METHOD.CREDIT_CARD) {
        if (!helpers.isValidCard(paymentData.cardNumber)) {
          return { ok: false, status: 400, message: 'Cartão inválido' };
        }
        const installments = paymentData.installments || PAYMENT.MIN_INSTALLMENTS;
        if (installments < PAYMENT.MIN_INSTALLMENTS || installments > PAYMENT.MAX_INSTALLMENTS) {
          return { ok: false, status: 400, message: 'Número de parcelas inválido' };
        } else {
          if (
            installments > PAYMENT.MIN_INSTALLMENTS &&
            total / installments < PAYMENT.MIN_INSTALLMENT_VALUE
          ) {
            const minInstallmentValue = helpers.formatCurrency(PAYMENT.MIN_INSTALLMENT_VALUE);
            return {
              ok: false,
              status: 400,
              message: `O valor mínimo da parcela é ${minInstallmentValue}`,
            };
          }
          if (installments > PAYMENT.INTEREST_FREE_INSTALLMENTS) {
            total =
              total +
              total *
                PAYMENT.INTEREST_RATE_PER_EXTRA_INSTALLMENT *
                (installments - PAYMENT.INTEREST_FREE_INSTALLMENTS);
          }
        }
        methodDetails.installments = installments;
        methodDetails.installmentValue = helpers.roundToCents(total / installments);
        methodDetails.card = helpers.maskCard(paymentData.cardNumber);
      } else if (paymentData.method === PAYMENT_METHOD.DEBIT_CARD) {
        if (!helpers.isValidCard(paymentData.cardNumber)) {
          return { ok: false, status: 400, message: 'Cartão inválido' };
        }
        methodDetails.card = helpers.maskCard(paymentData.cardNumber);
      } else if (paymentData.method === PAYMENT_METHOD.CASH) {
        if (paymentData.cashGiven === undefined || paymentData.cashGiven < total) {
          return { ok: false, status: 400, message: 'Valor em dinheiro insuficiente' };
        }
        const change = paymentData.cashGiven - total;
        if (
          order.deliveryType === DELIVERY_TYPE.DELIVERY &&
          change > PAYMENT.MAX_CHANGE_FOR_DELIVERY
        ) {
          const maxChange = helpers.formatCurrency(PAYMENT.MAX_CHANGE_FOR_DELIVERY);
          return {
            ok: false,
            status: 400,
            message: `Troco máximo para entrega é de ${maxChange}`,
          };
        }
        methodDetails.cashGiven = paymentData.cashGiven;
        methodDetails.change = helpers.roundToCents(change);
      } else {
        return { ok: false, status: 400, message: 'Forma de pagamento inválida' };
      }

      total = helpers.roundToCents(total);

      // pontos de fidelidade
      let points = Math.floor(total * LOYALTY.POINTS_PER_REAL);
      if (customer.type === CUSTOMER_TYPE.PREMIUM) {
        points = points * LOYALTY.PREMIUM_POINTS_MULTIPLIER;
      }
      customer.points = customer.points + points;
      if (
        customer.type === CUSTOMER_TYPE.REGULAR &&
        customer.points >= LOYALTY.PREMIUM_UPGRADE_POINTS
      ) {
        customer.type = CUSTOMER_TYPE.PREMIUM;
      }

      const payment = {
        id: db.counters.payment++,
        orderId: order.id,
        method: paymentData.method,
        total,
        points: points,
        ...methodDetails,
        paidAt: helpers.now(),
      };
      db.payments.push(payment);

      order.status = ORDER_STATUS.PAID;
      order.payment = payment;
      order.history.push({ status: ORDER_STATUS.PAID, at: payment.paidAt });

      return { ok: true, order };
    } else {
      return { ok: false, status: 400, message: 'Pedido sem itens' };
    }
  } else if (order.status === ORDER_STATUS.CANCELLED) {
    return { ok: false, status: 400, message: 'Pedido cancelado' };
  } else {
    return { ok: false, status: 409, message: 'Pedido já foi pago' };
  }
}

module.exports = { payOrder };
