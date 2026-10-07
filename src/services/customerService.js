const customerRepository = require('../repositories/customerRepository');
const { now } = require('../utils/date');
const { CUSTOMER_RULES } = require('../constants/businessRules');
const { CUSTOMER_TYPE } = require('../constants/domain');
const { badRequest, conflict, notFound } = require('../errors/AppError');

function isValidName(name) {
  return Boolean(name) && name.trim().length >= CUSTOMER_RULES.MIN_NAME_LENGTH;
}

function isValidEmail(email) {
  return Boolean(email) && email.includes('@');
}

function createCustomer({ name, email, phone, type }) {
  if (!isValidName(name)) {
    throw badRequest('Nome inválido');
  }
  if (!isValidEmail(email)) {
    throw badRequest('Email inválido');
  }
  if (customerRepository.findByEmail(email)) {
    throw conflict('Email já cadastrado');
  }

  const customerType = type || CUSTOMER_TYPE.REGULAR;
  if (!Object.values(CUSTOMER_TYPE).includes(customerType)) {
    throw badRequest('Tipo de cliente inválido');
  }

  return customerRepository.save({
    name: name.trim(),
    email: email.toLowerCase(),
    phone: phone || null,
    type: customerType,
    points: 0,
    createdAt: now(),
  });
}

function listCustomers({ type }) {
  const customers = customerRepository.findAll();
  return type ? customers.filter((c) => c.type === type) : customers;
}

function getCustomer(id) {
  const customer = customerRepository.findById(id);
  if (!customer) {
    throw notFound('Cliente não encontrado');
  }
  return customer;
}

module.exports = { createCustomer, listCustomers, getCustomer };
