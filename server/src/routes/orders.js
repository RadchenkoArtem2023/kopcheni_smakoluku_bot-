import { Router } from 'express';
import db from '../db.js';
import {
  ORDER_STATUSES,
  sendTelegramMessage,
  formatOrderConfirmation,
  notifyAdmins,
} from '../telegram.js';

const router = Router();

router.get('/statuses', (_req, res) => {
  res.json(ORDER_STATUSES);
});

router.get('/', (_req, res) => {
  const orders = db
    .prepare('SELECT * FROM orders ORDER BY created_at DESC')
    .all();

  const getItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?');

  const result = orders.map((order) => ({
    ...order,
    items: getItems.all(order.id),
  }));

  res.json(result);
});

router.get('/my', (req, res) => {
  const orders = db
    .prepare('SELECT * FROM orders WHERE telegram_user_id = ? ORDER BY created_at DESC')
    .all(String(req.telegramUser.id));

  const getItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?');

  const result = orders.map((order) => ({
    ...order,
    items: getItems.all(order.id),
  }));

  res.json(result);
});

router.post('/', (req, res) => {
  const { first_name, last_name, phone, address, items } = req.body;

  if (!first_name?.trim() || !last_name?.trim() || !phone?.trim() || !address?.trim()) {
    return res.status(400).json({ error: 'Заповніть усі контактні дані' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Додайте хоча б одну позицію' });
  }

  const getProduct = db.prepare(`
    SELECT * FROM products
    WHERE id = ? AND is_active = 1 AND is_stop_listed = 0
  `);

  const orderItems = [];
  let total = 0;

  for (const item of items) {
    const product = getProduct.get(item.product_id);
    if (!product) {
      return res.status(400).json({ error: `Позиція ${item.product_id} недоступна` });
    }

    const grams = Math.max(50, Math.round(Number(item.grams) || 0));
    if (grams < 50) {
      return res.status(400).json({ error: 'Мінімальна кількість — 50 г' });
    }

    const subtotal = (product.price_per_100g * grams) / 100;
    total += subtotal;

    orderItems.push({
      product_id: product.id,
      product_name: product.name,
      grams,
      price_per_100g: product.price_per_100g,
      subtotal,
    });
  }

  const createOrder = db.transaction(() => {
    const orderResult = db
      .prepare(`
        INSERT INTO orders (telegram_user_id, first_name, last_name, phone, address, total)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(
        String(req.telegramUser.id),
        first_name.trim(),
        last_name.trim(),
        phone.trim(),
        address.trim(),
        total
      );

    const orderId = orderResult.lastInsertRowid;
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, grams, price_per_100g, subtotal)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const item of orderItems) {
      insertItem.run(
        orderId,
        item.product_id,
        item.product_name,
        item.grams,
        item.price_per_100g,
        item.subtotal
      );
    }

    return {
      id: orderId,
      telegram_user_id: String(req.telegramUser.id),
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      status: 'new',
      total,
      created_at: new Date().toISOString(),
    };
  });

  const order = createOrder();

  sendTelegramMessage(
    req.telegramUser.id,
    formatOrderConfirmation(order, orderItems)
  ).catch(console.error);

  notifyAdmins(order, orderItems).catch(console.error);

  res.status(201).json({ ...order, items: orderItems });
});

router.patch('/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!ORDER_STATUSES[status]) {
    return res.status(400).json({ error: 'Невалідний статус' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) return res.status(404).json({ error: 'Замовлення не знайдено' });

  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);

  res.json({ ...updated, items });
});

export default router;
