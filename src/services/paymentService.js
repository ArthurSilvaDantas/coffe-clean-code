const { db } = require('../data/db');
const helpers = require('../utils/helpers');
const orderRepository = require('../repositories/orderRepository');

function doIt(id, data) {
  const order = orderRepository.getOrder(id);
  if (!order) return { ok: false, code: 404, msg: 'Pedido não encontrado' };

  if (order.status === 'CREATED') {
    if (order.items.length > 0) {
      const customer = db.customers.find((c) => c.id === order.customerId);
      let total = order.total;
      const extra = {};

      if (data.method === 'pix') {
        total = total - total * 0.05;
        extra.pixKey = 'pagamentos@cafeteria.com';
      } else if (data.method === 'credit_card') {
        if (!helpers.isValidCard(data.cardNumber)) {
          return { ok: false, code: 400, msg: 'Cartão inválido' };
        }
        const n = data.installments || 1;
        if (n < 1 || n > 12) {
          return { ok: false, code: 400, msg: 'Número de parcelas inválido' };
        } else {
          if (n > 1 && total / n < 10) {
            return { ok: false, code: 400, msg: 'O valor mínimo da parcela é R$ 10,00' };
          }
          if (n > 3) {
            total = total + total * 0.02 * (n - 3);
          }
        }
        extra.installments = n;
        extra.installmentValue = helpers.round(total / n);
        extra.card = helpers.maskCard(data.cardNumber);
      } else if (data.method === 'debit_card') {
        if (!helpers.isValidCard(data.cardNumber)) {
          return { ok: false, code: 400, msg: 'Cartão inválido' };
        }
        extra.card = helpers.maskCard(data.cardNumber);
      } else if (data.method === 'cash') {
        if (data.cashGiven === undefined || data.cashGiven < total) {
          return { ok: false, code: 400, msg: 'Valor em dinheiro insuficiente' };
        }
        const change = data.cashGiven - total;
        if (order.deliveryType === 'delivery' && change > 50) {
          return { ok: false, code: 400, msg: 'Troco máximo para entrega é de R$ 50,00' };
        }
        extra.cashGiven = data.cashGiven;
        extra.change = helpers.round(change);
      } else {
        return { ok: false, code: 400, msg: 'Forma de pagamento inválida' };
      }

      total = helpers.round(total);

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
        method: data.method,
        total,
        points: points,
        ...extra,
        paidAt: helpers.now(),
      };
      db.payments.push(payment);

      order.status = 'PAID';
      order.payment = payment;
      order.history.push({ status: 'PAID', at: payment.paidAt });

      return { ok: true, data: order };
    } else {
      return { ok: false, code: 400, msg: 'Pedido sem itens' };
    }
  } else if (order.status === 'CANCELLED') {
    return { ok: false, code: 400, msg: 'Pedido cancelado' };
  } else {
    return { ok: false, code: 409, msg: 'Pedido já foi pago' };
  }
}

module.exports = { doIt };
