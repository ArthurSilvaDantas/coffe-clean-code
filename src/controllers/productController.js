const productRepository = require('../repositories/productRepository');
const { PRODUCT_RULES } = require('../constants/businessRules');
const { PRODUCT_CATEGORY } = require('../constants/domain');
const { badRequest, notFound } = require('../errors/AppError');

exports.create = (req, res) => {
  const { name, price, stock, category } = req.body || {};
  if (!name || name.trim() === '') throw badRequest('Nome é obrigatório');
  if (typeof price !== 'number' || price <= 0) {
    throw badRequest('Preço inválido');
  }
  if (price > PRODUCT_RULES.MAX_PRICE) {
    throw badRequest('Preço acima do permitido');
  }

  const initialStock = stock === undefined ? 0 : stock;
  if (
    typeof initialStock !== 'number' ||
    initialStock < 0 ||
    initialStock > PRODUCT_RULES.MAX_STOCK
  ) {
    throw badRequest('Estoque inválido');
  }

  const selectedCategory = category || PRODUCT_CATEGORY.COFFEE;
  if (
    selectedCategory !== PRODUCT_CATEGORY.COFFEE &&
    selectedCategory !== PRODUCT_CATEGORY.FOOD &&
    selectedCategory !== PRODUCT_CATEGORY.DRINK
  ) {
    throw badRequest('Categoria inválida');
  }

  const product = productRepository.save({
    name: name.trim(),
    price,
    stock: initialStock,
    category: selectedCategory,
    active: true,
  });
  res.status(201).json(product);
};

exports.list = (req, res) => {
  let products = productRepository.findAll().filter((p) => p.active);
  if (req.query.category) {
    products = products.filter((p) => p.category === req.query.category);
  }
  if (req.query.available === 'true') {
    products = products.filter((p) => p.stock > 0);
  }
  res.json(products);
};

exports.updateStock = (req, res) => {
  const product = productRepository.findById(req.params.id);
  if (!product) throw notFound('Produto não encontrado');

  const stockChange = (req.body || {}).quantity;
  if (typeof stockChange !== 'number') {
    throw badRequest('Quantidade inválida');
  }
  if (product.stock + stockChange < 0) {
    throw badRequest('Estoque não pode ficar negativo');
  }
  if (product.stock + stockChange > PRODUCT_RULES.MAX_STOCK) {
    throw badRequest('Estoque máximo excedido');
  }

  product.stock = product.stock + stockChange;
  res.json(product);
};
