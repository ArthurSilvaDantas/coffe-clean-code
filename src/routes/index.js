const express = require('express');
const customerController = require('../controllers/customerController');
const productController = require('../controllers/productController');
const orderController = require('../controllers/orderController');
const paymentController = require('../controllers/paymentController');

const router = express.Router();

router.post('/customers', customerController.create);
router.get('/customers', customerController.list);
router.get('/customers/:id', customerController.get);
router.get('/customers/:id/orders', orderController.listByCustomer);

router.post('/products', productController.create);
router.get('/products', productController.list);
router.patch('/products/:id/stock', productController.updateStock);

router.post('/orders', orderController.create);
router.get('/orders', orderController.list);
router.get('/orders/:id', orderController.get);
router.post('/orders/:id/items', orderController.addItem);
router.post('/orders/:id/coupon', orderController.applyCoupon);
router.post('/orders/:id/pay', paymentController.pay);
router.patch('/orders/:id/status', orderController.updateStatus);
router.post('/orders/:id/cancel', orderController.cancel);

module.exports = router;
