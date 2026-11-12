// Testes criados a partir dos mutantes que sobreviveram em src/services/pricingService.js
// na rodada 1 do teste de mutação (StrykerJS).
const { reset } = require('../../src/data/db');
const { app, request, createCustomer, createOrder } = require('../helpers');

beforeEach(() => reset());

describe('pricingService - desconto do cliente regular (linha 14)', () => {
  // Mutante: "subtotal >= 100" -> "subtotal > 100"
  // Sobreviveu porque os testes originais usavam subtotais de 105 e 21, nunca exatamente 100.
  test('subtotal de exatamente R$ 100 já recebe 5% de desconto', async () => {
    await request(app).post('/products').send({ name: 'Kit', price: 50, stock: 10 });
    const customer = await createCustomer();
    const order = (
      await createOrder({ customerId: customer.id, items: [{ productId: 8, quantity: 2 }] })
    ).body;

    expect(order).toMatchObject({ subtotal: 100, discount: 5, total: 95 });
  });
});

describe('pricingService - entrega grátis (linha 43)', () => {
  // Mutante: "subtotal >= 50" -> "subtotal > 50"
  // Sobreviveu porque os testes originais usavam subtotais de 52,50 e 6,50, nunca exatamente 50.
  test('subtotal de exatamente R$ 50 já tem entrega grátis', async () => {
    const customer = await createCustomer();
    const order = (
      await createOrder({
        customerId: customer.id,
        deliveryType: 'delivery',
        address: 'Rua A, 10',
        distance: 5,
        items: [{ productId: 4, quantity: 10 }],
      })
    ).body;

    expect(order).toMatchObject({ subtotal: 50, deliveryFee: 0, total: 50 });
  });
});
