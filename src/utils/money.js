function roundToCents(value) {
  return Math.round(value * 100) / 100;
}

function formatCurrency(value) {
  return 'R$ ' + value.toFixed(2).replace('.', ',');
}

module.exports = { roundToCents, formatCurrency };
