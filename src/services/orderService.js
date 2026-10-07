const { db } = require('../data/db');
const helpers = require('../utils/helpers');
const productRepository = require('../repositories/productRepository');
const orderRepository = require('../repositories/orderRepository');

function calculateTotals(order) {
  const subtotal = helpers.calculateSubtotal(order.items);
  const customer = db.customers.find((c) => c.id === order.customerId);
  let discount = 0;

  if (customer.type === 'premium') {
    discount = subtotal * 0.1;
  } else {
    if (subtotal >= 100) {
      discount = subtotal * 0.05;
    }
  }

  if (order.coupon) {
    if (order.coupon === 'CAFE10') {
      discount = discount + subtotal * 0.1;
    } else if (order.coupon === 'BEMVINDO') {
      discount = discount + 5;
    }
  }

  if (discount > subtotal * 0.3) {
    discount = subtotal * 0.3;
  }

  let deliveryFee = 0;
  if (order.deliveryType === 'delivery') {
    if (customer.type === 'premium' || subtotal >= 50 || order.coupon === 'FRETEGRATIS') {
      deliveryFee = 0;
    } else {
      deliveryFee = 7;
      if (order.distance > 3) {
        deliveryFee = deliveryFee + (order.distance - 3) * 1.5;
      }
    }
  }

  order.subtotal = helpers.roundToCents(subtotal);
  order.discount = helpers.roundToCents(discount);
  order.deliveryFee = helpers.roundToCents(deliveryFee);
  order.total = helpers.roundToCents(subtotal - discount + deliveryFee);
  return order;
}

function createOrder(customerId, deliveryType, distance, address, notes, items) {
  const customer = db.customers.find((c) => c.id === Number(customerId));
  if (!customer) {
    return { error: 'Cliente não encontrado', status: 404 };
  }
  if (orderRepository.countOpenByCustomer(customer.id) >= 3) {
    return { error: 'Cliente possui muitos pedidos em aberto', status: 409 };
  }

  const selectedDeliveryType = deliveryType || 'pickup';
  if (selectedDeliveryType !== 'pickup' && selectedDeliveryType !== 'delivery') {
    return { error: 'Tipo de entrega inválido', status: 400 };
  }
  if (selectedDeliveryType === 'delivery') {
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
    deliveryType: selectedDeliveryType,
    distance: selectedDeliveryType === 'delivery' ? distance : 0,
    address: address || null,
    notes: notes || '',
    coupon: null,
    status: 'CREATED',
    createdAt: helpers.now(),
    history: [{ status: 'CREATED', at: helpers.now() }],
  };

  if (items && items.length) {
    for (const requestedItem of items) {
      const product = productRepository.findById(requestedItem.productId);
      if (!product || !product.active) {
        return { error: 'Produto ' + requestedItem.productId + ' não encontrado', status: 404 };
      }
      if (!requestedItem.quantity || requestedItem.quantity <= 0 || requestedItem.quantity > 10) {
        return { error: 'Quantidade inválida para o produto ' + product.name, status: 400 };
      }
      if (product.stock < requestedItem.quantity) {
        return { error: 'Estoque insuficiente para ' + product.name, status: 409 };
      }
    }
    for (const requestedItem of items) {
      const product = productRepository.decreaseStock(
        requestedItem.productId,
        requestedItem.quantity,
      );
      const existingItem = order.items.find((item) => item.productId === product.id);
      if (existingItem) {
        existingItem.quantity = existingItem.quantity + requestedItem.quantity;
      } else {
        order.items.push({
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: requestedItem.quantity,
        });
      }
    }
  }

  calculateTotals(order);
  orderRepository.save(order);
  return { order };
}

function addItem(req, res) {
  const order = orderRepository.findById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
  if (order.status !== 'CREATED') {
    return res.status(400).json({ error: 'Pedido não pode mais ser alterado' });
  }

  const productId = req.body.productId;
  const quantity = req.body.quantity;
  if (!productId) return res.status(400).json({ message: 'productId é obrigatório' });
  if (!quantity || quantity <= 0) return res.status(400).json({ message: 'Quantidade inválida' });

  const product = db.products.find((p) => p.id === Number(productId));
  if (!product || !product.active) return res.status(404).json({ error: 'Produto não encontrado' });

  let existingItem = null;
  for (let i = 0; i < order.items.length; i++) {
    if (order.items[i].productId === product.id) {
      existingItem = order.items[i];
    }
  }

  let totalQuantity = quantity;
  if (existingItem) totalQuantity = existingItem.quantity + quantity;
  if (totalQuantity > 10) {
    return res.status(400).json({ error: 'Máximo de 10 unidades por produto' });
  }
  if (product.stock < quantity) {
    return res.status(409).json({ error: 'Estoque insuficiente para ' + product.name });
  }
  if (!existingItem && order.items.length >= 15) {
    return res.status(400).json({ error: 'Limite de itens atingido' });
  }

  product.stock = product.stock - quantity;

  if (existingItem) {
    existingItem.quantity = totalQuantity;
  } else {
    order.items.push({ productId: product.id, name: product.name, price: product.price, quantity });
  }

  calculateTotals(order);
  res.status(201).json(order);
}

function applyCoupon(orderId, code) {
  const order = orderRepository.findById(orderId);
  if (!order) {
    const err = new Error('Pedido não encontrado');
    err.status = 404;
    throw err;
  }
  if (order.status !== 'CREATED') {
    const err = new Error('Cupom só pode ser aplicado em pedidos abertos');
    err.status = 400;
    throw err;
  }

  const couponCode = (code || '').toUpperCase().trim();
  const validCoupons = ['CAFE10', 'BEMVINDO', 'FRETEGRATIS'];
  if (validCoupons.indexOf(couponCode) === -1) {
    const err = new Error('Cupom inválido');
    err.status = 400;
    throw err;
  }
  if (couponCode === 'BEMVINDO' && orderRepository.hasPaidOrders(order.customerId)) {
    const err = new Error('Cupom válido apenas para a primeira compra');
    err.status = 400;
    throw err;
  }
  if (couponCode === 'FRETEGRATIS' && order.deliveryType !== 'delivery') {
    const err = new Error('Cupom válido apenas para pedidos com entrega');
    err.status = 400;
    throw err;
  }

  order.coupon = couponCode;
  return calculateTotals(order);
}

module.exports = { calculateTotals, createOrder, addItem, applyCoupon };
