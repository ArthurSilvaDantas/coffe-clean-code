const { db } = require('../data/db');
const productRepository = require('../repositories/productRepository');

exports.create = (req, res) => {
  const { name, price, stock, category } = req.body || {};
  if (!name || name.trim() == '') return res.status(400).json({ error: 'Nome é obrigatório' });
  if (price == undefined || typeof price !== 'number' || price <= 0) {
    return res.status(400).json({ error: 'Preço inválido' });
  }
  if (price > 500) return res.status(400).json({ error: 'Preço acima do permitido' });

  let s = stock;
  if (s === undefined) s = 0;
  if (typeof s !== 'number' || s < 0 || s > 200) {
    return res.status(400).json({ message: 'Estoque inválido' });
  }

  const cat = category || 'coffee';
  if (cat != 'coffee' && cat != 'food' && cat != 'drink') {
    return res.status(400).json({ message: 'Categoria inválida' });
  }

  const p = productRepository.addProduct({
    name: name.trim(),
    price,
    stock: s,
    category: cat,
    active: true,
  });
  res.status(201).json(p);
};

exports.list = (req, res) => {
  let result = db.products.filter((p) => p.active);
  if (req.query.category) {
    result = result.filter((p) => p.category == req.query.category);
  }
  if (req.query.available == 'true') {
    result = result.filter((p) => p.stock > 0);
  }
  res.json(result);
};

exports.updateStock = (req, res) => {
  const p = db.products.find((x) => x.id == req.params.id);
  if (!p) return res.status(404).json({ error: 'Produto não encontrado' });

  const val = (req.body || {}).quantity;
  if (typeof val !== 'number') return res.status(400).json({ error: 'Quantidade inválida' });
  if (p.stock + val < 0) return res.status(400).json({ error: 'Estoque não pode ficar negativo' });
  if (p.stock + val > 200) return res.status(400).json({ error: 'Estoque máximo excedido' });

  p.stock = p.stock + val;
  res.json(p);
};
