const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");

const fs = require("fs");

// ⚠️ Load environment variables from .env (if present)
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;



// 🔐 Telegram ma'lumotlari
const TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = "1072558595";


let bot = null;
try {
  // require lazily so app can still run even if the lib isn't installed in some environments
  const TelegramBotLib = require('node-telegram-bot-api');
  if (TOKEN) {
    bot = new TelegramBotLib(TOKEN, { polling: true });

    bot.on("message", (msg) => {
      const chatId = msg.chat.id;
      const firstName = msg.from.first_name || '';

      if (msg.text === '/start') {
        bot.sendMessage(chatId, `Salom, ${firstName}! Anjir admin botiga xush kelibsiz. Siz bu yerda buyurtmalarni boshqarishingiz mumkin.`);
      }
      else {
        bot.sendMessage(chatId, `Kechirasiz, men faqatgina /start buyrug'ini tushunaman.`);
      }
    });
  } else {
    console.warn('⚠️ BOT_TOKEN mavjud emas — Telegram bot o‘chirildi');
  }
} catch (err) {
  console.warn('node-telegram-bot-api yuklanmadi:', err && err.message ? err.message : err);
}

// Helpful polling error handler - gives actionable message when multiple instances run
if (bot) {
  bot.on('polling_error', (err) => {
    console.error('polling_error:', err && err.code ? `${err.code} ${err.message}` : err);
    if (err && err.code === 'ETELEGRAM') {
      console.warn('⚠️ ETELEGRAM: multiple bot instances detected or polling conflict. Stop other bot instances or disable polling in one instance.');
    }
  });
}

// ======================================================
// 🛠 ASOSIY SERVER KODI
// ======================================================
// 🔧 Middleware
app.use(cors());
app.use(bodyParser.json());

// � Admin Panel Password Protection Middleware
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '12';
const adminAuthMiddleware = (req, res, next) => {
  // Check if request is for admin API
  if (req.path.startsWith('/api/products') || req.path.startsWith('/api/orders')) {
    // GET requests don't need auth, only POST/PUT/DELETE
    if (req.method === 'GET') {
      return next();
    }
    
    // For admin operations, check password
    const password = req.headers['x-admin-password'] || req.body?.adminPassword;
    
    if (!password || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Parol noto\'g\'ri yoki mavjud emas', success: false });
    }
  }
  
  next();
};

app.use(adminAuthMiddleware);

// �🔸 Serve static files (so you can open admin and product pages via http://localhost:3000)
app.use(express.static(__dirname));

// 🗂 Fayllar mavjud bo‘lishi kerak
if (!fs.existsSync("orders.json")) fs.writeFileSync("orders.json", "[]", "utf-8");
if (!fs.existsSync("products.json")) fs.writeFileSync("products.json", "[]", "utf-8");

// Database layer: use MongoDB only if MONGODB_URI is provided, otherwise use filesystem fallback
const db = require('./lib/db');
// Telegram bot library loaded lazily above when BOT_TOKEN is set

(async function initDb() {
  try {
    if (db.useMongo) {
      // If using Mongo, check DB and import from products.json if empty
      const products = await db.getProducts();
      console.log('Products in DB at startup:', products.length);
      if (products.length === 0 && fs.existsSync('products.json')) {
        try {
          const existing = JSON.parse(fs.readFileSync('products.json', 'utf-8'));
          if (Array.isArray(existing) && existing.length > 0) {
            for (const p of existing) {
              await db.addProduct({ name: p.name, price: p.price, image: p.image, category: p.category, stock: p.stock || p.quantity || 0 });
            }
            console.log(`✅ Imported ${existing.length} products from products.json`);
          }
        } catch (err) {
          console.error('Import error:', err);
        }
      }

      const orders = await db.getOrders();
      if (!orders || orders.length === 0) console.log('📭 Hali buyurtmalar mavjud emas.');
      else console.log('Buyurtmalar soni:', orders.length);
    } else {
      console.log('ℹ️ Using filesystem DB (products.json/orders.json) — set MONGODB_URI to use MongoDB.');
    }

    // Config checks (regardless of DB)
    if (!process.env.BOT_TOKEN) console.warn('⚠️ BOT_TOKEN mavjud emas — Telegram xabarlari yuborilmaydi');
    const workerIds = (process.env.WORKER_CHAT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!workerIds.length) console.warn('⚠️ WORKER_CHAT_IDS sozlanmagan — ishchilarga xabar jo‘natib bo‘lmaydi');
  } catch (err) {
    console.error('DB init error:', err);
  }
})();

// ======================================================
// 🧾 BUYURTMALAR
// ======================================================

// 🛒 Buyurtma yuborish (MongoDB)

app.post("/api/order", async (req, res) => {
  const { name, phone, address, cart, total, location } = req.body;

  // Validatsiya
  if (!name || !phone || !address || !cart || cart.length === 0) {
    return res.status(400).json({ error: "Ma'lumotlar to‘liq emas" });
  }

  try {
    // Use DB layer to add order (it will validate stock and decrement quantities)
    const orderDoc = await db.addOrder({ name, phone, address, cart, total, location });

    // Telegramga yuborish (admin chat)
    let text = `🛒 <b>Yangi buyurtma!</b>\n\n`;
    text += `👤 <b>Ism:</b> ${name}\n`;
    text += `📞 <b>Telefon:</b> ${phone}\n`;
    text += `🏠 <b>Manzil:</b> ${address}\n`;
    if (location) text += `\n📍 <b>Lokatsiya:</b> ${location}\n`;
    text += `\n<b>Mahsulotlar:</b>\n`;
    cart.forEach((item, idx) => {
      text += `${idx + 1}. ${item.name} x${item.quantity || 1} — ${item.price}\n`;
    });
    text += `\n💰 <b>Jami:</b> ${Number(total).toLocaleString()} so‘m`;

    try {
      // send the admin message with inline keyboard (product buttons)
      const adminKeyboard = buildOrderKeyboard(orderDoc);
      if (bot && bot.sendMessage) {
        await bot.sendMessage(CHAT_ID, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: adminKeyboard } });
      } else {
        await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: CHAT_ID,
            text,
            parse_mode: "HTML",
            reply_markup: JSON.stringify({ inline_keyboard: adminKeyboard })
          }),
        });
      }
    } catch (err) {
      console.error('Telegram send error:', err);
    }

    // Notify workers automatically (if configured)
    try {
      const notifyUrl = `http://localhost:${PORT}/api/orders/notify-workers`;
      await fetch(notifyUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: orderDoc.id })
      });
    } catch (err) {
      console.error('notify-workers internal call error:', err);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Order save error:', err);
    res.status(500).json({ error: err.message || 'Order save failed' });
  }
});

// 🔹 Buyurtmalarni olish
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await db.getOrders();
    res.json(orders);
  } catch (err) {
    console.error('GET /api/orders error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 🔹 Buyurtma holatini yangilash (legacy and RESTful versions)
app.post('/api/orders/update', async (req, res) => {
  try {
    const { id, status } = req.body;
    const order = await db.updateOrderStatus(id, status);
    if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });
    res.json({ success: true, order });
  } catch (err) {
    console.error('POST /api/orders/update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// RESTful: PUT /api/orders/:orderId/status
app.put('/api/orders/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const order = await db.updateOrderStatus(orderId, status);
    if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });
    res.json({ success: true, order });
  } catch (err) {
    console.error('PUT /api/orders/:orderId/status error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/orders/complete (admin action) — keeps parity with Next.js API
app.post('/api/orders/complete', async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: "Buyurtma ID si ko'rsatilmagan" });

    const order = await db.completeOrder(orderId);
    res.status(200).json({ success: true, message: 'Buyurtma muvaffaqiyatli yakunlandi', orderNumber: order.orderNumber || order.id });
  } catch (err) {
    console.error('POST /api/orders/complete error:', err);
    res.status(500).json({ error: 'Buyurtmani yakunlashda xatolik yuz berdi', details: err.message });
  }
});

// ➕ Update single item status in an order
app.post('/api/orders/item-update', async (req, res) => {
  try {
    const { orderId, itemId, status } = req.body; // status: 'delivered' | 'not_found'

    const result = await db.updateOrderItemStatus(orderId, Number(itemId), status);
    if (!result) return res.status(404).json({ error: 'Buyurtma yoki mahsulot topilmadi' });

    const { order, item } = result;

    res.json({ success: true, itemStatus: item.status, already: !!result.already, item: { name: item.name } });

    // Notify admin via Telegram about item status change
    try {
      const itext = `🔁 <b>Buyurtma ${order.id} — mahsulot holati yangilandi</b>\nMahsulot: ${item.name}\nHolat: ${item.status}`;
      await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: CHAT_ID, text: itext, parse_mode: 'HTML' }) });
    } catch (err) { console.error('Telegram notify item status error:', err); }

    // If order completed, notify admin too
    if (order.status === 'Tugallandi') {
      try {
        const completeText = `✅ <b>Buyurtma ${order.id} tugallandi</b>\nMijoz: ${order.name} | ${order.phone} | ${order.address}`;
        await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: CHAT_ID, text: completeText, parse_mode: 'HTML' })
        });
      } catch (err) { console.error('Telegram notify complete error:', err); }
    }
  } catch (err) {
    console.error('POST /api/orders/item-update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper: build inline keyboard rows for an order. If activeIndex is provided, that item's row will show action buttons.
function buildOrderKeyboard(order, activeIndex = null) {
  const rows = [];
  order.cart.forEach((it, idx) => {
    const baseText = `${idx+1}. ${it.name} x${it.quantity || 1}`;
    if (it.status === 'delivered') {
      rows.push([{ text: baseText + ' ✅', callback_data: 'noop' }]);
    } else if (activeIndex === idx) {
      // Show action buttons
      rows.push([
        { text: '✅ Mahsulot berildi', callback_data: `mark:${order.id}:${idx}:delivered` },
        { text: '❌ Mahsulot topilmadi', callback_data: `mark:${order.id}:${idx}:not_found` }
      ]);
    } else {
      const statusSuffix = it.status === 'not_found' ? ' ❌' : '';
      rows.push([{ text: baseText + statusSuffix, callback_data: `open:${order.id}:${idx}` }]);
    }
  });
  return rows;
}

// ➕ Notify workers about an order
app.post('/api/orders/notify-workers', async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await db.getOrderById(orderId);
    if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });

    const workerIds = (process.env.WORKER_CHAT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (workerIds.length === 0) return res.status(400).json({ error: 'Worker chat ids not configured' });

    const text = `📣 <b>Yangi ish:</b> Buyurtma ${order.id}\nMijoz: ${order.name} — ${order.phone}\nManzil: ${order.address}\n\nMahsulotlar:\n` + order.cart.map((it, idx) => `${idx+1}. ${it.name} x${it.quantity || 1}`).join('\n') + `\n\nIltimos, Admin panelga kiring: /admin`;

    for (const wid of workerIds) {
      try {
        // If our node-telegram-bot-api bot is available, send interactive message with inline keyboard
        const keyboard = buildOrderKeyboard(order);
        if (bot && bot.sendMessage) {
          await bot.sendMessage(wid, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } });
        } else {
          // fallback: plain send without keyboard
          await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: wid, text, parse_mode: 'HTML' })
          });
        }
      } catch (err) { console.error('Error sending to worker', wid, err); }
    }

    // include location link in admin notify too
    try {
      const adminText = `<b>Buyurtma ${order.id} qabul qilindi</b>\nMijoz: ${order.name} — ${order.phone}\nManzil: ${order.address}${order.location ? `\nLokatsiya: ${order.location}`: '' }`;
      await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID, text: adminText, parse_mode: 'HTML' })
      });
    } catch (err) { console.error('Admin notify error:', err); }

    // Update order status to 'Qabul qilingan'
    await db.updateOrderStatus(orderId, 'Qabul qilingan');

    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/orders/notify-workers error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ======================================================
// � TEST: worker notify (yuborilganini tekshirish uchun)
// POST /api/test/notify  { text: 'Hello' }
app.post('/api/test/notify', async (req, res) => {
  const text = req.body.text || '🔔 Test xabar: admin tomonidan sinov';
  const workerIds = (process.env.WORKER_CHAT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!process.env.BOT_TOKEN) return res.status(400).json({ error: 'BOT_TOKEN not configured' });
  if (workerIds.length === 0) return res.status(400).json({ error: 'WORKER_CHAT_IDS not configured' });

  for (const wid of workerIds) {
    try {
      await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: wid, text, parse_mode: 'HTML' })
      });
    } catch (err) { console.error('Test notify error to', wid, err); }
  }

  res.json({ success: true, workerIds });
});

// Quick test endpoint: send an interactive order message to any chatId for testing
// POST /api/test/send-order { chatId: number|string, orderId?: number }
app.post('/api/test/send-order', async (req, res) => {
  try {
    const { chatId, orderId } = req.body;
    if (!chatId) return res.status(400).json({ error: 'chatId is required' });

    let order = null;
    if (orderId) order = await db.getOrderById(orderId);

    if (!order) {
      // sample order payload
      order = {
        id: Date.now(),
        name: 'Test Mijoz',
        phone: '000000000',
        address: 'Test manzil',
        cart: [
          { id: 101, name: 'Olma', quantity: 2, status: '' },
          { id: 102, name: 'Sut', quantity: 1, status: '' },
          { id: 103, name: 'Non', quantity: 3, status: '' }
        ]
      };
    }

    const text = `📣 <b>Yangi ish (test):</b> Buyurtma ${order.id}\nMijoz: ${order.name} — ${order.phone}\nManzil: ${order.address}\n\nMahsulotlar:\n` + order.cart.map((it, idx) => `${idx+1}. ${it.name} x${it.quantity || 1}`).join('\n');
    const keyboard = buildOrderKeyboard(order);

    if (bot && bot.sendMessage) {
      await bot.sendMessage(String(chatId), text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } });
    } else {
      // fallback: send via HTTP API (serialize reply_markup)
      await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', reply_markup: JSON.stringify({ inline_keyboard: keyboard }) })
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/test/send-order error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Test bot status endpoint
app.get('/api/test/bot-status', async (req, res) => {
  if (!bot) return res.json({ botActive: false, message: 'Bot not initialized (BOT_TOKEN missing or bot lib not available).' });
  try {
    const me = await bot.getMe();
    res.json({ botActive: true, username: me.username || me.first_name || null });
  } catch (err) {
    console.error('bot.getMe error:', err);
    res.json({ botActive: false, message: err && err.code === 'ETELEGRAM' ? 'ETELEGRAM polling conflict detected. Ensure only one bot instance is running.' : 'Error reaching Telegram API' });
  }
});

// ======================================================
// �🛍 MAHSULOTLAR (MongoDB orqali)
// ======================================================

// 🔹 Barcha mahsulotlarni olish (category va search qo'llab-quvvatlanadi)
app.get('/api/products', async (req, res) => {
  try {
    const { category, q } = req.query;
    const products = await db.getProducts({ category, q });
    console.log(`/api/products requested — ${products.length} products returned (category=${category||''}, q=${q||''})`);
    res.json(products);
  } catch (err) {
    console.error('GET /api/products error:', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// 🔹 Kategoriya ro'yxatini olish
app.get('/api/products/categories', async (req, res) => {
  try {
    const categories = await db.getCategories();
    res.json(categories.filter(Boolean));
  } catch (err) {
    console.error('GET /api/products/categories error:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// 🔹 Server info (read-only / mongo detection) - works locally and on serverless
app.get('/api/server-info', async (req, res) => {
  try {
    res.json({ useMongo: db.useMongo, readOnlyFiles: db.isReadOnly ? db.isReadOnly() : false });
  } catch (err) {
    console.error('GET /api/server-info error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ➕ Yangi mahsulot qo‘shish
app.post('/api/products/add', async (req, res) => {
  try {
    console.log('POST /api/products/add body:', req.body);

    const { name, price, image, category } = req.body;
    const stock = Number(req.body.stock) || 35;

    if (!name || !price || !image || !category)
      return res.status(400).json({ error: "Ma'lumotlar to‘liq emas" });

    const newProduct = await db.addProduct({ name, price, image, category, stock });

    console.log('Product saved:', newProduct.id);
    res.json({ success: true, product: newProduct });
  } catch (err) {
    console.error('Error saving product:', err && err.stack ? err.stack : err);
    res.status(500).json({ error: err.message || "Server xatosi" });
  }
});

// ❌ Mahsulotni o‘chirish
app.post('/api/products/delete', async (req, res) => {
  try {
    const { id } = req.body;
    await db.deleteProduct(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// ✏️ Mahsulotni tahrirlash
app.post('/api/products/edit', async (req, res) => {
  try {
    let { id, name, price, image, category, stock } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });

    const product = await db.editProduct({ id, name, price, image, category, stock });

    if (!product) return res.status(404).json({ error: "Mahsulot topilmadi" });

    res.json({ success: true, product });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// Callback handlers for Telegram interactive messages (only if bot is active)
if (bot) {
  bot.on('callback_query', async (q) => {
    try {
      const data = q.data || '';
      const chatId = q.message && q.message.chat ? q.message.chat.id : null;
      const messageId = q.message && q.message.message_id ? q.message.message_id : null;

      if (!data) return bot.answerCallbackQuery(q.id, { text: 'No data', show_alert: false });
      if (data === 'noop') return bot.answerCallbackQuery(q.id, { text: 'Bu element allaqachon belgilangan', show_alert: false });

      const parts = data.split(':');
      if (parts[0] === 'open') {
        const orderId = Number(parts[1]);
        const idx = Number(parts[2]);
        const order = await db.getOrderById(orderId);
        if (!order) return bot.answerCallbackQuery(q.id, { text: 'Buyurtma topilmadi', show_alert: true });

        const keyboard = buildOrderKeyboard(order, idx);
        try { await bot.editMessageReplyMarkup({ inline_keyboard: keyboard }, { chat_id: chatId, message_id: messageId }); } catch (e) { /* ignore edit errors */ }
        return bot.answerCallbackQuery(q.id, { text: 'Tanlang: ✅ Mahsulot berildi yoki ❌ Mahsulot topilmadi', show_alert: false });
      }

      if (parts[0] === 'mark') {
        const orderId = Number(parts[1]);
        const idx = Number(parts[2]);
        const action = parts[3];

        const resObj = await db.updateOrderItemStatus(orderId, idx, action === 'delivered' ? 'delivered' : (action === 'not_found' ? (await (async () => { // toggle when not_found requested
          const o = await db.getOrderById(orderId);
          if (!o) return 'not_found';
          const it = o.cart[idx];
          if (!it) return 'not_found';
          return it.status === 'not_found' ? '' : 'not_found';
        })()) : action));

        if (!resObj) return bot.answerCallbackQuery(q.id, { text: 'Buyurtma yoki mahsulot topilmadi', show_alert: true });

        const { order, item } = resObj;

        const keyboard = buildOrderKeyboard(order, null);
        try { await bot.editMessageReplyMarkup({ inline_keyboard: keyboard }, { chat_id: chatId, message_id: messageId }); } catch (e) { /* ignore */ }

        if (action === 'delivered') return bot.answerCallbackQuery(q.id, { text: 'Mahsulot belgilandi ✅', show_alert: false });
        if (action === 'not_found') return bot.answerCallbackQuery(q.id, { text: item.status === 'not_found' ? 'Mahsulot topilmadi ❌' : 'Belgisi olib tashlandi', show_alert: false });

        return bot.answerCallbackQuery(q.id, { text: "Noma'lum amal", show_alert: true });
      }

      // fallback
      return bot.answerCallbackQuery(q.id, { text: "Noma'lum amal", show_alert: true });
    } catch (err) {
      console.error('callback_query error:', err);
    }
  });
}

// ======================================================
// 🚀 SERVERNI ISHGA TUSHIRISH
// ======================================================
app.listen(PORT, () => {
  console.log(`🚀 Server ${PORT}-portda ishga tushdi!`);
  console.log(` 🤖 Bot ishga tushdi`);
});