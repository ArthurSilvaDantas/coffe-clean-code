const paymentService = require('../services/paymentService');
const { badRequest } = require('../errors/AppError');

module.exports.pay = function (req, res) {
  const body = req.body || {};
  if (!body.method) {
    throw badRequest('Informe a forma de pagamento');
  }
  const order = paymentService.payOrder(req.params.id, body);
  res.json(order);
};
