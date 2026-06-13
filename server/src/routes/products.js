import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/menu', (_req, res) => {
  const products = db
    .prepare(`
      SELECT id, name, description, price_per_100g
      FROM products
      WHERE is_active = 1 AND is_stop_listed = 0
      ORDER BY sort_order ASC, name ASC
    `)
    .all();

  res.json(products);
});

router.get('/', (_req, res) => {
  const products = db
    .prepare(`
      SELECT *
      FROM products
      ORDER BY sort_order ASC, name ASC
    `)
    .all();

  res.json(products);
});

router.post('/', (req, res) => {
  const { name, description = '', price_per_100g, sort_order = 0 } = req.body;

  if (!name?.trim() || !price_per_100g || price_per_100g <= 0) {
    return res.status(400).json({ error: 'Назва та ціна обов\'язкові' });
  }

  const result = db
    .prepare(`
      INSERT INTO products (name, description, price_per_100g, sort_order)
      VALUES (?, ?, ?, ?)
    `)
    .run(name.trim(), description.trim(), price_per_100g, sort_order);

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(product);
});

router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!product) return res.status(404).json({ error: 'Позицію не знайдено' });

  const { name, description, price_per_100g, is_active, is_stop_listed, sort_order } = req.body;

  db.prepare(`
    UPDATE products SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      price_per_100g = COALESCE(?, price_per_100g),
      is_active = COALESCE(?, is_active),
      is_stop_listed = COALESCE(?, is_stop_listed),
      sort_order = COALESCE(?, sort_order)
    WHERE id = ?
  `).run(
    name?.trim() ?? null,
    description?.trim() ?? null,
    price_per_100g ?? null,
    is_active ?? null,
    is_stop_listed ?? null,
    sort_order ?? null,
    id
  );

  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!product) return res.status(404).json({ error: 'Позицію не знайдено' });

  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  res.json({ success: true });
});

export default router;
