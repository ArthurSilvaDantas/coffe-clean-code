const ORDER_STATUS = Object.freeze({
  CREATED: 'CREATED',
  PAID: 'PAID',
  PREPARING: 'PREPARING',
  READY: 'READY',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
});

const CUSTOMER_TYPE = Object.freeze({
  REGULAR: 'regular',
  PREMIUM: 'premium',
});

const DELIVERY_TYPE = Object.freeze({
  PICKUP: 'pickup',
  DELIVERY: 'delivery',
});

const PAYMENT_METHOD = Object.freeze({
  PIX: 'pix',
  CREDIT_CARD: 'credit_card',
  DEBIT_CARD: 'debit_card',
  CASH: 'cash',
});

const COUPON_CODE = Object.freeze({
  CAFE10: 'CAFE10',
  BEMVINDO: 'BEMVINDO',
  FRETEGRATIS: 'FRETEGRATIS',
});

const PRODUCT_CATEGORY = Object.freeze({
  COFFEE: 'coffee',
  FOOD: 'food',
  DRINK: 'drink',
});

module.exports = {
  ORDER_STATUS,
  CUSTOMER_TYPE,
  DELIVERY_TYPE,
  PAYMENT_METHOD,
  COUPON_CODE,
  PRODUCT_CATEGORY,
};
