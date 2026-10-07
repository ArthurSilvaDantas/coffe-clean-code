const { CARD } = require('../constants/businessRules');
const { CUSTOMER_TYPE } = require('../constants/domain');

function roundToCents(value) {
  return Math.round(value * 100) / 100;
}

function calculateSubtotal(items) {
  let subtotal = 0;
  for (let i = 0; i < items.length; i++) {
    subtotal = subtotal + items[i].price * items[i].quantity;
  }
  return roundToCents(subtotal);
}

function isValidCard(cardNumber) {
  if (typeof cardNumber !== 'string') return false;
  const digits = cardNumber.replace(/\s/g, '');
  return digits.length === CARD.NUMBER_LENGTH && /^\d+$/.test(digits);
}

function maskCard(cardNumber) {
  return '**** **** **** ' + cardNumber.replace(/\s/g, '').slice(-CARD.VISIBLE_DIGITS);
}

function formatCurrency(value) {
  return 'R$ ' + value.toFixed(2).replace('.', ',');
}

function isPremium(customer) {
  return customer.type === CUSTOMER_TYPE.PREMIUM;
}

function now() {
  return new Date().toISOString();
}

function fail(res, status, message) {
  return res.status(status).json({ error: message });
}

module.exports = {
  roundToCents,
  calculateSubtotal,
  isValidCard,
  maskCard,
  formatCurrency,
  isPremium,
  now,
  fail,
};
