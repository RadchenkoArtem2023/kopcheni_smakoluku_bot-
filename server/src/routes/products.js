import { Router } from 'express';
import {
  getProductsCollection,
  getObjectId,
  mapProduct,
} from '../db.js';

const router = Router();

router.get('/menu', async (_req, res) => {
  const productsCollection = await getProductsCollection();
  const products = await productsCollection
    .find({ is_active: true, is_stop_listed: false }, {
      projection: {
        name: 1,
        description: 1,
        price_per_100g: 1,
        sort_order: 1,
        is_active: 1,
        is_stop_listed: 1,
        created_at: 1,
      },
    })
    .sort({ sort_order: 1, name: 1 })
    .toArray();

  res.json(products.map(mapProduct));
});

router.get('/', async (_req, res) => {
  const productsCollection = await getProductsCollection();
  const products = await productsCollection.find().sort({ sort_order: 1, name: 1 }).toArray();
  res.json(products.map(mapProduct));
});

router.post('/', async (req, res) => {
  const { name, description = '', price_per_100g, sort_order = 0 } = req.body;

  if (!name?.trim() || !price_per_100g || price_per_100g <= 0) {
    return res.status(400).json({ error: 'Назва та ціна обов\'язкові' });
  }

  const productsCollection = await getProductsCollection();
  const result = await productsCollection.insertOne({
    name: name.trim(),
    description: description.trim(),
    price_per_100g,
    sort_order,
    is_active: true,
    is_stop_listed: false,
    created_at: new Date(),
  });

  const product = await productsCollection.findOne({ _id: result.insertedId });
  res.status(201).json(mapProduct(product));
});

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const objectId = getObjectId(id);
  if (!objectId) return res.status(404).json({ error: 'Позицію не знайдено' });

  const { name, description, price_per_100g, is_active, is_stop_listed, sort_order } = req.body;
  const productsCollection = await getProductsCollection();
  const product = await productsCollection.findOne({ _id: objectId });
  if (!product) return res.status(404).json({ error: 'Позицію не знайдено' });

  await productsCollection.updateOne(
    { _id: objectId },
    {
      $set: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description: description.trim() } : {}),
        ...(price_per_100g !== undefined ? { price_per_100g } : {}),
        ...(is_active !== undefined ? { is_active } : {}),
        ...(is_stop_listed !== undefined ? { is_stop_listed } : {}),
        ...(sort_order !== undefined ? { sort_order } : {}),
      },
    }
  );

  const updated = await productsCollection.findOne({ _id: objectId });
  res.json(mapProduct(updated));
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const objectId = getObjectId(id);
  if (!objectId) return res.status(404).json({ error: 'Позицію не знайдено' });

  const productsCollection = await getProductsCollection();
  const product = await productsCollection.findOne({ _id: objectId });
  if (!product) return res.status(404).json({ error: 'Позицію не знайдено' });

  await productsCollection.deleteOne({ _id: objectId });
  res.json({ success: true });
});

export default router;
