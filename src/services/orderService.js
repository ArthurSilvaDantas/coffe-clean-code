const { db } = require('../data/db');
const helpers = require('../utils/helpers');
const productRepository = require('../repositories/productRepository');
const orderRepository = require('../repositories/orderRepository');
const { DISCOUNT, COUPON, DELIVERY, ORDER_LIMITS } = require('../constants/businessRules');
const { ORDER_STATUS, CUSTOMER_TYPE, DELIVERY_TYPE, COUPON_CODE } = require('../constants/domain');

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
  const customer = db.customers.find((c) => c.id === order.customerId);
  const discount = calculateDiscount(order, customer, subtotal);
  const deliveryFee = calculateDeliveryFee(order, customer, subtotal);

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
  if (
    orderRepository.countOpenByCustomer(customer.id) >= ORDER_LIMITS.MAX_OPEN_ORDERS_PER_CUSTOMER
  ) {
    return { error: 'Cliente possui muitos pedidos em aberto', status: 409 };
  }

  const selectedDeliveryType = deliveryType || DELIVERY_TYPE.PICKUP;
  if (
    selectedDeliveryType !== DELIVERY_TYPE.PICKUP &&
    selectedDeliveryType !== DELIVERY_TYPE.DELIVERY
  ) {
    return { error: 'Tipo de entrega inválido', status: 400 };
  }
  if (selectedDeliveryType === DELIVERY_TYPE.DELIVERY) {
    if (!address) {
      return { error: 'Endereço é obrigatório para entrega', status: 400 };
    }
    if (distance === undefined || distance <= 0) {
      return { error: 'Distância inválida', status: 400 };
    } else if (distance > DELIVERY.MAX_DISTANCE_KM) {
      return { error: 'Endereço fora da área de entrega', status: 400 };
    }
  }

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

  if (items && items.length) {
    for (const requestedItem of items) {
      const product = productRepository.findById(requestedItem.productId);
      if (!product || !product.active) {
        return { error: 'Produto ' + requestedItem.productId + ' não encontrado', status: 404 };
      }
      if (
        !requestedItem.quantity ||
        requestedItem.quantity <= 0 ||
        requestedItem.quantity > ORDER_LIMITS.MAX_QUANTITY_PER_PRODUCT
      ) {
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
  if (order.status !== ORDER_STATUS.CREATED) {
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
  if (totalQuantity > ORDER_LIMITS.MAX_QUANTITY_PER_PRODUCT) {
    return res
      .status(400)
      .json({ error: `Máximo de ${ORDER_LIMITS.MAX_QUANTITY_PER_PRODUCT} unidades por produto` });
  }
  if (product.stock < quantity) {
    return res.status(409).json({ error: 'Estoque insuficiente para ' + product.name });
  }
  if (!existingItem && order.items.length >= ORDER_LIMITS.MAX_DISTINCT_ITEMS) {
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
  if (order.status !== ORDER_STATUS.CREATED) {
    const err = new Error('Cupom só pode ser aplicado em pedidos abertos');
    err.status = 400;
    throw err;
  }

  const couponCode = (code || '').toUpperCase().trim();
  const validCoupons = [COUPON_CODE.CAFE10, COUPON_CODE.BEMVINDO, COUPON_CODE.FRETEGRATIS];
  if (validCoupons.indexOf(couponCode) === -1) {
    const err = new Error('Cupom inválido');
    err.status = 400;
    throw err;
  }
  if (couponCode === COUPON_CODE.BEMVINDO && orderRepository.hasPaidOrders(order.customerId)) {
    const err = new Error('Cupom válido apenas para a primeira compra');
    err.status = 400;
    throw err;
  }
  if (couponCode === COUPON_CODE.FRETEGRATIS && order.deliveryType !== DELIVERY_TYPE.DELIVERY) {
    const err = new Error('Cupom válido apenas para pedidos com entrega');
    err.status = 400;
    throw err;
  }

  order.coupon = couponCode;
  return calculateTotals(order);
}

module.exports = { calculateTotals, createOrder, addItem, applyCoupon };
