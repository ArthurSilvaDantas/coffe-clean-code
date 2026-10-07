const { reset } = require('../src/data/db');
const { app, request, createCustomer, createOrder, payOrder, changeStatus } = require('./helpers');

beforeEach(() => reset());

async function paidOrder(extra = {}) {
  const customer = await createCustomer();
  const order = (
    await createOrder({
      customerId: customer.id,
      items: [
        { productId: 2, quantity: 2 },
        { productId: 4, quantity: 1 },
      ],
      ...extra,
    })
  ).body;
  await payOrder(order.id, { method: 'pix' });
  return { customer, order };
}

async function stockOf(productId) {
  const res = await request(app).get('/products');
  return res.body.find((p) => p.id === productId).stock;
}

describe('Status do pedido', () => {
  test('fluxo completo de retirada', async () => {
    const { order } = await paidOrder();

    expect((await changeStatus(order.id, 'PREPARING')).status).toBe(200);
    expect((await changeStatus(order.id, 'READY')).status).toBe(200);
    const delivered = await changeStatus(order.id, 'DELIVERED');

    expect(delivered.status).toBe(200);
    expect(delivered.body.history.map((h) => h.status)).toEqual([
      'CREATED',
      'PAID',
      'PREPARING',
      'READY',
      'DELIVERED',
    ]);
  });

  test('pedido com entrega precisa sair para entrega antes de ser entregue', async () => {
    const { order } = await paidOrder({
      deliveryType: 'delivery',
      address: 'Rua A, 10',
      distance: 2,
    });
    await changeStatus(order.id, 'PREPARING');
    await changeStatus(order.id, 'READY');

    const skip = await changeStatus(order.id, 'DELIVERED');
    const out = await changeStatus(order.id, 'OUT_FOR_DELIVERY');
    const delivered = await changeStatus(order.id, 'DELIVERED');

    expect(skip.status).toBe(400);
    expect(out.status).toBe(200);
    expect(delivered.status).toBe(200);
  });

  test('rejeita transições inválidas', async () => {
    const customer = await createCustomer();
    const order = (
      await createOrder({ customerId: customer.id, items: [{ productId: 1, quantity: 1 }] })
    ).body;

    const invalid = await changeStatus(order.id, 'READY');
    const missing = await request(app).patch(`/orders/${order.id}/status`).send({});
    const notFound = await changeStatus(999, 'READY');

    expect(invalid.status).toBe(400);
    expect(missing.status).toBe(400);
    expect(notFound.status).toBe(404);
  });
});

describe('Cancelamento', () => {
  test('cancela pedido aberto sem reembolso e devolve o estoque', async () => {
    const customer = await createCustomer();
    const order = (
      await createOrder({ customerId: customer.id, items: [{ productId: 2, quantity: 3 }] })
    ).body;
    expect(await stockOf(2)).toBe(27);

    const res = await request(app).post(`/orders/${order.id}/cancel`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'CANCELLED', refund: 0 });
    expect(await stockOf(2)).toBe(30);
  });

  test('pedido pago exige motivo e tem reembolso integral', async () => {
    const { customer, order } = await paidOrder();

    const noReason = await request(app).post(`/orders/${order.id}/cancel`).send({});
    const res = await request(app).post(`/orders/${order.id}/cancel`).send({ reason: 'Desistiu' });
    const updatedCustomer = await request(app).get(`/customers/${customer.id}`);

    expect(noReason.status).toBe(400);
    expect(res.body).toMatchObject({
      status: 'CANCELLED',
      refund: 23.56,
      cancelReason: 'Desistiu',
    });
    expect(updatedCustomer.body.points).toBe(0);
  });

  test('pedido em preparo tem reembolso de 50%', async () => {
    const { order } = await paidOrder();
    await changeStatus(order.id, 'PREPARING');

    const res = await request(app).post(`/orders/${order.id}/cancel`).send({ reason: 'Demorou' });
    expect(res.body.refund).toBe(11.78);
  });

  test('não cancela pedido pronto ou entregue', async () => {
    const { order } = await paidOrder();
    await changeStatus(order.id, 'PREPARING');
    await changeStatus(order.id, 'READY');

    const res = await request(app)
      .post(`/orders/${order.id}/cancel`)
      .send({ reason: 'Tarde demais' });
    expect(res.status).toBe(400);
  });

  test('não permite pagar pedido cancelado', async () => {
    const customer = await createCustomer();
    const order = (
      await createOrder({ customerId: customer.id, items: [{ productId: 1, quantity: 1 }] })
    ).body;
    await request(app).post(`/orders/${order.id}/cancel`);

    const res = await payOrder(order.id, { method: 'pix' });
    expect(res.status).toBe(400);
  });
});
