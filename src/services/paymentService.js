const { db } = require('../data/db');
const helpers = require('../utils/helpers');
const orderRepository = require('../repositories/orderRepository');

function payOrder(orderId, paymentData) {
  const order = orderRepository.findById(orderId);
  if (!order) return { ok: false, status: 404, message: 'Pedido não encontrado' };

  if (order.status === 'CREATED') {
    if (order.items.length > 0) {
      const customer = db.customers.find((c) => c.id === order.customerId);
      let total = order.total;
      const methodDetails = {};

      if (paymentData.method === 'pix') {
        total = total - total * 0.05;
        methodDetails.pixKey = 'pagamentos@cafeteria.com';
      } else if (paymentData.method === 'credit_card') {
        if (!helpers.isValidCard(paymentData.cardNumber)) {
          return { ok: false, status: 400, message: 'Cartão inválido' };
        }
        const installments = paymentData.installments || 1;
        if (installments < 1 || installments > 12) {
          return { ok: false, status: 400, message: 'Número de parcelas inválido' };
        } else {
          if (installments > 1 && total / installments < 10) {
            return { ok: false, status: 400, message: 'O valor mínimo da parcela é R$ 10,00' };
          }
          if (installments > 3) {
            total = total + total * 0.02 * (installments - 3);
          }
        }
        methodDetails.installments = installments;
        methodDetails.installmentValue = helpers.roundToCents(total / installments);
        methodDetails.card = helpers.maskCard(paymentData.cardNumber);
      } else if (paymentData.method === 'debit_card') {
        if (!helpers.isValidCard(paymentData.cardNumber)) {
          return { ok: false, status: 400, message: 'Cartão inválido' };
        }
        methodDetails.card = helpers.maskCard(paymentData.cardNumber);
      } else if (paymentData.method === 'cash') {
        if (paymentData.cashGiven === undefined || paymentData.cashGiven < total) {
          return { ok: false, status: 400, message: 'Valor em dinheiro insuficiente' };
        }
        const change = paymentData.cashGiven - total;
        if (order.deliveryType === 'delivery' && change > 50) {
          return { ok: false, status: 400, message: 'Troco máximo para entrega é de R$ 50,00' };
        }
        methodDetails.cashGiven = paymentData.cashGiven;
        methodDetails.change = helpers.roundToCents(change);
      } else {
        return { ok: false, status: 400, message: 'Forma de pagamento inválida' };
      }

      total = helpers.roundToCents(total);

      // pontos de fidelidade
      let points = Math.floor(total);
      if (customer.type === 'premium') points = points * 2;
      customer.points = customer.points + points;
      if (customer.type === 'regular' && customer.points >= 200) {
        customer.type = 'premium';
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

      order.status = 'PAID';
      order.payment = payment;
      order.history.push({ status: 'PAID', at: payment.paidAt });

      return { ok: true, order };
    } else {
      return { ok: false, status: 400, message: 'Pedido sem itens' };
    }
  } else if (order.status === 'CANCELLED') {
    return { ok: false, status: 400, message: 'Pedido cancelado' };
  } else {
    return { ok: false, status: 409, message: 'Pedido já foi pago' };
  }
}

module.exports = { payOrder };
