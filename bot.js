const express = require("express");

const bodyParser = require("body-parser");
const fetch = require("node-fetch");
const cors = require("cors");
const fs = require("fs");

// ⚠️ Load environment variables from .env (if present)
require("dotenv").config();

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

// 🔸 Serve static files (so you can open admin and product pages via http://localhost:3000)
app.use(express.static(__dirname));

// 🗂 Fayllar mavjud bo‘lishi kerak
if (!fs.existsSync("orders.json")) fs.writeFileSync("orders.json", "[]", "utf-8");
if (!fs.existsSync("products.json")) fs.writeFileSync("products.json", "[]", "utf-8");

// 🔌 MongoDB konfiguratsiyasi (agar kerak bo‘lsa .env fayliga MONGODB_URI qo‘shing)
const mongoose = require("mongoose");
const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/anjir";

// Product schema va model
const productSchema = new mongoose.Schema({
  id: { type: Number, unique: true, required: true },
  name: String,
  price: String,
  image: String,
  category: String,
  stock: { type: Number, default: 35 },     // qancha qolgani
  sold: { type: Number, default: 0 },       // qancha sotilgan
}, { timestamps: true });

const Product = mongoose.models.Product || mongoose.model("Product", productSchema);
// Order model (required early so we can check on startup)
const Order = require('./models/Order');
// Telegram bot library loaded lazily above when BOT_TOKEN is set

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    // Show masked URI/host for debugging
    try {
      const hostPart = MONGO_URI.split('@').pop() || MONGO_URI;
      const maskedHost = hostPart.replace(/:[^@]+@/, ':****@');
      console.log("✅ MongoDB connected — host:", maskedHost);
    } catch (e) {
      console.log("✅ MongoDB connected");
    }

    // Agar DB bo‘sh bo‘lsa va products.json mavjud bo‘lsa, bir martalik import
    try {
      const count = await Product.countDocuments();
      console.log('Products in DB at startup:', count);
      if (count === 0 && fs.existsSync("products.json")) {
        const existing = JSON.parse(fs.readFileSync("products.json", "utf-8"));
        if (Array.isArray(existing) && existing.length > 0) {
          await Product.insertMany(existing);
          console.log(`✅ Imported ${existing.length} products from products.json`);
        }
      }
    } catch (err) {
      console.error("Import error:", err);
    }

    // 🔎 Buyurtmalar mavjudligini tekshirish
    try {
      const orderCount = await Order.countDocuments();
      if (!orderCount) console.log('📭 Hali buyurtmalar mavjud emas.');
      else console.log('Buyurtmalar soni:', orderCount);
    } catch (err) {
      console.error('Order count check error:', err);
    }

    // 🔔 Telegram konfiguratsiya tekshiruvi yordamchi xabarlar
    try {
      if (!process.env.BOT_TOKEN) console.warn('⚠️ BOT_TOKEN mavjud emas — Telegram xabarlari yuborilmaydi');
      const workerIds = (process.env.WORKER_CHAT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
      if (!workerIds.length) console.warn('⚠️ WORKER_CHAT_IDS sozlanmagan — ishchilarga xabar jo‘natib bo‘lmaydi');
    } catch (err) {
      console.error('Config check error:', err);
    }

  })
  .catch((err) => console.error("MongoDB connection error:", err));

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
    // 1) Tekshirish: har bir mahsulot uchun yetarli stock borligini tekshiramiz
    for (const item of cart) {
      const prod = await Product.findOne({ id: Number(item.id) });
      if (!prod) return res.status(400).json({ error: `Mahsulot topilmadi: ${item.name}` });
      const qty = Number(item.quantity) || 1;
      if (prod.stock < qty) return res.status(400).json({ error: `"${item.name}" uchun qolgan stock yetarli emas. Qolgan: ${prod.stock}` });
    }

    // 2) Stockni kamaytirish va sold ham oshirish
    for (const item of cart) {
      const qty = Number(item.quantity) || 1;
      await Product.findOneAndUpdate({ id: Number(item.id) }, { $inc: { stock: -qty, sold: qty } });
    }

    // 3) Buyurtmani yaratish va saqlash
    const orderDoc = new Order({
      id: Date.now(),
      name,
      phone,
      address,
      cart,
      total,
      status: "Yangi",
      date: new Date(), // Use Date object instead of string
      location: location || null, // Use null instead of empty string
    });

    await orderDoc.save();

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
    text += `\n💰 <b>Jami:</b> ${total.toLocaleString()} so‘m`;

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
    res.status(500).json({ error: 'Order save failed' });
  }
});

// 🔹 Buyurtmalarni olish (MongoDB)
app.get("/api/orders", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error('GET /api/orders error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 🔹 Buyurtma holatini yangilash
app.post("/api/orders/update", async (req, res) => {
  try {
    const { id, status } = req.body;
    const order = await Order.findOneAndUpdate({ id: Number(id) }, { status }, { new: true });
    if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });
    res.json({ success: true, order });
  } catch (err) {
    console.error('POST /api/orders/update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ➕ Update single item status in an order
app.post('/api/orders/item-update', async (req, res) => {
  try {
    const { orderId, itemId, status } = req.body; // status: 'delivered' | 'not_found'
    const order = await Order.findOne({ id: Number(orderId) });
    if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });

    const item = order.cart.find(i => Number(i.id) === Number(itemId));
    if (!item) return res.status(404).json({ error: 'Mahsulot topilmadi' });

    item.status = status;
    await order.save();

    // Check if all items are resolved
    const allResolved = order.cart.every(i => i.status === 'delivered' || i.status === 'not_found');
    if (allResolved) {
      order.status = 'Tugallandi';
      await order.save();

      // Notify admin CHAT_ID that order completed
      const completeText = `✅ <b>Buyurtma ${order.id} tugallandi</b>\nMijoz: ${order.name} | ${order.phone} | ${order.address}`;
      try {
        await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: CHAT_ID, text: completeText, parse_mode: 'HTML' })
        });
      } catch (err) { console.error('Telegram notify complete error:', err); }
    }

    res.json({ success: true, itemStatus: item.status });

    // Notify admin via Telegram about item status change
    try {
      const itext = `🔁 <b>Buyurtma ${order.id} — mahsulot holati yangilandi</b>\nMahsulot: ${item.name}\nHolat: ${item.status}`;
      await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: CHAT_ID, text: itext, parse_mode: 'HTML' }) });
    } catch (err) { console.error('Telegram notify item status error:', err); }
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

// Helper: get sequential order id using counters collection
async function getNextOrderId() {
  const coll = mongoose.connection.collection('counters');
  const res = await coll.findOneAndUpdate(
    { _id: 'orderid' },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  return res && res.value && res.value.seq ? res.value.seq : 1;
}

// ➕ Notify workers about an order
app.post('/api/orders/notify-workers', async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findOne({ id: Number(orderId) });
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
    order.status = 'Qabul qilingan';
    await order.save();

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
    if (orderId) order = await Order.findOne({ id: Number(orderId) });

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
app.get("/api/products", async (req, res) => {
  try {
    const { category, q } = req.query;
    const filter = {};

    // Agar category berilsa (admin talab qilgandek), faqat shunga mos mahsulotlarni qaytaramiz
    if (category) filter.category = category;

    // Qidiruv - name bo'yicha case-insensitive regex
    if (q) filter.name = { $regex: q, $options: 'i' };

    const products = await Product.find(filter).sort({ createdAt: -1 });
    console.log(`/api/products requested — ${products.length} products returned (category=${category||''}, q=${q||''})`);
    res.json(products);
  } catch (err) {
    console.error('GET /api/products error:', err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// 🔹 Kategoriya ro'yxatini olish
app.get('/api/products/categories', async (req, res) => {
  try {
    const categories = await Product.distinct('category');
    res.json(categories.filter(Boolean));
  } catch (err) {
    console.error('GET /api/products/categories error:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// ➕ Yangi mahsulot qo‘shish
app.post("/api/products/add", async (req, res) => {
  try {
    console.log('POST /api/products/add body:', req.body);

    const { name, price, image, category } = req.body;
    const stock = Number(req.body.stock) || 35;

    if (!name || !price || !image || !category)
      return res.status(400).json({ error: "Ma'lumotlar to‘liq emas" });

    const newProduct = new Product({ id: Date.now(), name, price, image, category, stock, sold: 0 });
    await newProduct.save();

    console.log('Product saved:', newProduct.id);
    res.json({ success: true, product: newProduct });
  } catch (err) {
    console.error('Error saving product:', err && err.stack ? err.stack : err);
    res.status(500).json({ error: err.message || "Server xatosi" });
  }
});

// ❌ Mahsulotni o‘chirish
app.post("/api/products/delete", async (req, res) => {
  try {
    const { id } = req.body;
    const idNum = Number(id);
    await Product.findOneAndDelete({ id: idNum });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// ✏️ Mahsulotni tahrirlash
app.post("/api/products/edit", async (req, res) => {
  try {
    let { id, name, price, image, category, stock } = req.body;
    const idNum = Number(id);

    const updateData = { name, price, image, category };
    if (typeof stock !== 'undefined') updateData.stock = Number(stock);

    const product = await Product.findOneAndUpdate(
      { id: idNum },
      updateData,
      { new: true }
    );

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
        const order = await Order.findOne({ id: orderId });
        if (!order) return bot.answerCallbackQuery(q.id, { text: 'Buyurtma topilmadi', show_alert: true });

        const keyboard = buildOrderKeyboard(order, idx);
        try { await bot.editMessageReplyMarkup({ inline_keyboard: keyboard }, { chat_id: chatId, message_id: messageId }); } catch (e) { /* ignore edit errors */ }
        return bot.answerCallbackQuery(q.id, { text: 'Tanlang: ✅ Mahsulot berildi yoki ❌ Mahsulot topilmadi', show_alert: false });
      }

      if (parts[0] === 'mark') {
        const orderId = Number(parts[1]);
        const idx = Number(parts[2]);
        const action = parts[3];

        const order = await Order.findOne({ id: orderId });
        if (!order) return bot.answerCallbackQuery(q.id, { text: 'Buyurtma topilmadi', show_alert: true });
        const item = order.cart[idx];
        if (!item) return bot.answerCallbackQuery(q.id, { text: 'Mahsulot topilmadi', show_alert: true });

        if (action === 'delivered') {
          if (item.status === 'delivered') return bot.answerCallbackQuery(q.id, { text: 'Allaqachon belgilangan', show_alert: false });
          item.status = 'delivered';
          await order.save();

          // if all resolved, mark order complete and notify admin
          const allResolved = order.cart.every(i => i.status === 'delivered' || i.status === 'not_found');
          if (allResolved) {
            order.status = 'Tugallandi';
            await order.save();
            try {
              const completeText = `✅ <b>Buyurtma ${order.id} tugallandi</b>\nMijoz: ${order.name} | ${order.phone} | ${order.address}`;
              if (bot && bot.sendMessage) await bot.sendMessage(CHAT_ID, completeText, { parse_mode: 'HTML' });
            } catch (e) { console.error('Telegram notify complete error:', e); }
          }

          const keyboard = buildOrderKeyboard(order, null);
          try { await bot.editMessageReplyMarkup({ inline_keyboard: keyboard }, { chat_id: chatId, message_id: messageId }); } catch (e) { /* ignore */ }
          return bot.answerCallbackQuery(q.id, { text: 'Mahsulot belgilandi ✅', show_alert: false });
        }

        if (action === 'not_found') {
          // toggle not_found
          item.status = item.status === 'not_found' ? '' : 'not_found';
          await order.save();

          const keyboard = buildOrderKeyboard(order, null);
          try { await bot.editMessageReplyMarkup({ inline_keyboard: keyboard }, { chat_id: chatId, message_id: messageId }); } catch (e) { /* ignore */ }
          return bot.answerCallbackQuery(q.id, { text: item.status === 'not_found' ? 'Mahsulot topilmadi ❌' : 'Belgisi olib tashlandi', show_alert: false });
        }

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
