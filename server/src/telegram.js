const ORDER_STATUSES = {
  new: 'Нове',
  confirmed: 'Підтверджено',
  preparing: 'Готується',
  delivering: 'Доставляється',
  completed: 'Виконано',
  cancelled: 'Скасовано',
};

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
  const webappUrl = process.env.WEBAPP_URL;

  if (!token) {
    console.warn('BOT_TOKEN не встановлено — Telegram повідомлення вимкнено');
    return;
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
  }
}

export async function handleBotUpdate(update) {
  const token = process.env.BOT_TOKEN;
  const webappUrl = process.env.WEBAPP_URL;
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
