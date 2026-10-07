const { db } = require('../data/db');
const productRepository = require('../repositories/productRepository');
const { PRODUCT_RULES } = require('../constants/businessRules');

exports.create = (req, res) => {
  const { name, price, stock, category } = req.body || {};
  if (!name || name.trim() === '') return res.status(400).json({ error: 'Nome é obrigatório' });
  if (price === undefined || typeof price !== 'number' || price <= 0) {
    return res.status(400).json({ error: 'Preço inválido' });
  }
  if (price > PRODUCT_RULES.MAX_PRICE) {
    return res.status(400).json({ error: 'Preço acima do permitido' });
  }

  let initialStock = stock;
  if (initialStock === undefined) initialStock = 0;
  if (
    typeof initialStock !== 'number' ||
    initialStock < 0 ||
    initialStock > PRODUCT_RULES.MAX_STOCK
  ) {
    return res.status(400).json({ message: 'Estoque inválido' });
  }

  const selectedCategory = category || 'coffee';
  if (
    selectedCategory !== 'coffee' &&
    selectedCategory !== 'food' &&
    selectedCategory !== 'drink'
  ) {
    return res.status(400).json({ message: 'Categoria inválida' });
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
  let products = db.products.filter((p) => p.active);
  if (req.query.category) {
    products = products.filter((p) => p.category === req.query.category);
  }
  if (req.query.available === 'true') {
    products = products.filter((p) => p.stock > 0);
  }
  res.json(products);
};

exports.updateStock = (req, res) => {
  const product = db.products.find((p) => p.id === Number(req.params.id));
  if (!product) return res.status(404).json({ error: 'Produto não encontrado' });

  const stockChange = (req.body || {}).quantity;
  if (typeof stockChange !== 'number') {
    return res.status(400).json({ error: 'Quantidade inválida' });
  }
  if (product.stock + stockChange < 0) {
    return res.status(400).json({ error: 'Estoque não pode ficar negativo' });
  }
  if (product.stock + stockChange > PRODUCT_RULES.MAX_STOCK) {
    return res.status(400).json({ error: 'Estoque máximo excedido' });
  }

  product.stock = product.stock + stockChange;
  res.json(product);
};
