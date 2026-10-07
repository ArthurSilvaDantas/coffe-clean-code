const { reset } = require('../src/data/db');
const { app, request, createCustomer, createOrder, payOrder } = require('./helpers');

beforeEach(() => reset());

async function orderOf(customer, items, extra = {}) {
  return (await createOrder({ customerId: customer.id, items, ...extra })).body;
}

const CARD = '4111 1111 1111 1111';

describe('Pagamentos', () => {
  test('PIX concede 5% de desconto e gera pontos de fidelidade', async () => {
    const customer = await createCustomer();
    const order = await orderOf(customer, [
      { productId: 2, quantity: 2 },
      { productId: 4, quantity: 1 },
    ]);

    const res = await payOrder(order.id, { method: 'pix' });
    const updatedCustomer = await request(app).get(`/customers/${customer.id}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PAID');
    expect(res.body.payment).toMatchObject({ method: 'pix', total: 23.56, points: 23 });
    expect(updatedCustomer.body.points).toBe(23);
  });

  test('cliente premium recebe pontos em dobro', async () => {
    const customer = await createCustomer({ type: 'premium' });
    const order = await orderOf(customer, [{ productId: 3, quantity: 2 }]);
    const res = await payOrder(order.id, { method: 'debit_card', cardNumber: CARD });

    expect(res.body.payment).toMatchObject({
      total: 18.9,
      points: 36,
      card: '**** **** **** 1111',
    });
  });

  test('cliente regular vira premium ao atingir 200 pontos', async () => {
    const customer = await createCustomer();
    await request(app).post('/products').send({ name: 'Kit café especial', price: 120, stock: 10 });
    const order = await orderOf(customer, [{ productId: 8, quantity: 2 }]);

    const res = await payOrder(order.id, { method: 'pix' });
    const updatedCustomer = await request(app).get(`/customers/${customer.id}`);

    expect(res.body.payment.total).toBe(216.6);
    expect(updatedCustomer.body).toMatchObject({ points: 216, type: 'premium' });
  });

  test('cartão de crédito sem juros até 3 parcelas', async () => {
    const customer = await createCustomer();
    const order = await orderOf(customer, [{ productId: 3, quantity: 5 }]);
    const res = await payOrder(order.id, {
      method: 'credit_card',
      cardNumber: CARD,
      installments: 3,
    });

    expect(res.body.payment).toMatchObject({
      total: 52.5,
      installments: 3,
      installmentValue: 17.5,
    });
  });

  test('cartão de crédito com juros acima de 3 parcelas', async () => {
    const customer = await createCustomer();
    const order = await orderOf(customer, [{ productId: 3, quantity: 5 }]);
    const res = await payOrder(order.id, {
      method: 'credit_card',
      cardNumber: CARD,
      installments: 5,
    });

    expect(res.body.payment).toMatchObject({
      total: 54.6,
      installments: 5,
      installmentValue: 10.92,
    });
  });

  test('valida cartão, parcelas e parcela mínima', async () => {
    const customer = await createCustomer();
    const order = await orderOf(customer, [
      { productId: 2, quantity: 2 },
      { productId: 4, quantity: 1 },
    ]);

    const badCard = await payOrder(order.id, { method: 'credit_card', cardNumber: '1234' });
    const tooMany = await payOrder(order.id, {
      method: 'credit_card',
      cardNumber: CARD,
      installments: 13,
    });
    const smallInstallment = await payOrder(order.id, {
      method: 'credit_card',
      cardNumber: CARD,
      installments: 3,
    });

    expect(badCard.status).toBe(400);
    expect(tooMany.status).toBe(400);
    expect(smallInstallment.status).toBe(400);
  });

  test('dinheiro calcula troco e exige valor suficiente', async () => {
    const customer = await createCustomer();
    const order = await orderOf(customer, [
      { productId: 2, quantity: 2 },
      { productId: 4, quantity: 1 },
    ]);

    const insufficient = await payOrder(order.id, { method: 'cash', cashGiven: 20 });
    const ok = await payOrder(order.id, { method: 'cash', cashGiven: 50 });

    expect(insufficient.status).toBe(400);
    expect(ok.body.payment).toMatchObject({ total: 24.8, change: 25.2 });
  });

  test('limita troco em pedidos com entrega', async () => {
    const customer = await createCustomer();
    const order = await orderOf(customer, [{ productId: 1, quantity: 1 }], {
      deliveryType: 'delivery',
      address: 'Rua A, 10',
      distance: 1,
    });

    const res = await payOrder(order.id, { method: 'cash', cashGiven: 100 });
    expect(res.status).toBe(400);
  });

  test('rejeita forma de pagamento inválida, pedido vazio e pagamento duplicado', async () => {
    const customer = await createCustomer();
    const empty = await orderOf(customer, []);
    const order = await orderOf(customer, [{ productId: 1, quantity: 1 }]);

    const noMethod = await payOrder(order.id, {});
    const badMethod = await payOrder(order.id, { method: 'boleto' });
    const emptyOrder = await payOrder(empty.id, { method: 'pix' });
    await payOrder(order.id, { method: 'pix' });
    const twice = await payOrder(order.id, { method: 'pix' });
    const notFound = await payOrder(999, { method: 'pix' });

    expect(noMethod.status).toBe(400);
    expect(badMethod.status).toBe(400);
    expect(emptyOrder.status).toBe(400);
    expect(twice.status).toBe(409);
    expect(notFound.status).toBe(404);
  });
});
