const customerRepository = require('../repositories/customerRepository');
const { db } = require('../data/db');
const { CUSTOMER_RULES } = require('../constants/businessRules');
const { CUSTOMER_TYPE } = require('../constants/domain');
const { badRequest, conflict, notFound } = require('../errors/AppError');

function create(req, res) {
  const customerData = req.body || {};
  if (!customerData.name || customerData.name.trim().length < CUSTOMER_RULES.MIN_NAME_LENGTH) {
    throw badRequest('Nome inválido');
  }
  if (!customerData.email || customerData.email.indexOf('@') === -1) {
    throw badRequest('Email inválido');
  }

  const existingCustomer = db.customers.find(
    (c) => c.email.toLowerCase() === customerData.email.toLowerCase(),
  );
  if (existingCustomer) {
    throw conflict('Email já cadastrado');
  }

  const customerType = customerData.type || CUSTOMER_TYPE.REGULAR;
  if (customerType !== CUSTOMER_TYPE.PREMIUM && customerType !== CUSTOMER_TYPE.REGULAR) {
    throw badRequest('Tipo de cliente inválido');
  }

  const customer = customerRepository.save({
    name: customerData.name.trim(),
    email: customerData.email.toLowerCase(),
    phone: customerData.phone || null,
    type: customerType,
    points: 0,
    createdAt: new Date().toISOString(),
  });
  res.status(201).json(customer);
}

function list(req, res) {
  let customers = customerRepository.findAll();
  if (req.query.type) {
    customers = customers.filter((c) => c.type === req.query.type);
  }
  res.json(customers);
}

function get(req, res) {
  const customer = customerRepository.findById(req.params.id);
  if (!customer) {
    throw notFound('Cliente não encontrado');
  }
  res.json(customer);
}

module.exports = { create, list, get };
