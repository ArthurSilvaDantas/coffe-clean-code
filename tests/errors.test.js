const { reset } = require('../src/data/db');
const { app, request, createCustomer, createOrder } = require('./helpers');

beforeEach(() => reset());

describe('Formato dos erros', () => {
  test('todas as respostas de erro usam a chave error', async () => {
    const customer = await createCustomer();
    const order = (await createOrder({ customerId: customer.id })).body;

    const responses = await Promise.all([
      request(app).post('/customers').send({ name: 'Ana', email: 'ana@a.com', type: 'gold' }),
      request(app).post('/products').send({ name: 'Chá', price: 5, category: 'toys' }),
      request(app).post(`/orders/${order.id}/items`).send({ quantity: 1 }),
      request(app).post(`/orders/${order.id}/coupon`).send({ code: 'NADA' }),
      request(app)
        .post(`/orders/${order.id}/cancel`)
        .send({})
        .then(() => request(app).post(`/orders/${order.id}/cancel`).send({})),
      request(app).get('/rota-inexistente'),
    ]);

    for (const res of responses) {
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(Object.keys(res.body)).toEqual(['error']);
      expect(typeof res.body.error).toBe('string');
    }
  });

  test('JSON malformado retorna 400', async () => {
    const res = await request(app)
      .post('/customers')
      .set('Content-Type', 'application/json')
      .send('{ invalido');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'JSON inválido' });
  });
});
