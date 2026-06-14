import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware, adminMiddleware } from './auth.js';
import productsRouter from './routes/products.js';
import ordersRouter from './routes/orders.js';
import { handleBotUpdate, setupBotWebhook, startBotPolling } from './telegram.js';
import { initDb } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const PORT = process.env.PORT || 3001;
const START_LOG_PATH = path.join(__dirname, '..', 'logs', 'start.log');

function writeStartupLog(message) {
  try {
    const logDir = path.dirname(START_LOG_PATH);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(START_LOG_PATH, `${new Date().toISOString()} - ${message}\n`);
  } catch (err) {
    console.error('Не вдалося записати лог старту:', err);
  }
}

process.on('uncaughtException', (err) => {
  const message = `Uncaught Exception: ${err.stack || err.message}`;
  console.error(message);
  writeStartupLog(message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  const message = `Unhandled Rejection: ${reason?.stack || reason}`;
  console.error(message);
  writeStartupLog(message);
});

const app = express();
app.use(
  cors({
    origin: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Telegram-Init-Data'],
    credentials: true,
  })
);
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
  const startupMessage = `Server started on port ${PORT}`;
  console.log(`Сервер запущено: http://localhost:${PORT}`);
  writeStartupLog(startupMessage);

  try {
    await initDb();
    console.log('MongoDB підключено');
    writeStartupLog('MongoDB підключено');
  } catch (err) {
    const errMsg = `Не вдалося підключитися до MongoDB: ${err.message || err}`;
    console.error(errMsg);
    writeStartupLog(errMsg);
    process.exit(1);
  }

  const botSetup = await setupBotWebhook();
  if (botSetup.mode === 'polling') {
    await startBotPolling();
  }
});
