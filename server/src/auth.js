import crypto from 'crypto';

export function validateTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (calculatedHash !== hash) return null;

  const authDate = Number(params.get('auth_date'));
  if (Date.now() / 1000 - authDate > 86400) return null;

  const userStr = params.get('user');
  if (!userStr) return null;

  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function authMiddleware(req, res, next) {
  const initData = req.headers['x-telegram-init-data'];
  const botToken = process.env.BOT_TOKEN;
  const isDev = process.env.NODE_ENV !== 'production' && process.env.DEV_MODE !== 'false';

  if (!initData && isDev) {
    req.telegramUser = { id: 1, first_name: 'Dev', last_name: 'User' };
    return next();
  }

  if (!botToken) {
    return res.status(500).json({ error: 'BOT_TOKEN не налаштовано' });
  }

  const user = validateTelegramInitData(initData, botToken);
  if (!user) {
    return res.status(401).json({ error: 'Невалідна авторизація Telegram' });
  }

  req.telegramUser = user;
  next();
}

export function adminMiddleware(req, res, next) {
  const isDev = process.env.NODE_ENV !== 'production' && process.env.DEV_MODE !== 'false';

  if (isDev && req.telegramUser.id === 1) {
    return next();
  }

  const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (!adminIds.includes(String(req.telegramUser.id))) {
    return res.status(403).json({ error: 'Доступ заборонено' });
  }

  next();
}
