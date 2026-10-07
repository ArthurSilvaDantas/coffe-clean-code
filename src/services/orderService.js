const { db } = require('../data/db');
const helpers = require('../utils/helpers');
const productRepository = require('../repositories/productRepository');
const orderRepository = require('../repositories/orderRepository');

function doCalc(o) {
  const subtotal = helpers.calc(o.items);
  const customer = db.customers.find((c) => c.id === o.customerId);
  let discount = 0;

  if (customer.type === 'premium') {
    discount = subtotal * 0.1;
  } else {
    if (subtotal >= 100) {
      discount = subtotal * 0.05;
    }
  }

  if (o.coupon) {
    if (o.coupon === 'CAFE10') {
      discount = discount + subtotal * 0.1;
    } else if (o.coupon === 'BEMVINDO') {
      discount = discount + 5;
    }
  }

  if (discount > subtotal * 0.3) {
    discount = subtotal * 0.3;
  }

  let fee = 0;
  if (o.deliveryType === 'delivery') {
    if (customer.type === 'premium' || subtotal >= 50 || o.coupon === 'FRETEGRATIS') {
      fee = 0;
    } else {
      fee = 7;
      if (o.distance > 3) {
        fee = fee + (o.distance - 3) * 1.5;
      }
    }
  }

  o.subtotal = helpers.round(subtotal);
  o.discount = helpers.round(discount);
  o.deliveryFee = helpers.round(fee);
  o.total = helpers.round(subtotal - discount + fee);
  return o;
}

function createOrder(customerId, deliveryType, distance, address, notes, items) {
  const customer = db.customers.find((c) => c.id === Number(customerId));
  if (!customer) {
    return { error: 'Cliente não encontrado', status: 404 };
  }
  if (orderRepository.countOpenByCustomer(customer.id) >= 3) {
    return { error: 'Cliente possui muitos pedidos em aberto', status: 409 };
  }

  const type = deliveryType || 'pickup';
  if (type !== 'pickup' && type !== 'delivery') {
    return { error: 'Tipo de entrega inválido', status: 400 };
  }
  if (type === 'delivery') {
    if (!address) {
      return { error: 'Endereço é obrigatório para entrega', status: 400 };
    }
    if (distance === undefined || distance <= 0) {
      return { error: 'Distância inválida', status: 400 };
    } else if (distance > 10) {
      return { error: 'Endereço fora da área de entrega', status: 400 };
    }
  }

  const order = {
    customerId: customer.id,
    items: [],
    deliveryType: type,
    distance: type === 'delivery' ? distance : 0,
    address: address || null,
    notes: notes || '',
    coupon: null,
    status: 'CREATED',
    createdAt: helpers.now(),
    history: [{ status: 'CREATED', at: helpers.now() }],
  };

  if (items && items.length) {
    for (const it of items) {
      const p = productRepository.getProduct(it.productId);
      if (!p || !p.active) {
        return { error: 'Produto ' + it.productId + ' não encontrado', status: 404 };
      }
      if (!it.quantity || it.quantity <= 0 || it.quantity > 10) {
        return { error: 'Quantidade inválida para o produto ' + p.name, status: 400 };
      }
      if (p.stock < it.quantity) {
        return { error: 'Estoque insuficiente para ' + p.name, status: 409 };
      }
    }
    for (const it of items) {
      const p = productRepository.decreaseStock(it.productId, it.quantity);
      const existing = order.items.find((i) => i.productId === p.id);
      if (existing) {
        existing.qty = existing.qty + it.quantity;
      } else {
        order.items.push({ productId: p.id, name: p.name, price: p.price, qty: it.quantity });
      }
    }
  }

  doCalc(order);
  orderRepository.saveOrder(order);
  return { order };
}

function handle(req, res) {
  const o = orderRepository.getOrder(req.params.id);
  if (!o) return res.status(404).json({ error: 'Pedido não encontrado' });
  if (o.status !== 'CREATED') {
    return res.status(400).json({ error: 'Pedido não pode mais ser alterado' });
  }

  const productId = req.body.productId;
  const qty = req.body.quantity;
  if (!productId) return res.status(400).json({ message: 'productId é obrigatório' });
  if (!qty || qty <= 0) return res.status(400).json({ message: 'Quantidade inválida' });

  const p = db.products.find((x) => x.id === Number(productId));
  if (!p || !p.active) return res.status(404).json({ error: 'Produto não encontrado' });

  let existing = null;
  for (let i = 0; i < o.items.length; i++) {
    if (o.items[i].productId === p.id) {
      existing = o.items[i];
    }
  }

  let total = qty;
  if (existing) total = existing.qty + qty;
  if (total > 10) return res.status(400).json({ error: 'Máximo de 10 unidades por produto' });
  if (p.stock < qty) return res.status(409).json({ error: 'Estoque insuficiente para ' + p.name });
  if (!existing && o.items.length >= 15) {
    return res.status(400).json({ error: 'Limite de itens atingido' });
  }

  // diminui o estoque
  p.stock = p.stock - qty;

  if (existing) {
    existing.qty = total;
  } else {
    o.items.push({ productId: p.id, name: p.name, price: p.price, qty: qty });
  }

  doCalc(o);
  res.status(201).json(o);
}

function applyCoupon(orderId, code) {
  const o = orderRepository.getOrder(orderId);
  if (!o) {
    const err = new Error('Pedido não encontrado');
    err.status = 404;
    throw err;
  }
  if (o.status !== 'CREATED') {
    const err = new Error('Cupom só pode ser aplicado em pedidos abertos');
    err.status = 400;
    throw err;
  }

  const c = (code || '').toUpperCase().trim();
  const validCoupons = ['CAFE10', 'BEMVINDO', 'FRETEGRATIS'];
  if (validCoupons.indexOf(c) === -1) {
    const err = new Error('Cupom inválido');
    err.status = 400;
    throw err;
  }
  if (c === 'BEMVINDO' && orderRepository.hasPaidOrders(o.customerId)) {
    const err = new Error('Cupom válido apenas para a primeira compra');
    err.status = 400;
    throw err;
  }
  if (c === 'FRETEGRATIS' && o.deliveryType !== 'delivery') {
    const err = new Error('Cupom válido apenas para pedidos com entrega');
    err.status = 400;
    throw err;
  }

  o.coupon = c;
  return doCalc(o);
}

module.exports = { doCalc, createOrder, handle, applyCoupon };
