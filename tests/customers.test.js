const { reset } = require('../src/data/db');
const { app, request, createCustomer } = require('./helpers');

beforeEach(() => reset());

describe('Clientes', () => {
  test('cadastra cliente regular por padrão', async () => {
    const res = await request(app)
      .post('/customers')
      .send({ name: 'Maria Souza', email: 'Maria@Email.com', phone: '67999990000' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: 1,
      name: 'Maria Souza',
      email: 'maria@email.com',
      type: 'regular',
      points: 0,
    });
  });

  test('cadastra cliente premium', async () => {
    const customer = await createCustomer({ type: 'premium' });
    expect(customer.type).toBe('premium');
  });

  test('rejeita nome curto, email inválido e tipo desconhecido', async () => {
    const shortName = await request(app).post('/customers').send({ name: 'Al', email: 'a@a.com' });
    const badEmail = await request(app).post('/customers').send({ name: 'Ana', email: 'ana.com' });
    const badType = await request(app)
      .post('/customers')
      .send({ name: 'Ana', email: 'ana@a.com', type: 'gold' });

    expect(shortName.status).toBe(400);
    expect(badEmail.status).toBe(400);
    expect(badType.status).toBe(400);
  });

  test('não permite email duplicado', async () => {
    await createCustomer({ email: 'joao@email.com' });
    const res = await request(app)
      .post('/customers')
      .send({ name: 'João Outro', email: 'JOAO@email.com' });
    expect(res.status).toBe(409);
  });

  test('consulta cliente por id e retorna 404 quando não existe', async () => {
    const customer = await createCustomer();
    const found = await request(app).get(`/customers/${customer.id}`);
    const notFound = await request(app).get('/customers/999');

    expect(found.status).toBe(200);
    expect(found.body.email).toBe(customer.email);
    expect(notFound.status).toBe(404);
  });

  test('lista clientes filtrando por tipo', async () => {
    await createCustomer();
    await createCustomer({ type: 'premium' });
    const res = await request(app).get('/customers?type=premium');
    expect(res.body).toHaveLength(1);
  });
});
