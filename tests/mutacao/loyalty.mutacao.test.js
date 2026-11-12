// Testes criados a partir dos mutantes que sobreviveram em src/services/loyaltyService.js
// na rodada 1 do teste de mutação (StrykerJS).
const { reset } = require('../../src/data/db');
const { app, request, createCustomer, createOrder, payOrder } = require('../helpers');

beforeEach(() => reset());

async function orderOf(customer, items) {
  return (await createOrder({ customerId: customer.id, items })).body;
}

const getCustomer = async (id) => (await request(app).get(`/customers/${id}`)).body;

describe('loyaltyService - upgrade para premium (linhas 14 e 15)', () => {
  // Mutantes: condição inteira -> true, "&&" -> "||", "points >= 200" -> true, "if" -> true.
  // Sobreviveram porque o teste original de pontos não verificava o tipo do cliente
  // depois do pagamento.
  test('cliente regular com poucos pontos continua regular', async () => {
    const customer = await createCustomer();
    const order = await orderOf(customer, [{ productId: 1, quantity: 1 }]);
    await payOrder(order.id, { method: 'pix' });

    expect(await getCustomer(customer.id)).toMatchObject({ points: 6, type: 'regular' });
  });

  // Mutante: "points >= 200" -> "points > 200"
  // Sobreviveu porque o teste original de upgrade chegava a 216 pontos, nunca exatamente 200.
  // Produto de R$ 211 com 5% de desconto de cliente regular: total R$ 200,45 -> 200 pontos.
  test('cliente vira premium com exatamente 200 pontos', async () => {
    await request(app).post('/products').send({ name: 'Kit presente', price: 211, stock: 10 });
    const customer = await createCustomer();
    const order = await orderOf(customer, [{ productId: 8, quantity: 1 }]);
    const paid = await payOrder(order.id, {
      method: 'debit_card',
      cardNumber: '4111 1111 1111 1111',
    });

    expect(paid.body.payment).toMatchObject({ total: 200.45, points: 200 });
    expect(await getCustomer(customer.id)).toMatchObject({ points: 200, type: 'premium' });
  });
});

describe('loyaltyService - estorno de pontos (linha 23)', () => {
  // Mutante: "Math.max(pontos - estorno, 0)" -> "Math.min(pontos - estorno, 0)"
  // Sobreviveu porque o teste original cancelava o único pedido do cliente, e aí max e min dão 0.
  test('cancelar um pedido estorna apenas os pontos daquele pedido', async () => {
    const customer = await createCustomer();
    const first = await orderOf(customer, [{ productId: 3, quantity: 2 }]);
    const second = await orderOf(customer, [{ productId: 1, quantity: 1 }]);
    await payOrder(first.id, { method: 'pix' }); // R$ 19,95 -> 19 pontos
    await payOrder(second.id, { method: 'pix' }); // R$ 6,18 -> 6 pontos

    await request(app).post(`/orders/${second.id}/cancel`).send({ reason: 'Desistiu' });

    expect((await getCustomer(customer.id)).points).toBe(19);
  });
});
