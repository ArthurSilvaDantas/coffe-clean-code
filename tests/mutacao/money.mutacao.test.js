// Testes criados a partir dos mutantes que sobreviveram em src/utils/money.js
// na rodada 1 do teste de mutação (StrykerJS).
//
// Mutantes: corpo de formatCurrency removido, 'R$ ' -> "", '.' -> "" e ',' -> "" (linhas 5 e 6).
// Sobreviveram porque formatCurrency só aparece nas mensagens de erro, e os testes originais
// só verificavam o status 400.
const { reset } = require('../../src/data/db');
const { createCustomer, createOrder, payOrder } = require('../helpers');

beforeEach(() => reset());

const CARD = '4111 1111 1111 1111';

describe('utils/money - formatação em reais nas mensagens', () => {
  test('parcela abaixo do mínimo mostra o valor como R$ 10,00', async () => {
    const customer = await createCustomer();
    const order = (
      await createOrder({ customerId: customer.id, items: [{ productId: 3, quantity: 2 }] })
    ).body;

    const res = await payOrder(order.id, {
      method: 'credit_card',
      cardNumber: CARD,
      installments: 3,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('O valor mínimo da parcela é R$ 10,00');
  });

  test('troco acima do limite na entrega mostra o valor como R$ 50,00', async () => {
    const customer = await createCustomer();
    const order = (
      await createOrder({
        customerId: customer.id,
        deliveryType: 'delivery',
        address: 'Rua A, 10',
        distance: 1,
        items: [{ productId: 1, quantity: 1 }],
      })
    ).body;

    const res = await payOrder(order.id, { method: 'cash', cashGiven: 100 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Troco máximo para entrega é de R$ 50,00');
  });
});
