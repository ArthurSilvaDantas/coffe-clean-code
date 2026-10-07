const customerRepository = require('../repositories/customerRepository');
const { db } = require('../data/db');
const { CUSTOMER_RULES } = require('../constants/businessRules');

function create(req, res) {
  const customerData = req.body || {};
  if (!customerData.name || customerData.name.trim().length < CUSTOMER_RULES.MIN_NAME_LENGTH) {
    return res.status(400).json({ error: 'Nome inválido' });
  }
  if (!customerData.email || customerData.email.indexOf('@') === -1) {
    return res.status(400).json({ error: 'Email inválido' });
  }

  const existingCustomer = db.customers.find(
    (c) => c.email.toLowerCase() === customerData.email.toLowerCase(),
  );
  if (existingCustomer) {
    return res.status(409).json({ error: 'Email já cadastrado' });
  }

  let customerType = 'regular';
  if (customerData.type) {
    if (customerData.type === 'premium' || customerData.type === 'regular') {
      customerType = customerData.type;
    } else {
      return res.status(400).json({ msg: 'Tipo de cliente inválido' });
    }
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
    return res.status(404).json({ error: 'Cliente não encontrado' });
  }
  res.json(customer);
}

module.exports = { create, list, get };
