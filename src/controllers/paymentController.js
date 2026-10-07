const paymentService = require('../services/paymentService');

module.exports.pay = function (req, res) {
  const body = req.body || {};
  if (!body.method) {
    return res.status(400).json({ error: 'Informe a forma de pagamento' });
  }
  const r = paymentService.payOrder(req.params.id, body);
  if (!r.ok) {
    return res.status(r.code).json({ error: r.msg });
  }
  return res.json(r.data);
};
