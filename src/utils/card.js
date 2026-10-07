const { CARD } = require('../constants/businessRules');

function onlyDigits(cardNumber) {
  return cardNumber.replace(/\s/g, '');
}

function isValidCard(cardNumber) {
  if (typeof cardNumber !== 'string') return false;
  const digits = onlyDigits(cardNumber);
  return digits.length === CARD.NUMBER_LENGTH && /^\d+$/.test(digits);
}

function maskCard(cardNumber) {
  return '**** **** **** ' + onlyDigits(cardNumber).slice(-CARD.VISIBLE_DIGITS);
}

module.exports = { isValidCard, maskCard };
