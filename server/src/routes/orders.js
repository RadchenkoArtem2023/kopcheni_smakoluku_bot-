import { Router } from 'express';
import {
  getProductsCollection,
  getOrdersCollection,
  getOrderItemsCollection,
  mapOrder,
  mapOrderItem,
  getObjectId,
} from '../db.js';
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

router.get('/', async (_req, res) => {
  const ordersCollection = await getOrdersCollection();
  const orderItemsCollection = await getOrderItemsCollection();
  const orders = await ordersCollection.find().sort({ created_at: -1 }).toArray();

  const result = await Promise.all(
    orders.map(async (order) => {
      const items = await orderItemsCollection
        .find({ order_id: order.id })
        .toArray();
      return {
        ...mapOrder(order),
        items: items.map(mapOrderItem),
      };
    })
  );

  res.json(result);
});

router.get('/my', async (req, res) => {
  const ordersCollection = await getOrdersCollection();
  const orderItemsCollection = await getOrderItemsCollection();

  const orders = await ordersCollection
    .find({ telegram_user_id: String(req.telegramUser.id) })
    .sort({ created_at: -1 })
    .toArray();

  const result = await Promise.all(
    orders.map(async (order) => {
      const items = await orderItemsCollection
        .find({ order_id: order.id })
        .toArray();
      return {
        ...mapOrder(order),
        items: items.map(mapOrderItem),
      };
    })
  );

  res.json(result);
});

router.post('/', async (req, res) => {
  const { first_name, last_name, phone, address, items } = req.body;

  if (!first_name?.trim() || !last_name?.trim() || !phone?.trim() || !address?.trim()) {
    return res.status(400).json({ error: 'Заповніть усі контактні дані' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Додайте хоча б одну позицію' });
  }

  const productsCollection = await getProductsCollection();
  const orderItems = [];
  let total = 0;

  for (const item of items) {
    const product = await productsCollection.findOne({
      _id: getObjectId(item.product_id),
      is_active: true,
      is_stop_listed: false,
    });

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
      product_id: product._id.toString(),
      product_name: product.name,
      grams,
      price_per_100g: product.price_per_100g,
      subtotal,
    });
  }

  const ordersCollection = await getOrdersCollection();
  const orderItemsCollection = await getOrderItemsCollection();

  const orderResult = await ordersCollection.insertOne({
    telegram_user_id: String(req.telegramUser.id),
    first_name: first_name.trim(),
    last_name: last_name.trim(),
    phone: phone.trim(),
    address: address.trim(),
    status: 'new',
    total,
    created_at: new Date(),
  });

  const orderId = orderResult.insertedId.toString();

  const itemsToInsert = orderItems.map((item) => ({
    order_id: orderId,
    product_id: item.product_id,
    product_name: item.product_name,
    grams: item.grams,
    price_per_100g: item.price_per_100g,
    subtotal: item.subtotal,
  }));

  await orderItemsCollection.insertMany(itemsToInsert);

  const order = {
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

  sendTelegramMessage(req.telegramUser.id, formatOrderConfirmation(order, orderItems)).catch(console.error);
  notifyAdmins(order, orderItems).catch(console.error);

  res.status(201).json({ ...order, items: orderItems });
});

router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!ORDER_STATUSES[status]) {
    return res.status(400).json({ error: 'Невалідний статус' });
  }

  const objectId = getObjectId(id);
  if (!objectId) return res.status(404).json({ error: 'Замовлення не знайдено' });

  const ordersCollection = await getOrdersCollection();
  const orderItemsCollection = await getOrderItemsCollection();

  const order = await ordersCollection.findOne({ _id: objectId });
  if (!order) return res.status(404).json({ error: 'Замовлення не знайдено' });

  await ordersCollection.updateOne({ _id: objectId }, { $set: { status } });

  const updated = await ordersCollection.findOne({ _id: objectId });
  const items = await orderItemsCollection.find({ order_id: updated._id.toString() }).toArray();

  res.json({ ...mapOrder(updated), items: items.map(mapOrderItem) });
});

export default router;
