const request = require('supertest');
const app = require('../src/app');

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
