const paymentService = require('../services/paymentService');

module.exports.pay = function (req, res) {
  const body = req.body || {};
  if (!body.method) {
    return res.status(400).json({ error: 'Informe a forma de pagamento' });
  }
  const result = paymentService.payOrder(req.params.id, body);
  if (!result.ok) {
    return res.status(result.status).json({ error: result.message });
  }
  return res.json(result.order);
};
