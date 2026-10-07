const helpers = require('../utils/helpers');
const productRepository = require('../repositories/productRepository');
const orderRepository = require('../repositories/orderRepository');
const customerRepository = require('../repositories/customerRepository');
const { calculateTotals } = require('./pricingService');
const { DELIVERY, ORDER_LIMITS } = require('../constants/businessRules');
const { ORDER_STATUS, DELIVERY_TYPE, COUPON_CODE } = require('../constants/domain');
const { badRequest, conflict, notFound } = require('../errors/AppError');

function validateDelivery(deliveryType, address, distance) {
  if (deliveryType !== DELIVERY_TYPE.PICKUP && deliveryType !== DELIVERY_TYPE.DELIVERY) {
    throw badRequest('Tipo de entrega inválido');
  }
  if (deliveryType === DELIVERY_TYPE.PICKUP) {
    return;
  }
  if (!address) {
    throw badRequest('Endereço é obrigatório para entrega');
  }
  if (distance === undefined || distance <= 0) {
    throw badRequest('Distância inválida');
  }
  if (distance > DELIVERY.MAX_DISTANCE_KM) {
    throw badRequest('Endereço fora da área de entrega');
  }
}

function isValidItemQuantity(quantity) {
  return quantity > 0 && quantity <= ORDER_LIMITS.MAX_QUANTITY_PER_PRODUCT;
}

function validateRequestedItems(requestedItems) {
  for (const requestedItem of requestedItems) {
    const product = productRepository.findById(requestedItem.productId);
    if (!product || !product.active) {
      throw notFound('Produto ' + requestedItem.productId + ' não encontrado');
    }
    if (!isValidItemQuantity(requestedItem.quantity)) {
      throw badRequest('Quantidade inválida para o produto ' + product.name);
    }
    if (product.stock < requestedItem.quantity) {
      throw conflict('Estoque insuficiente para ' + product.name);
    }
  }
}

function addRequestedItems(order, requestedItems) {
  for (const requestedItem of requestedItems) {
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

function createOrder({ customerId, deliveryType, distance, address, notes, items }) {
  if (!customerId) {
    throw badRequest('customerId é obrigatório');
  }
  const customer = customerRepository.findById(customerId);
  if (!customer) {
    throw notFound('Cliente não encontrado');
  }
  if (
    orderRepository.countOpenByCustomer(customer.id) >= ORDER_LIMITS.MAX_OPEN_ORDERS_PER_CUSTOMER
  ) {
    throw conflict('Cliente possui muitos pedidos em aberto');
  }

  const selectedDeliveryType = deliveryType || DELIVERY_TYPE.PICKUP;
  validateDelivery(selectedDeliveryType, address, distance);

  const requestedItems = items && items.length ? items : [];
  validateRequestedItems(requestedItems);

  const order = {
    customerId: customer.id,
    items: [],
    deliveryType: selectedDeliveryType,
    distance: selectedDeliveryType === DELIVERY_TYPE.DELIVERY ? distance : 0,
    address: address || null,
    notes: notes || '',
    coupon: null,
    status: ORDER_STATUS.CREATED,
    createdAt: helpers.now(),
    history: [{ status: ORDER_STATUS.CREATED, at: helpers.now() }],
  };

  addRequestedItems(order, requestedItems);
  calculateTotals(order);
  return orderRepository.save(order);
}

function getOrder(orderId) {
  const order = orderRepository.findById(orderId);
  if (!order) {
    throw notFound('Pedido não encontrado');
  }
  return order;
}

function filterByStatus(orders, status) {
  return status ? orders.filter((o) => o.status === status.toUpperCase()) : orders;
}

function listOrders({ status, customerId }) {
  let orders = filterByStatus(orderRepository.findAll(), status);
  if (customerId) {
    orders = orders.filter((o) => o.customerId === Number(customerId));
  }
  return orders;
}

function listCustomerOrders(customerId, { status }) {
  const customer = customerRepository.findById(customerId);
  if (!customer) {
    throw notFound('Cliente não encontrado');
  }
  return filterByStatus(orderRepository.findByCustomerId(customer.id), status);
}

function addItem(orderId, { productId, quantity }) {
  const order = getOrder(orderId);
  if (order.status !== ORDER_STATUS.CREATED) {
    throw badRequest('Pedido não pode mais ser alterado');
  }

  if (!productId) throw badRequest('productId é obrigatório');
  if (!quantity || quantity <= 0) throw badRequest('Quantidade inválida');

  const product = productRepository.findById(productId);
  if (!product || !product.active) throw notFound('Produto não encontrado');

  const existingItem = order.items.find((item) => item.productId === product.id);
  const totalQuantity = existingItem ? existingItem.quantity + quantity : quantity;
  if (totalQuantity > ORDER_LIMITS.MAX_QUANTITY_PER_PRODUCT) {
    throw badRequest(`Máximo de ${ORDER_LIMITS.MAX_QUANTITY_PER_PRODUCT} unidades por produto`);
  }
  if (product.stock < quantity) {
    throw conflict('Estoque insuficiente para ' + product.name);
  }
  if (!existingItem && order.items.length >= ORDER_LIMITS.MAX_DISTINCT_ITEMS) {
    throw badRequest('Limite de itens atingido');
  }

  productRepository.decreaseStock(product.id, quantity);

  if (existingItem) {
    existingItem.quantity = totalQuantity;
  } else {
    order.items.push({ productId: product.id, name: product.name, price: product.price, quantity });
  }

  return calculateTotals(order);
}

function applyCoupon(orderId, code) {
  const order = getOrder(orderId);
  if (order.status !== ORDER_STATUS.CREATED) {
    throw badRequest('Cupom só pode ser aplicado em pedidos abertos');
  }

  const couponCode = (code || '').toUpperCase().trim();
  const validCoupons = [COUPON_CODE.CAFE10, COUPON_CODE.BEMVINDO, COUPON_CODE.FRETEGRATIS];
  if (validCoupons.indexOf(couponCode) === -1) {
    throw badRequest('Cupom inválido');
  }
  if (couponCode === COUPON_CODE.BEMVINDO && orderRepository.hasPaidOrders(order.customerId)) {
    throw badRequest('Cupom válido apenas para a primeira compra');
  }
  if (couponCode === COUPON_CODE.FRETEGRATIS && order.deliveryType !== DELIVERY_TYPE.DELIVERY) {
    throw badRequest('Cupom válido apenas para pedidos com entrega');
  }

  order.coupon = couponCode;
  return calculateTotals(order);
}

module.exports = {
  createOrder,
  getOrder,
  listOrders,
  listCustomerOrders,
  addItem,
  applyCoupon,
};
