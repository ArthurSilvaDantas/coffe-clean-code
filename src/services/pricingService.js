const { roundToCents } = require('../utils/money');
const customerRepository = require('../repositories/customerRepository');
const { DISCOUNT, COUPON, DELIVERY } = require('../constants/businessRules');
const { CUSTOMER_TYPE, DELIVERY_TYPE, COUPON_CODE } = require('../constants/domain');

function calculateSubtotal(items) {
  return roundToCents(items.reduce((subtotal, item) => subtotal + item.price * item.quantity, 0));
}

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
  const subtotal = calculateSubtotal(order.items);
  const customer = customerRepository.findById(order.customerId);
  const discount = calculateDiscount(order, customer, subtotal);
  const deliveryFee = calculateDeliveryFee(order, customer, subtotal);

  order.subtotal = roundToCents(subtotal);
  order.discount = roundToCents(discount);
  order.deliveryFee = roundToCents(deliveryFee);
  order.total = roundToCents(subtotal - discount + deliveryFee);
  return order;
}

module.exports = { calculateTotals };
