// Funções auxiliares

function roundToCents(value) {
  return Math.round(value * 100) / 100;
}

// calcula
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
  return digits.length === 16 && /^\d+$/.test(digits);
}

function maskCard(cardNumber) {
  return '**** **** **** ' + cardNumber.replace(/\s/g, '').slice(-4);
}

function isPremium(customer) {
  return customer.type === 'premium';
}

function now() {
  return new Date().toISOString();
}

function fail(res, status, message) {
  return res.status(status).json({ error: message });
}

module.exports = { roundToCents, calculateSubtotal, isValidCard, maskCard, isPremium, now, fail };
