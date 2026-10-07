const productRepository = require('../repositories/productRepository');
const { PRODUCT_RULES } = require('../constants/businessRules');
const { PRODUCT_CATEGORY } = require('../constants/domain');
const { badRequest, notFound } = require('../errors/AppError');

function isValidStock(stock) {
  return typeof stock === 'number' && stock >= 0 && stock <= PRODUCT_RULES.MAX_STOCK;
}

function createProduct({ name, price, stock, category }) {
  if (!name || name.trim() === '') {
    throw badRequest('Nome é obrigatório');
  }
  if (typeof price !== 'number' || price <= 0) {
    throw badRequest('Preço inválido');
  }
  if (price > PRODUCT_RULES.MAX_PRICE) {
    throw badRequest('Preço acima do permitido');
  }

  const initialStock = stock === undefined ? 0 : stock;
  if (!isValidStock(initialStock)) {
    throw badRequest('Estoque inválido');
  }

  const selectedCategory = category || PRODUCT_CATEGORY.COFFEE;
  if (!Object.values(PRODUCT_CATEGORY).includes(selectedCategory)) {
    throw badRequest('Categoria inválida');
  }

  return productRepository.save({
    name: name.trim(),
    price,
    stock: initialStock,
    category: selectedCategory,
    active: true,
  });
}

function listProducts({ category, onlyAvailable }) {
  let products = productRepository.findAll().filter((p) => p.active);
  if (category) {
    products = products.filter((p) => p.category === category);
  }
  if (onlyAvailable) {
    products = products.filter((p) => p.stock > 0);
  }
  return products;
}

function adjustStock(productId, stockChange) {
  const product = productRepository.findById(productId);
  if (!product) {
    throw notFound('Produto não encontrado');
  }
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
  return product;
}

module.exports = { createProduct, listProducts, adjustStock };
