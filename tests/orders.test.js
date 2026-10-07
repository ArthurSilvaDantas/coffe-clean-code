const { reset } = require('../src/data/db');
const { app, request, createCustomer, createOrder } = require('./helpers');

beforeEach(() => reset());

describe('Criação de pedidos', () => {
  test('cria pedido para retirada calculando o total e baixando estoque', async () => {
    const customer = await createCustomer();
    const res = await createOrder({
      customerId: customer.id,
      items: [
        { productId: 2, quantity: 2 },
        { productId: 4, quantity: 1 },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'CREATED',
      deliveryType: 'pickup',
      subtotal: 24.8,
      discount: 0,
      deliveryFee: 0,
      total: 24.8,
    });

    const products = await request(app).get('/products');
    expect(products.body.find((p) => p.id === 2).stock).toBe(28);
  });

  test('cliente regular recebe 5% de desconto em pedidos a partir de R$ 100', async () => {
    const customer = await createCustomer();
    const res = await createOrder({
      customerId: customer.id,
      items: [{ productId: 3, quantity: 10 }],
    });

    expect(res.body).toMatchObject({ subtotal: 105, discount: 5.25, total: 99.75 });
  });

  test('cliente premium recebe 10% de desconto', async () => {
    const customer = await createCustomer({ type: 'premium' });
    const res = await createOrder({
      customerId: customer.id,
      items: [{ productId: 3, quantity: 2 }],
    });

    expect(res.body).toMatchObject({ subtotal: 21, discount: 2.1, total: 18.9 });
  });

  test('cobra taxa de entrega com adicional por distância', async () => {
    const customer = await createCustomer();
    const near = await createOrder({
      customerId: customer.id,
      deliveryType: 'delivery',
      address: 'Rua A, 10',
      distance: 2,
      items: [{ productId: 1, quantity: 1 }],
    });
    const far = await createOrder({
      customerId: customer.id,
      deliveryType: 'delivery',
      address: 'Rua B, 20',
      distance: 5,
      items: [{ productId: 1, quantity: 1 }],
    });

    expect(near.body).toMatchObject({ deliveryFee: 7, total: 13.5 });
    expect(far.body).toMatchObject({ deliveryFee: 10, total: 16.5 });
  });

  test('entrega grátis para pedidos a partir de R$ 50 e para clientes premium', async () => {
    const regular = await createCustomer();
    const premium = await createCustomer({ type: 'premium' });
    const big = await createOrder({
      customerId: regular.id,
      deliveryType: 'delivery',
      address: 'Rua A, 10',
      distance: 8,
      items: [{ productId: 3, quantity: 5 }],
    });
    const premiumOrder = await createOrder({
      customerId: premium.id,
      deliveryType: 'delivery',
      address: 'Rua C, 30',
      distance: 8,
      items: [{ productId: 1, quantity: 1 }],
    });

    expect(big.body).toMatchObject({ deliveryFee: 0, total: 52.5 });
    expect(premiumOrder.body.deliveryFee).toBe(0);
  });

  test('valida dados de entrega', async () => {
    const customer = await createCustomer();
    const noAddress = await createOrder({
      customerId: customer.id,
      deliveryType: 'delivery',
      distance: 2,
    });
    const tooFar = await createOrder({
      customerId: customer.id,
      deliveryType: 'delivery',
      address: 'Rua Longe, 1',
      distance: 11,
    });
    const badType = await createOrder({ customerId: customer.id, deliveryType: 'drone' });

    expect(noAddress.status).toBe(400);
    expect(tooFar.status).toBe(400);
    expect(badType.status).toBe(400);
  });

  test('rejeita cliente inexistente, produto inexistente e estoque insuficiente', async () => {
    const customer = await createCustomer();
    const noCustomer = await createOrder({ customerId: 999 });
    const noProduct = await createOrder({
      customerId: customer.id,
      items: [{ productId: 99, quantity: 1 }],
    });
    const noStock = await createOrder({
      customerId: customer.id,
      items: [{ productId: 7, quantity: 6 }],
    });

    expect(noCustomer.status).toBe(404);
    expect(noProduct.status).toBe(404);
    expect(noStock.status).toBe(409);
  });

  test('limita a 3 pedidos em aberto por cliente', async () => {
    const customer = await createCustomer();
    await createOrder({ customerId: customer.id });
    await createOrder({ customerId: customer.id });
    await createOrder({ customerId: customer.id });
    const fourth = await createOrder({ customerId: customer.id });

    expect(fourth.status).toBe(409);
  });
});

describe('Itens do pedido', () => {
  test('adiciona itens e acumula quantidade do mesmo produto', async () => {
    const customer = await createCustomer();
    const order = (await createOrder({ customerId: customer.id })).body;

    await request(app).post(`/orders/${order.id}/items`).send({ productId: 5, quantity: 2 });
    const res = await request(app)
      .post(`/orders/${order.id}/items`)
      .send({ productId: 5, quantity: 1 });

    expect(res.status).toBe(201);
    expect(res.body.items).toEqual([{ productId: 5, name: 'Croissant', price: 8, qty: 3 }]);
    expect(res.body.total).toBe(24);
  });

  test('não permite mais de 10 unidades do mesmo produto', async () => {
    const customer = await createCustomer();
    const order = (
      await createOrder({ customerId: customer.id, items: [{ productId: 1, quantity: 8 }] })
    ).body;
    const res = await request(app)
      .post(`/orders/${order.id}/items`)
      .send({ productId: 1, quantity: 3 });

    expect(res.status).toBe(400);
  });

  test('não permite adicionar além do estoque', async () => {
    const customer = await createCustomer();
    const order = (await createOrder({ customerId: customer.id })).body;
    const res = await request(app)
      .post(`/orders/${order.id}/items`)
      .send({ productId: 7, quantity: 6 });

    expect(res.status).toBe(409);
  });

  test('retorna 404 para pedido inexistente', async () => {
    const res = await request(app).post('/orders/999/items').send({ productId: 1, quantity: 1 });
    expect(res.status).toBe(404);
  });
});

describe('Cupons', () => {
  test('CAFE10 soma 10% ao desconto do cliente', async () => {
    const regular = await createCustomer();
    const premium = await createCustomer({ type: 'premium' });
    const regularOrder = (
      await createOrder({ customerId: regular.id, items: [{ productId: 3, quantity: 2 }] })
    ).body;
    const premiumOrder = (
      await createOrder({ customerId: premium.id, items: [{ productId: 3, quantity: 2 }] })
    ).body;

    const r1 = await request(app)
      .post(`/orders/${regularOrder.id}/coupon`)
      .send({ code: 'cafe10' });
    const r2 = await request(app)
      .post(`/orders/${premiumOrder.id}/coupon`)
      .send({ code: 'CAFE10' });

    expect(r1.body).toMatchObject({ coupon: 'CAFE10', discount: 2.1, total: 18.9 });
    expect(r2.body).toMatchObject({ discount: 4.2, total: 16.8 });
  });

  test('desconto total é limitado a 30% do subtotal', async () => {
    const customer = await createCustomer();
    const order = (
      await createOrder({ customerId: customer.id, items: [{ productId: 1, quantity: 1 }] })
    ).body;
    const res = await request(app).post(`/orders/${order.id}/coupon`).send({ code: 'BEMVINDO' });

    expect(res.body).toMatchObject({ subtotal: 6.5, discount: 1.95, total: 4.55 });
  });

  test('FRETEGRATIS remove a taxa de entrega e exige pedido com entrega', async () => {
    const customer = await createCustomer();
    const delivery = (
      await createOrder({
        customerId: customer.id,
        deliveryType: 'delivery',
        address: 'Rua A, 10',
        distance: 4,
        items: [{ productId: 1, quantity: 1 }],
      })
    ).body;
    const pickup = (
      await createOrder({ customerId: customer.id, items: [{ productId: 1, quantity: 1 }] })
    ).body;

    const ok = await request(app)
      .post(`/orders/${delivery.id}/coupon`)
      .send({ code: 'FRETEGRATIS' });
    const fail = await request(app)
      .post(`/orders/${pickup.id}/coupon`)
      .send({ code: 'FRETEGRATIS' });

    expect(ok.body).toMatchObject({ deliveryFee: 0, total: 6.5 });
    expect(fail.status).toBe(400);
  });

  test('BEMVINDO só vale para a primeira compra', async () => {
    const customer = await createCustomer();
    const first = (
      await createOrder({ customerId: customer.id, items: [{ productId: 3, quantity: 2 }] })
    ).body;
    await request(app).post(`/orders/${first.id}/pay`).send({ method: 'pix' });

    const second = (
      await createOrder({ customerId: customer.id, items: [{ productId: 3, quantity: 2 }] })
    ).body;
    const res = await request(app).post(`/orders/${second.id}/coupon`).send({ code: 'BEMVINDO' });

    expect(res.status).toBe(400);
  });

  test('rejeita cupom inválido', async () => {
    const customer = await createCustomer();
    const order = (await createOrder({ customerId: customer.id })).body;
    const res = await request(app).post(`/orders/${order.id}/coupon`).send({ code: 'NADA' });

    expect(res.status).toBe(400);
  });
});

describe('Consulta de pedidos', () => {
  test('lista pedidos por status e por cliente', async () => {
    const a = await createCustomer();
    const b = await createCustomer();
    const orderA = (await createOrder({ customerId: a.id, items: [{ productId: 1, quantity: 2 }] }))
      .body;
    await createOrder({ customerId: b.id, items: [{ productId: 1, quantity: 2 }] });
    await request(app).post(`/orders/${orderA.id}/pay`).send({ method: 'pix' });

    const paid = await request(app).get('/orders?status=paid');
    const byCustomer = await request(app).get(`/orders?customerId=${b.id}`);
    const fromCustomerRoute = await request(app).get(`/customers/${a.id}/orders`);
    const single = await request(app).get(`/orders/${orderA.id}`);

    expect(paid.body).toHaveLength(1);
    expect(byCustomer.body).toHaveLength(1);
    expect(fromCustomerRoute.body[0].id).toBe(orderA.id);
    expect(single.body.status).toBe('PAID');
  });

  test('retorna 404 para pedido inexistente', async () => {
    const res = await request(app).get('/orders/999');
    expect(res.status).toBe(404);
  });
});
