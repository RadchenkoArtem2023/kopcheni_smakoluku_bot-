# Копчені Смаколики — Telegram Web App

Telegram Web App для замовлення копчених делікатесів з ваговим меню (ціна за 100 г).

## Можливості

### Клієнтський додаток
- Перегляд актуального меню та цін
- Замовлення з кількістю в грамах (вручну або кнопками +/−)
- Оформлення з адресою, телефоном, ім'ям та прізвищем
- Підтвердження замовлення з детальним розрахунком у Telegram
- Екран завантаження з логотипом

### Адмін-панель
- Перегляд усіх замовлень та зміна статусу
- Додавання / видалення позицій меню
- Редагування цін
- Стоп-лист (тимчасово приховати позиції з продажу)

## Швидкий старт

### 1. Створіть Telegram-бота

1. Напишіть [@BotFather](https://t.me/BotFather)
2. `/newbot` → вкажіть назву та username
3. Збережіть **BOT_TOKEN**
4. `/setmenubutton` → вкажіть URL вашого Web App

### 2. Налаштування

```bash
cd kopcheni-smakoliky
cp .env.example .env
```

Відредагуйте `.env`:

```env
BOT_TOKEN=123456:ABC...
WEBAPP_URL=https://your-domain.com
ADMIN_TELEGRAM_IDS=ваш_telegram_id
PORT=3001
```

Ваш Telegram ID можна дізнатися у [@userinfobot](https://t.me/userinfobot).

### 3. Запуск

```bash
npm install
npm run dev
```

- Клієнт: http://localhost:5173
- Адмін: http://localhost:5173/admin.html
- API: http://localhost:3001

У режимі розробки авторизація Telegram необов'язкова (DEV_MODE).

### 4. Продакшн

```bash
npm run build
npm start
```

Сервер віддає зібраний фронтенд з `client/dist`.

Для Telegram Web App потрібен **HTTPS**. Використовуйте:
- [ngrok](https://ngrok.com) для тестування
- VPS + Nginx + Let's Encrypt для продакшну

### 5. Webhook бота (продакшн)

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://your-domain.com/api/telegram/webhook"
```

## Структура проєкту

```
kopcheni-smakoliky/
├── client/          # React + Vite (клієнт + адмін)
├── server/          # Express + SQLite API
├── .env.example
└── package.json
```

## Логотип

Замініть `client/public/logo.svg` на ваш логотип (SVG або PNG — оновіть посилання в компонентах).

## Статуси замовлень

| Код | Назва |
|-----|-------|
| new | Нове |
| confirmed | Підтверджено |
| preparing | Готується |
| delivering | Доставляється |
| completed | Виконано |
| cancelled | Скасовано |

## Команди бота

- `/start` — відкрити меню замовлення
- `/admin` — панель адміністратора (лише для ADMIN_TELEGRAM_IDS)
