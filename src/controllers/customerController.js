const customerRepository = require('../repositories/customerRepository');
const { db } = require('../data/db');
const helpers = require('../utils/helpers');

function create(req, res) {
  const data = req.body || {};
  if (!data.name || data.name.trim().length < 3) {
    return res.status(400).json({ error: 'Nome inválido' });
  }
  if (!data.email || data.email.indexOf('@') == -1) {
    return res.status(400).json({ error: 'Email inválido' });
  }

  const exists = db.customers.find((c) => c.email.toLowerCase() == data.email.toLowerCase());
  if (exists) {
    return res.status(409).json({ error: 'Email já cadastrado' });
  }

  let type = 'regular';
  if (data.type) {
    if (data.type == 'premium' || data.type == 'regular') {
      type = data.type;
    } else {
      return res.status(400).json({ msg: 'Tipo de cliente inválido' });
    }
  }

  const customer = customerRepository.save({
    name: data.name.trim(),
    email: data.email.toLowerCase(),
    phone: data.phone || null,
    type: type,
    points: 0,
    createdAt: new Date().toISOString(),
  });
  res.status(201).json(customer);
}

function list(req, res) {
  let result = customerRepository.all();
  if (req.query.type) {
    result = result.filter((c) => c.type == req.query.type);
  }
  res.json(result);
}

function get(req, res) {
  const c = customerRepository.findById(req.params.id);
  if (!c) {
    return res.status(404).json({ error: 'Cliente não encontrado' });
  }
  res.json(c);
}

module.exports = { create, list, get };
