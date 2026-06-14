const ORDER_STATUSES = {
  new: 'Нове',
  confirmed: 'Підтверджено',
  preparing: 'Готується',
  delivering: 'Доставляється',
  completed: 'Виконано',
  cancelled: 'Скасовано',
};

function normalizePublicUrl(url) {
  if (!url?.trim()) return '';
  const trimmed = url.trim().replace(/\/+$/, '');
  if (/^https?:\/\/[^/]+/i.test(trimmed)) return trimmed;
  const host = trimmed.replace(/^\/+/, '');
  if (!host) return '';
  return `https://${host}`;
}

function getWebAppUrl() {
  return normalizePublicUrl(process.env.WEBAPP_URL);
}

function getServerUrl() {
  return normalizePublicUrl(process.env.SERVER_URL);
}

function isDevMode() {
  return process.env.NODE_ENV !== 'production' && process.env.DEV_MODE !== 'false';
}

export async function sendTelegramMessage(chatId, text, options = {}) {
  const token = process.env.BOT_TOKEN;
  if (!token || !chatId) return false;

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...options,
    }),
  });

  return response.ok;
}

export function formatOrderConfirmation(order, items) {
  const lines = items.map((item) => {
    const subtotal = item.subtotal.toFixed(2);
    return `• <b>${item.product_name}</b> — ${item.grams} г × ${item.price_per_100g.toFixed(2)} грн/100г = <b>${subtotal} грн</b>`;
  });

  return [
    '🛒 <b>Ваше замовлення прийнято!</b>',
    '',
    `Замовлення №${order.id}`,
    '',
    ...lines,
    '',
    `💰 <b>Разом: ${order.total.toFixed(2)} грн</b>`,
    '',
    `👤 ${order.last_name} ${order.first_name}`,
    `📞 ${order.phone}`,
    `📍 ${order.address}`,
    '',
    'Дякуємо за замовлення! Ми зв\'яжемося з вами найближчим часом.',
  ].join('\n');
}

export function formatAdminNotification(order, items) {
  const lines = items.map(
    (item) => `• ${item.product_name} — ${item.grams} г (${item.subtotal.toFixed(2)} грн)`
  );

  return [
    '🆕 <b>Нове замовлення!</b>',
    '',
    `№${order.id} від ${order.last_name} ${order.first_name}`,
    `📞 ${order.phone}`,
    `📍 ${order.address}`,
    '',
    ...lines,
    '',
    `💰 Разом: <b>${order.total.toFixed(2)} грн</b>`,
  ].join('\n');
}

export async function notifyAdmins(order, items) {
  const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  const text = formatAdminNotification(order, items);
  await Promise.all(adminIds.map((id) => sendTelegramMessage(id, text)));
}

export async function setupBotWebhook() {
  const token = process.env.BOT_TOKEN;
  const webappUrl = getWebAppUrl();
  const serverUrl = getServerUrl();

  if (!token) {
    console.warn('BOT_TOKEN не встановлено — Telegram повідомлення вимкнено');
    return { mode: 'disabled' };
  }

  const setCommands = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commands: [
        { command: 'start', description: 'Відкрити меню' },
        { command: 'admin', description: 'Панель адміністратора' },
      ],
    }),
  });

  if (!setCommands.ok) {
    console.warn('Не вдалося встановити команди бота');
  }

  if (webappUrl) {
    console.log(`Web App URL: ${webappUrl}`);
    console.log(`Admin URL: ${webappUrl}/admin.html`);
  } else {
    console.warn('WEBAPP_URL не встановлено — кнопки Web App не працюватимуть');
  }

  if (serverUrl) {
    const webhookUrl = `${serverUrl}/api/telegram/webhook`;
    const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
    });
    const data = await response.json();

    if (data.ok) {
      console.log(`Webhook встановлено: ${webhookUrl}`);
      return { mode: 'webhook', url: webhookUrl };
    }

    console.error('Не вдалося встановити webhook:', data.description || data);
    return { mode: 'webhook-failed', error: data.description };
  }

  if (isDevMode()) {
    console.log('SERVER_URL не встановлено — бот працює в режимі polling (локальна розробка)');
    return { mode: 'polling' };
  }

  console.warn(
    'SERVER_URL не встановлено — webhook не зареєстровано, бот не отримуватиме /start'
  );
  return { mode: 'none' };
}

let pollingActive = false;

export async function startBotPolling() {
  const token = process.env.BOT_TOKEN;
  if (!token || pollingActive) return;

  pollingActive = true;

  await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drop_pending_updates: false }),
  });

  let offset = 0;
  console.log('Polling Telegram updates...');

  const poll = async () => {
    if (!pollingActive) return;

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=30`
      );
      const data = await response.json();

      if (!data.ok) {
        console.error('Polling помилка:', data.description || data);
      } else {
        for (const update of data.result || []) {
          offset = update.update_id + 1;
          await handleBotUpdate(update);
        }
      }
    } catch (err) {
      console.error('Polling помилка:', err.message);
    }

    setTimeout(poll, 500);
  };

  poll();
}

export async function handleBotUpdate(update) {
  const token = process.env.BOT_TOKEN;
  const webappUrl = getWebAppUrl();
  if (!token || !update.message?.text) return;

  const chatId = update.message.chat.id;
  const text = update.message.text.trim();

  if (text === '/start' || text.startsWith('/start ')) {
    const keyboard = webappUrl
      ? {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🛒 Замовити', web_app: { url: webappUrl } }],
            ],
          },
        }
      : {};

    await sendTelegramMessage(
      chatId,
      'Ласкаво просимо до <b>Копчені Смаколики</b>! 🔥\n\nНатисніть кнопку нижче, щоб переглянути меню та оформити замовлення.',
      keyboard
    );
    return;
  }

  if (text === '/admin' || text.startsWith('/admin ')) {
    const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '')
      .split(',')
      .map((id) => id.trim());

    if (!adminIds.includes(String(chatId))) {
      await sendTelegramMessage(chatId, '⛔ У вас немає доступу до панелі адміністратора.');
      return;
    }

    const adminUrl = webappUrl ? `${webappUrl}/admin.html` : null;
    const keyboard = adminUrl
      ? {
          reply_markup: {
            inline_keyboard: [
              [{ text: '⚙️ Адмін-панель', web_app: { url: adminUrl } }],
            ],
          },
        }
      : {};

    await sendTelegramMessage(chatId, 'Панель адміністратора:', keyboard);
  }
}

export { ORDER_STATUSES };
