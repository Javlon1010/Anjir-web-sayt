# 🛒 Anjir Supermarket - Admin Panel & Order Management

## ✨ Yangilangan Xususiyatlar

### 🔐 Parol Himoyasi
- **Admin Panel Paroli**: `12` (`.env` faylidagi `ADMIN_PASSWORD`)
- Mahsulotlarni tahrirlash, qo'shish, o'chirish uchun parol talab qilinadi
- Buyurtma holatini o'zgartirganda parol talab qilinadi
- Parol birinchi marta admin panelga kirganda so'raladi

### 📦 Mahsulotlar Paneli (indexAdmin.html)
- ✅ Mahsulot qo'shish
- ✅ Mahsulot tahrirlash (rasm, narxi, kategoriya, soni)
- ✅ Mahsulot o'chirish
- ✅ Kategoriya bo'yicha filtrlash
- ✅ Qidiruv funksiyasi
- ✅ Web-saytga real-time yangilanish

### 📋 Buyurtmalar Paneli (index7.html)
- ✅ 10-15 soniyada avtomatik yangilash
- ✅ **Faol buyurtmalar** va **Tugallangan buyurtmalar** tabları
- ✅ Buyurtma holatini o'zgartirganda yo'naltirish (`Yangi` → `Qabul qilindi` → `Yetkazilmoqda` → `Yetkazib berildi`)
- ✅ Alohida mahsulot uchun holatni belgilash (✅ Berildi / ❌ Topilmadi)
- ✅ Buyurtmani bekor qilish
- ✅ Buyurtmani yakunlash (mahsulot sonini yangilash)
- ✅ Telegram orqali avtomat bildirishnoma

### 🗄️ Ma'lumotlar Bazasi
- **MongoDB** - Asosiy saqlash (agar `MONGODB_URI` oʻrnatilsa)
- **JSON Fayllar** - Fallback (products.json, orders.json)
- **Caching** - Mongoose bilan optimal ulanish

## 🚀 Ishga Tushirish

### 1. Oʻrnatish
```bash
npm install
```

### 2. .env Faylini Sozlash
```bash
cp .env.example .env
```

`.env` faylidagi sozlamalarni o'zgartirgiz:
```
ADMIN_PASSWORD=12              # Admin paroli
MONGODB_URI=...                # MongoDB bog'lanish (ixtiyoriy)
BOT_TOKEN=...                  # Telegram bot token (ixtiyoriy)
WORKER_CHAT_IDS=...            # Telegram chat ID'lari (ixtiyoriy)
PORT=3000                       # Server porti
```

### 3. Serverni Ishga Tushirish
```bash
npm start
# yoki
node bot.js
```

### 4. Panelga Kirish
- **Admin Panel**: http://localhost:3000/indexAdmin.html
- **Buyurtmalar**: http://localhost:3000/index7.html
- **Parol**: `12` (birinchi marta so'raladi)

## 📁 Fayl Strukturasi

```
api/
├── products/
│   ├── index.js       (Mahsulotlarni olish)
│   ├── add.js         (Mahsulot qo'shish - POST)
│   ├── edit.js        (Mahsulot tahrirlash - POST)
│   ├── delete.js      (Mahsulot o'chirish - POST)
│   └── categories.js  (Kategoriyalar ro'yxati)
├── orders/
│   ├── index.js       (Buyurtmalarni olish)
│   ├── update.js      (Holatni o'zgartirgish - POST)
│   ├── complete.js    (Buyurtmani yakunlash - POST)
│   ├── item-update.js (Mahsulot holatini belgilash - POST)
│   └── [orderId]/
│       └── status.js  (Buyurtma holati)
lib/
├── db.js              (Barcha database operatsiyalari)
├── mongoose.js        (MongoDB bog'lanishi va caching)
models/
├── Product.js         (Mahsulot sxemasi)
└── Order.js           (Buyurtma sxemasi)
```

## 🔌 API Endpoints

### Mahsulotlar
| Metod | Endpoint | Tavsilot |
|-------|----------|---------|
| GET | `/api/products` | Barcha mahsulotlar |
| POST | `/api/products/add` | Mahsulot qo'shish |
| POST | `/api/products/edit` | Mahsulot tahrirlash |
| POST | `/api/products/delete` | Mahsulot o'chirish |
| GET | `/api/products/categories` | Kategoriyalar |

### Buyurtmalar
| Metod | Endpoint | Tavsilot |
|-------|----------|---------|
| GET | `/api/orders` | Barcha buyurtmalar |
| POST | `/api/orders/update` | Holatni o'zgartirgish |
| POST | `/api/orders/complete` | Buyurtmani yakunlash |
| POST | `/api/orders/item-update` | Mahsulot holatini belgilash |

**Muhim**: Yozish amaliyotlari (POST, PUT, DELETE) uchun `x-admin-password` header talab qilinadi:
```javascript
headers: {
  'Content-Type': 'application/json',
  'x-admin-password': '12'
}
```

## 🛡️ Xavfsizlik

1. **Parol Himoyasi**: Barcha yozish amaliyotlari parol bilan qoʻllaniladi
2. **Environment Variables**: Sezuvchi maʼlumotlar `.env` faylidagi (git-ga qoshilmaydi)
3. **CORS**: Faqat ruxsat etilgan domenlar
4. **Validation**: Barcha inputlar tekshiriladi

## 🐛 Xatolarni Tuzatish

### "Parol noto'g'ri"
- `.env` faylidagi `ADMIN_PASSWORD` bilan match qilishni tekshirgiz
- Browser konsolida `adminPassword` o'zgaruvchisini tekshirgiz

### "Serverga ulanishda xatolik"
- Server ishlaywatirini tekshirgiz: `npm start`
- Port 3000 bu orqali o'tib ketganini tekshirgiz

### MongoDB xatalari
- `MONGODB_URI` to'g'ri oʻrnatilganini tekshirgiz
- Internetga ulanishi borini tekshirgiz
- Cluster IP whitelist qilinganini tekshirgiz

## 📊 Tegishli Fayllar

- `appadmin.js` - Admin mahsulot paneli JavaScript
- `admin-orders.js` - Admin buyurtma paneli JavaScript
- `bot.js` - Asosiy server va Telegram bot
- `lib/db.js` - Database abstraksiya qatlami
- `mainadmin.css` - Admin panel stillar
- `notify.js` - Toast bildirishnomalar

## 🔄 Auto-Refresh

Buyurtmalar paneli har 12 soniyada avtomatik yangilanadi - yangi buyurtmalar darhol koʻrinadi!

## 💡 Maslahatlar

1. **Parolni Oʻzgartirish**: `.env` faylidagi `ADMIN_PASSWORD` oʻzgartiring
2. **MongoDB Qoʻshish**: `MONGODB_URI` oʻrnatib, produktiv saqlashga oʻtish
3. **Telegram Bildirishnomalar**: `BOT_TOKEN` va `WORKER_CHAT_IDS` oʻrnatib, bugungi fayllar haqida xabar olish

## 📞 Qoʻllab-Quvvatlash

Agar muammolar boʻlsa:
1. Browser konsolida xatolarni koʻrgiz (`F12`)
2. Server terminalida logglarni tekshirgiz
3. `.env` faylidagi barcha parametrlarni tekshirgiz
4. MongoDB ulanishini tekshirgiz (agar qoʻllanilsa)

---

**Versiya**: 2.0  
**Yakuniy Yangilanish**: 2026-01-15
