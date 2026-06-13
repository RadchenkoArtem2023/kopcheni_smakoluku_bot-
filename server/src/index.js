import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware, adminMiddleware } from './auth.js';
import productsRouter from './routes/products.js';
import ordersRouter from './routes/orders.js';
import { handleBotUpdate, setupBotWebhook } from './telegram.js';
import './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3002;

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', name: 'Копчені Смаколики' });
});

app.post('/api/telegram/webhook', async (req, res) => {
  try {
    await handleBotUpdate(req.body);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

app.get('/api/menu', authMiddleware, (req, res, next) => {
  req.url = '/menu';
  productsRouter(req, res, next);
});

app.post('/api/orders', authMiddleware, (req, res, next) => {
  req.url = '/';
  ordersRouter(req, res, next);
});

app.use('/api/admin/products', authMiddleware, adminMiddleware, productsRouter);
app.use('/api/admin/orders', authMiddleware, adminMiddleware, ordersRouter);

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(clientDist, 'admin.html'));
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(404).json({ error: 'Not found' });
  });
});

app.listen(PORT, async () => {
  console.log(`Сервер запущено: http://localhost:${PORT}`);
  await setupBotWebhook();
});
