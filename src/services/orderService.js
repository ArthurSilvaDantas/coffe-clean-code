const helpers = require('../utils/helpers');
const productRepository = require('../repositories/productRepository');
const orderRepository = require('../repositories/orderRepository');
const customerRepository = require('../repositories/customerRepository');
const { DISCOUNT, COUPON, DELIVERY, ORDER_LIMITS } = require('../constants/businessRules');
const { ORDER_STATUS, CUSTOMER_TYPE, DELIVERY_TYPE, COUPON_CODE } = require('../constants/domain');
const { badRequest, conflict, notFound } = require('../errors/AppError');

function calculateCustomerDiscount(customer, subtotal) {
  if (customer.type === CUSTOMER_TYPE.PREMIUM) {
    return subtotal * DISCOUNT.PREMIUM_RATE;
  }
  if (subtotal >= DISCOUNT.REGULAR_MIN_SUBTOTAL) {
    return subtotal * DISCOUNT.REGULAR_RATE;
  }
  return 0;
}

function calculateCouponDiscount(coupon, subtotal) {
  if (coupon === COUPON_CODE.CAFE10) {
    return subtotal * COUPON.CAFE10_DISCOUNT_RATE;
  }
  if (coupon === COUPON_CODE.BEMVINDO) {
    return COUPON.BEMVINDO_FIXED_DISCOUNT;
  }
  return 0;
}

function calculateDiscount(order, customer, subtotal) {
  const discount =
    calculateCustomerDiscount(customer, subtotal) + calculateCouponDiscount(order.coupon, subtotal);
  return Math.min(discount, subtotal * DISCOUNT.MAX_RATE);
}

function calculateDeliveryFee(order, customer, subtotal) {
  if (order.deliveryType !== DELIVERY_TYPE.DELIVERY) {
    return 0;
  }

  const hasFreeDelivery =
    customer.type === CUSTOMER_TYPE.PREMIUM ||
    subtotal >= DELIVERY.FREE_DELIVERY_MIN_SUBTOTAL ||
    order.coupon === COUPON_CODE.FRETEGRATIS;
  if (hasFreeDelivery) {
    return 0;
  }

  const extraDistance = Math.max(order.distance - DELIVERY.INCLUDED_DISTANCE_KM, 0);
  return DELIVERY.BASE_FEE + extraDistance * DELIVERY.FEE_PER_EXTRA_KM;
}

function calculateTotals(order) {
  const subtotal = helpers.calculateSubtotal(order.items);
  const customer = customerRepository.findById(order.customerId);
  const discount = calculateDiscount(order, customer, subtotal);
  const deliveryFee = calculateDeliveryFee(order, customer, subtotal);

  order.subtotal = helpers.roundToCents(subtotal);
  order.discount = helpers.roundToCents(discount);
  order.deliveryFee = helpers.roundToCents(deliveryFee);
  order.total = helpers.roundToCents(subtotal - discount + deliveryFee);
  return order;
}

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

function createOrder(customerId, deliveryType, distance, address, notes, items) {
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

function addItem(req, res) {
  const order = orderRepository.findById(req.params.id);
  if (!order) throw notFound('Pedido não encontrado');
  if (order.status !== ORDER_STATUS.CREATED) {
    throw badRequest('Pedido não pode mais ser alterado');
  }

  const productId = req.body.productId;
  const quantity = req.body.quantity;
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
    throw notFound('Pedido não encontrado');
  }
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

module.exports = { calculateTotals, createOrder, addItem, applyCoupon };
