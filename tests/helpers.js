const http = require('http');
const supertest = require('supertest');
const app = require('../src/app');

// Um único servidor HTTP por arquivo de teste, com conexões keep-alive.
// Com supertest(app), cada requisição abria um servidor novo numa porta nova; no teste de mutação
// (milhares de execuções em paralelo) as portas locais se esgotavam (EADDRNOTAVAIL) e testes
// falhavam por erro de rede, marcando mutantes como "mortos" sem que tivessem sido detectados.
const server = http.createServer(app);
const keepAliveAgent = new http.Agent({ keepAlive: true });

beforeAll((done) => {
  server.listen(0, '127.0.0.1', done);
});

afterAll((done) => {
  keepAliveAgent.destroy();
  server.close(done);
});

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

function request(target) {
  const client = supertest(target === app ? server : target);
  const wrapped = {};
  for (const method of HTTP_METHODS) {
    wrapped[method] = (url) => client[method](url).agent(keepAliveAgent);
  }
  return wrapped;
}

let emailCounter = 0;

async function createCustomer(overrides = {}) {
  emailCounter++;
  const res = await request(app)
    .post('/customers')
    .send({ name: 'Cliente Teste', email: `cliente${emailCounter}@teste.com`, ...overrides });
  return res.body;
}

async function createOrder(payload) {
  return request(app).post('/orders').send(payload);
}

async function payOrder(orderId, payload) {
  return request(app).post(`/orders/${orderId}/pay`).send(payload);
}

async function changeStatus(orderId, status) {
  return request(app).patch(`/orders/${orderId}/status`).send({ status });
}

module.exports = { app, request, createCustomer, createOrder, payOrder, changeStatus };
