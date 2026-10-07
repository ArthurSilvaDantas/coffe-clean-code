const { db } = require('../data/db');
const helpers = require('../utils/helpers');
const orderRepository = require('../repositories/orderRepository');

function doIt(id, data) {
  const purchase = orderRepository.getPurchase(id);
  if (!purchase) return { ok: false, code: 404, msg: 'Pedido não encontrado' };

  if (purchase.status == 'CREATED') {
    if (purchase.items.length > 0) {
      const user = db.customers.find((c) => c.id == purchase.clientId);
      let value = purchase.amount;
      let extra = {};

      if (data.method == 'pix') {
        value = value - value * 0.05;
        extra.pixKey = 'pagamentos@cafeteria.com';
      } else if (data.method == 'credit_card') {
        if (!helpers.isValidCard(data.cardNumber)) {
          return { ok: false, code: 400, msg: 'Cartão inválido' };
        }
        let n = data.installments || 1;
        if (n < 1 || n > 12) {
          return { ok: false, code: 400, msg: 'Número de parcelas inválido' };
        } else {
          if (n > 1 && value / n < 10) {
            return { ok: false, code: 400, msg: 'O valor mínimo da parcela é R$ 10,00' };
          }
          if (n > 3) {
            value = value + value * 0.02 * (n - 3);
          }
        }
        extra.installments = n;
        extra.installmentValue = helpers.round(value / n);
        extra.card = helpers.maskCard(data.cardNumber);
      } else if (data.method == 'debit_card') {
        if (!helpers.isValidCard(data.cardNumber)) {
          return { ok: false, code: 400, msg: 'Cartão inválido' };
        }
        extra.card = helpers.maskCard(data.cardNumber);
      } else if (data.method == 'cash') {
        if (data.cashGiven == undefined || data.cashGiven < value) {
          return { ok: false, code: 400, msg: 'Valor em dinheiro insuficiente' };
        }
        let change = data.cashGiven - value;
        if (purchase.deliveryType == 'delivery' && change > 50) {
          return { ok: false, code: 400, msg: 'Troco máximo para entrega é de R$ 50,00' };
        }
        extra.cashGiven = data.cashGiven;
        extra.change = helpers.round(change);
      } else {
        return { ok: false, code: 400, msg: 'Forma de pagamento inválida' };
      }

      value = helpers.round(value);

      // pontos de fidelidade
      let points = Math.floor(value);
      if (user.type == 'premium') points = points * 2;
      user.points = user.points + points;
      if (user.type == 'regular' && user.points >= 200) {
        user.type = 'premium';
      }

      const payment = {
        id: db.counters.payment++,
        purchaseId: purchase.id,
        method: data.method,
        total: value,
        points: points,
        ...extra,
        paidAt: helpers.now(),
      };
      db.payments.push(payment);

      purchase.status = 'PAID';
      purchase.payment = payment;
      purchase.history.push({ status: 'PAID', at: payment.paidAt });

      return { ok: true, data: purchase };
    } else {
      return { ok: false, code: 400, msg: 'Pedido sem itens' };
    }
  } else if (purchase.status == 'CANCELLED') {
    return { ok: false, code: 400, msg: 'Pedido cancelado' };
  } else {
    return { ok: false, code: 409, msg: 'Pedido já foi pago' };
  }
}

module.exports = { doIt };
