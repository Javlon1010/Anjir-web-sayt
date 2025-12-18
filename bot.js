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
const CHAT_ID = "6652899566";


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
      date: new Date().toLocaleString("uz-UZ"),
      location: location || '',
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
      await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text,
          parse_mode: "HTML",
        }),
      });
    } catch (err) {
      console.error('Telegram send error:', err);
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
        await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: wid, text, parse_mode: 'HTML' })
        });
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

// ======================================================
// 🚀 SERVERNI ISHGA TUSHIRISH
// ======================================================
app.listen(PORT, () => {
  console.log(`🚀 Server ${PORT}-portda ishga tushdi!`);
});
