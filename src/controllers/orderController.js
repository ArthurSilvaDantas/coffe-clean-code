const { db } = require('../data/db');
const orderService = require('../services/orderService');
const orderRepository = require('../repositories/orderRepository');
const helpers = require('../utils/helpers');
const { CANCELLATION } = require('../constants/businessRules');
const { ORDER_STATUS, DELIVERY_TYPE } = require('../constants/domain');

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
  const order = orderRepository.findById(req.params.id);
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
  const order = orderRepository.findById(req.params.id);
  if (order) {
    const newStatus = (req.body || {}).status;
    if (newStatus) {
      let isValidTransition = false;
      if (order.status === ORDER_STATUS.PAID) {
        if (newStatus === ORDER_STATUS.PREPARING) isValidTransition = true;
      } else if (order.status === ORDER_STATUS.PREPARING) {
        if (newStatus === ORDER_STATUS.READY) isValidTransition = true;
      } else if (order.status === ORDER_STATUS.READY) {
        if (order.deliveryType === DELIVERY_TYPE.DELIVERY) {
          if (newStatus === ORDER_STATUS.OUT_FOR_DELIVERY) isValidTransition = true;
        } else {
          if (newStatus === ORDER_STATUS.DELIVERED) isValidTransition = true;
        }
      } else if (order.status === ORDER_STATUS.OUT_FOR_DELIVERY) {
        if (newStatus === ORDER_STATUS.DELIVERED) isValidTransition = true;
      }

      if (isValidTransition) {
        order.status = newStatus;
        order.history.push({ status: newStatus, at: new Date().toISOString() });
        if (newStatus === ORDER_STATUS.DELIVERED) {
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
  const order = orderRepository.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Pedido não encontrado' });
  }
  const reason = (req.body || {}).reason;

  let refund;
  if (order.status === ORDER_STATUS.CREATED) {
    refund = 0;
  } else if (order.status === ORDER_STATUS.PAID) {
    refund = order.payment.total;
  } else if (order.status === ORDER_STATUS.PREPARING) {
    refund = order.payment.total * CANCELLATION.PREPARING_REFUND_RATE;
  } else {
    return res.status(400).json({ message: 'Pedido não pode mais ser cancelado' });
  }

  if (!reason && order.status !== ORDER_STATUS.CREATED) {
    return res.status(400).json({ message: 'Informe o motivo do cancelamento' });
  }

  // devolve os itens para o estoque
  for (const item of order.items) {
    const product = db.products.find((p) => p.id === item.productId);
    product.stock = product.stock + item.quantity;
  }

  if (order.status !== ORDER_STATUS.CREATED) {
    const customer = db.customers.find((c) => c.id === order.customerId);
    customer.points = customer.points - order.payment.points;
    if (customer.points < 0) customer.points = 0;
    const payment = db.payments.find((storedPayment) => storedPayment.orderId === order.id);
    payment.refunded = helpers.roundToCents(refund);
  }

  order.status = ORDER_STATUS.CANCELLED;
  order.refund = helpers.roundToCents(refund);
  order.cancelReason = reason || null;
  order.history.push({ status: ORDER_STATUS.CANCELLED, at: new Date().toISOString() });

  res.json(order);
};
