const productService = require('../services/productService');

exports.create = (req, res) => {
  const product = productService.createProduct(req.body || {});
  res.status(201).json(product);
};

exports.list = (req, res) => {
  const products = productService.listProducts({
    category: req.query.category,
    onlyAvailable: req.query.available === 'true',
  });
  res.json(products);
};

exports.updateStock = (req, res) => {
  const product = productService.adjustStock(req.params.id, (req.body || {}).quantity);
  res.json(product);
};
