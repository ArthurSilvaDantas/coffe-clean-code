const { db } = require('../data/db');
const orderService = require('../services/orderService');
const orderRepository = require('../repositories/orderRepository');

exports.create = (req, res) => {
  const body = req.body || {};
  if (!body.customerId) {
    return res.status(400).json({ error: 'customerId é obrigatório' });
  }
  const result = orderService.createOrder(
    body.customerId,
    body.deliveryType,
    body.distance,
    body.address,
    body.notes,
    body.items,
  );
  if (result.error) {
    return res.status(result.status).json({ error: result.error });
  }
  res.status(201).json(result.order);
};

exports.list = (req, res) => {
  let orders = db.orders;
  if (req.query.status) {
    orders = orders.filter((o) => o.status === req.query.status.toUpperCase());
  }
  if (req.query.customerId) {
    orders = orders.filter((o) => o.customerId === Number(req.query.customerId));
  }
  res.json(orders);
};

exports.listByCustomer = (req, res) => {
  const customer = db.customers.find((c) => c.id === Number(req.params.id));
  if (!customer) {
    return res.status(404).json({ error: 'Cliente não encontrado' });
  }
  let orders = db.orders.filter((o) => o.customerId === customer.id);
  if (req.query.status) {
    orders = orders.filter((o) => o.status === req.query.status.toUpperCase());
  }
  res.json(orders);
};

exports.get = (req, res) => {
  const order = orderRepository.getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
  res.json(order);
};

exports.addItem = (req, res) => {
  orderService.addItem(req, res);
};

exports.applyCoupon = (req, res) => {
  try {
    const order = orderService.applyCoupon(req.params.id, (req.body || {}).code);
    res.json(order);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
};

exports.updateStatus = (req, res) => {
  const order = orderRepository.getOrder(req.params.id);
  if (order) {
    const newStatus = (req.body || {}).status;
    if (newStatus) {
      let isValidTransition = false;
      if (order.status === 'PAID') {
        if (newStatus === 'PREPARING') isValidTransition = true;
      } else if (order.status === 'PREPARING') {
        if (newStatus === 'READY') isValidTransition = true;
      } else if (order.status === 'READY') {
        if (order.deliveryType === 'delivery') {
          if (newStatus === 'OUT_FOR_DELIVERY') isValidTransition = true;
        } else {
          if (newStatus === 'DELIVERED') isValidTransition = true;
        }
      } else if (order.status === 'OUT_FOR_DELIVERY') {
        if (newStatus === 'DELIVERED') isValidTransition = true;
      }

      if (isValidTransition) {
        order.status = newStatus;
        order.history.push({ status: newStatus, at: new Date().toISOString() });
        if (newStatus === 'DELIVERED') {
          order.deliveredAt = new Date().toISOString();
        }
        res.json(order);
      } else {
        res
          .status(400)
          .json({ error: 'Transição de status inválida: ' + order.status + ' -> ' + newStatus });
      }
    } else {
      res.status(400).json({ error: 'Status é obrigatório' });
    }
  } else {
    res.status(404).json({ error: 'Pedido não encontrado' });
  }
};

exports.cancel = (req, res) => {
  const order = orderRepository.getOrder(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Pedido não encontrado' });
  }
  const reason = (req.body || {}).reason;

  let refund;
  if (order.status === 'CREATED') {
    refund = 0;
  } else if (order.status === 'PAID') {
    refund = order.payment.total;
  } else if (order.status === 'PREPARING') {
    refund = order.payment.total * 0.5;
  } else {
    return res.status(400).json({ message: 'Pedido não pode mais ser cancelado' });
  }

  if (!reason && order.status !== 'CREATED') {
    return res.status(400).json({ message: 'Informe o motivo do cancelamento' });
  }

  // devolve os itens para o estoque
  for (const item of order.items) {
    const product = db.products.find((p) => p.id === item.productId);
    product.stock = product.stock + item.quantity;
  }

  if (order.status !== 'CREATED') {
    const customer = db.customers.find((c) => c.id === order.customerId);
    customer.points = customer.points - order.payment.points;
    if (customer.points < 0) customer.points = 0;
    const payment = db.payments.find((storedPayment) => storedPayment.orderId === order.id);
    payment.refunded = Math.round(refund * 100) / 100;
  }

  order.status = 'CANCELLED';
  order.refund = Math.round(refund * 100) / 100;
  order.cancelReason = reason || null;
  order.history.push({ status: 'CANCELLED', at: new Date().toISOString() });

  res.json(order);
};
