const { reset } = require('../src/data/db');
const { app, request } = require('./helpers');

beforeEach(() => reset());

describe('Produtos', () => {
  test('lista os produtos iniciais', async () => {
    const res = await request(app).get('/products');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(7);
  });

  test('filtra produtos por categoria', async () => {
    const res = await request(app).get('/products?category=food');
    expect(res.body.map((p) => p.name)).toEqual(['Pão de queijo', 'Croissant', 'Bolo de cenoura']);
  });

  test('cadastra produto com categoria padrão', async () => {
    const res = await request(app).post('/products').send({ name: 'Mocha', price: 13.5, stock: 8 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: 8,
      name: 'Mocha',
      price: 13.5,
      stock: 8,
      category: 'coffee',
    });
  });

  test('rejeita produto com preço, estoque ou categoria inválidos', async () => {
    const noPrice = await request(app).post('/products').send({ name: 'Chá' });
    const expensive = await request(app).post('/products').send({ name: 'Chá', price: 501 });
    const badStock = await request(app)
      .post('/products')
      .send({ name: 'Chá', price: 5, stock: 201 });
    const badCategory = await request(app)
      .post('/products')
      .send({ name: 'Chá', price: 5, category: 'toys' });

    expect(noPrice.status).toBe(400);
    expect(expensive.status).toBe(400);
    expect(badStock.status).toBe(400);
    expect(badCategory.status).toBe(400);
  });

  test('atualiza estoque e impede estoque negativo', async () => {
    const added = await request(app).patch('/products/7/stock').send({ quantity: 10 });
    const negative = await request(app).patch('/products/7/stock').send({ quantity: -100 });

    expect(added.status).toBe(200);
    expect(added.body.stock).toBe(15);
    expect(negative.status).toBe(400);
  });

  test('lista apenas produtos disponíveis', async () => {
    await request(app).patch('/products/7/stock').send({ quantity: -5 });
    const res = await request(app).get('/products?available=true');
    expect(res.body).toHaveLength(6);
  });
});
