// Funções auxiliares

function round(n) {
  return Math.round(n * 100) / 100;
}

// calcula
function calc(list) {
  let t = 0;
  for (let i = 0; i < list.length; i++) {
    t = t + list[i].value * list[i].qty;
  }
  return round(t);
}

function isValidCard(n) {
  if (typeof n !== 'string') return false;
  const digits = n.replace(/\s/g, '');
  return digits.length === 16 && /^\d+$/.test(digits);
}

function maskCard(n) {
  return '**** **** **** ' + n.replace(/\s/g, '').slice(-4);
}

function isPremium(client) {
  return client.type === 'premium';
}

function now() {
  return new Date().toISOString();
}

function fail(res, code, msg) {
  return res.status(code).json({ error: msg });
}

module.exports = { round, calc, isValidCard, maskCard, isPremium, now, fail };
