const fs = require('fs').promises;
const path = require('path');
const { connect } = require('./mongoose');

const PRODUCTS_FILE = path.join(__dirname, '..', 'products.json');
const ORDERS_FILE = path.join(__dirname, '..', 'orders.json');
const COUNTERS_FILE = path.join(__dirname, '..', 'counters.json');

const useMongo = !!process.env.MONGODB_URI && /^mongodb(\+srv)?:\/\//i.test(process.env.MONGODB_URI);
const readOnlyFiles = false; // Set to true if filesystem is read-only

let ProductModel = null;
let OrderModel = null;

async function ensureModels() {
  if (!useMongo) return;
  if (!ProductModel) {
    await connect();
    ProductModel = require('../models/Product');
    OrderModel = require('../models/Order');
  }
}

// ---- File helpers ----
async function readJSON(file, defaultValue) {
  try {
    const txt = await fs.readFile(file, 'utf-8');
    return JSON.parse(txt);
  } catch (err) {
    return defaultValue;
  }
}

async function writeJSON(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf-8');
}

// Counters for order ids
async function getNextOrderIdFile() {
  const counters = await readJSON(COUNTERS_FILE, { orderSeq: Date.now() });
  counters.orderSeq = (counters.orderSeq || Date.now()) + 1;
  await writeJSON(COUNTERS_FILE, counters);
  return counters.orderSeq;
}

// ---- Products ----
async function getProducts({ category, q } = {}) {
  if (useMongo) {
    await ensureModels();
    const filter = {};
    if (category) filter.category = category;
    if (q) filter.name = { $regex: q, $options: 'i' };
    return ProductModel.find(filter).sort({ createdAt: -1 }).lean();
  }

  const products = await readJSON(PRODUCTS_FILE, []);
  let out = products.slice().reverse().map(p => ({
    // normalize to match both frontend and legacy usage
    id: p.id,
    name: p.name,
    price: p.price,
    image: p.image,
    category: p.category,
    stock: typeof p.stock !== 'undefined' ? p.stock : (p.quantity || 0),
    quantity: typeof p.stock !== 'undefined' ? p.stock : (p.quantity || 0),
    outOfStock: (typeof p.stock !== 'undefined' ? p.stock : (p.quantity || 0)) <= 0,
    sold: p.sold || 0,
    createdAt: p.createdAt || null,
    updatedAt: p.updatedAt || null
  }));
  if (category) out = out.filter(p => p.category === category);
  if (q) out = out.filter(p => (p.name || '').toLowerCase().includes(q.toLowerCase()));
  return out;
}

async function getCategories() {
  if (useMongo) {
    await ensureModels();
    const cats = await ProductModel.distinct('category');
    return (cats || []).filter(Boolean);
  }
  const products = await readJSON(PRODUCTS_FILE, []);
  return Array.from(new Set(products.map(p => p.category).filter(Boolean)));
}

async function addProduct({ name, price, image, category, stock = 35 }) {
  if (!name || !price || !image || !category) throw new Error("Missing fields");
  if (useMongo) {
    await ensureModels();
    const p = new ProductModel({ id: Date.now(), name, price, image, category, stock, sold: 0 });
    return p.save();
  }
  const products = await readJSON(PRODUCTS_FILE, []);
  const newProduct = { id: Date.now(), name, price, image, category, stock, sold: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  products.push(newProduct);
  await writeJSON(PRODUCTS_FILE, products);
  return newProduct;
}

async function deleteProduct(id) {
  if (useMongo) {
    await ensureModels();
    await ProductModel.findOneAndDelete({ id: Number(id) });
    return;
  }
  const products = await readJSON(PRODUCTS_FILE, []);
  const out = products.filter(p => Number(p.id) !== Number(id));
  await writeJSON(PRODUCTS_FILE, out);
}

async function editProduct({ id, name, price, image, category, stock }) {
  if (useMongo) {
    await ensureModels();
    const update = {};
    if (name) update.name = name;
    if (price) update.price = price;
    if (image) update.image = image;
    if (category) update.category = category;
    if (typeof stock !== 'undefined') update.stock = Number(stock);
    return ProductModel.findOneAndUpdate({ id: Number(id) }, update, { new: true });
  }
  const products = await readJSON(PRODUCTS_FILE, []);
  const idx = products.findIndex(p => Number(p.id) === Number(id));
  if (idx === -1) return null;
  const p = products[idx];
  if (name) p.name = name;
  if (price) p.price = price;
  if (image) p.image = image;
  if (category) p.category = category;
  if (typeof stock !== 'undefined') p.stock = Number(stock);
  p.updatedAt = new Date().toISOString();
  products[idx] = p;
  await writeJSON(PRODUCTS_FILE, products);
  return p;
}

async function getProductById(id) {
  if (useMongo) {
    await ensureModels();
    return ProductModel.findOne({ id: Number(id) }).lean();
  }
  const products = await readJSON(PRODUCTS_FILE, []);
  const p = products.find(p => Number(p.id) === Number(id)) || null;
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    image: p.image,
    category: p.category,
    stock: typeof p.stock !== 'undefined' ? p.stock : (p.quantity || 0),
    quantity: typeof p.stock !== 'undefined' ? p.stock : (p.quantity || 0),
    outOfStock: (typeof p.stock !== 'undefined' ? p.stock : (p.quantity || 0)) <= 0,
    sold: p.sold || 0,
    createdAt: p.createdAt || null,
    updatedAt: p.updatedAt || null
  };
}

// ---- Orders ----
async function getOrders() {
  if (useMongo) {
    await ensureModels();
    return OrderModel.find().sort({ createdAt: -1 }).lean();
  }
  let orders = await readJSON(ORDERS_FILE, []);
  if (!Array.isArray(orders) && orders && Array.isArray(orders.orders)) orders = orders.orders;
  if (!Array.isArray(orders)) orders = [];
  return orders;
}

async function getOrderById(id) {
  if (useMongo) {
    await ensureModels();
    return OrderModel.findOne({ id: Number(id) }).lean();
  }
  const orders = await readJSON(ORDERS_FILE, []);
  return orders.find(o => Number(o.id) === Number(id)) || null;
}

async function addOrder({ name, phone, address, cart, total, location = null }) {
  if (!name || !phone || !address || !cart || cart.length === 0) throw new Error('Invalid order');

  if (useMongo) {
    await ensureModels();

    // Check stock
    for (const item of cart) {
      const prod = await ProductModel.findOne({ id: Number(item.id) });
      if (!prod) throw new Error(`Product not found: ${item.id}`);
      const qty = Number(item.quantity) || 1;
      if (prod.stock < qty) throw new Error(`Insufficient stock for ${item.name}`);
    }

    for (const item of cart) {
      const qty = Number(item.quantity) || 1;
      await ProductModel.findOneAndUpdate({ id: Number(item.id) }, { $inc: { stock: -qty, sold: qty } });
    }

    const orderId = Date.now();
    const orderDoc = new OrderModel({ id: orderId, name, phone, address, cart, total, status: 'Yangi', date: new Date(), location });
    await orderDoc.save();
    return orderDoc;
  }

  // File-based order flow
  const products = await readJSON(PRODUCTS_FILE, []);
  // validate stock
  for (const item of cart) {
    const p = products.find(px => Number(px.id) === Number(item.id));
    if (!p) throw new Error(`Mahsulot topilmadi: ${item.name}`);
    const qty = Number(item.quantity) || 1;
    if (p.stock < qty) throw new Error(`"${item.name}" uchun qolgan stock yetarli emas. Qolgan: ${p.stock}`);
  }

  // decrement stock
  for (const item of cart) {
    const p = products.find(px => Number(px.id) === Number(item.id));
    const qty = Number(item.quantity) || 1;
    p.stock = (p.stock || 0) - qty;
    p.sold = (p.sold || 0) + qty;
  }
  await writeJSON(PRODUCTS_FILE, products);

  // create order id using counters file
  const orderId = await getNextOrderIdFile();
  let orders = await readJSON(ORDERS_FILE, []);
  if (!Array.isArray(orders) && orders && Array.isArray(orders.orders)) orders = orders.orders;
  if (!Array.isArray(orders)) orders = [];
  const order = { id: orderId, orderNumber: orderId, name, phone, address, cart: cart.map(it => ({ ...it, status: '' })), total, status: 'Yangi', date: new Date().toISOString(), createdAt: new Date().toISOString(), location };
  orders.push(order);
  await writeJSON(ORDERS_FILE, orders);
  return order;
}

async function updateOrderStatus(id, status) {
  if (useMongo) {
    await ensureModels();
    return OrderModel.findOneAndUpdate({ id: Number(id) }, { status }, { new: true });
  }
  const orders = await readJSON(ORDERS_FILE, []);
  const idx = orders.findIndex(o => Number(o.id) === Number(id));
  if (idx === -1) return null;
  orders[idx].status = status;
  await writeJSON(ORDERS_FILE, orders);
  return orders[idx];
}

async function updateOrderItemStatus(orderId, itemIdxOrId, status) {
  // Normalize: status may be 'delivered', 'not_found', or '' to clear
  if (useMongo) {
    await ensureModels();
    const order = await OrderModel.findOne({ id: Number(orderId) });
    if (!order) return null;
    let item = null;
    if (typeof itemIdxOrId === 'number') item = order.cart[itemIdxOrId];
    else item = order.cart.find(i => Number(i.id) === Number(itemIdxOrId));
    if (!item) return null;

    // Delivered is final: if already delivered, do not allow changes
    if (status === 'delivered') {
      if (item.status === 'delivered') return { order, item, already: true };
      item.status = 'delivered';
    } else if (status === 'not_found') {
      // toggle not_found when requested
      item.status = item.status === 'not_found' ? '' : 'not_found';
    } else {
      // allow clearing status when status === ''
      if (item.status === 'delivered') return { order, item, already: true };
      item.status = '';
    }

    await order.save();

    // If all resolved mark completed
    const allResolved = order.cart.every(i => i.status === 'delivered' || i.status === 'not_found');
    if (allResolved) {
      order.status = 'Tugallandi';
      order.isCompleted = true;
      order.completedAt = new Date();
      await order.save();
    }

    return { order, item };
  }

  let orders = await readJSON(ORDERS_FILE, []);
  if (!Array.isArray(orders) && orders && Array.isArray(orders.orders)) orders = orders.orders;
  if (!Array.isArray(orders)) orders = [];

  const idx = orders.findIndex(o => Number(o.id) === Number(orderId));
  if (idx === -1) return null;
  const order = orders[idx];
  let item = null;
  if (typeof itemIdxOrId === 'number') item = order.cart[itemIdxOrId];
  else item = order.cart.find(i => Number(i.id) === Number(itemIdxOrId));
  if (!item) return null;

  if (status === 'delivered') {
    if (item.status === 'delivered') return { order, item, already: true };
    item.status = 'delivered';
  } else if (status === 'not_found') {
    item.status = item.status === 'not_found' ? '' : 'not_found';
  } else {
    if (item.status === 'delivered') return { order, item, already: true };
    item.status = '';
  }

  // check all resolved
  const allResolved = order.cart.every(i => i.status === 'delivered' || i.status === 'not_found');
  if (allResolved) {
    order.status = 'Tugallandi';
    order.isCompleted = true;
    order.completedAt = new Date().toISOString();
  }
  await writeJSON(ORDERS_FILE, orders);
  return { order, item };
} 

// Complete order (used by admin endpoint)
async function completeOrder(orderId) {
  if (useMongo) {
    await ensureModels();
    const order = await OrderModel.findOne({ id: Number(orderId) });
    if (!order) throw new Error('Buyurtma topilmadi');
    if (order.isCompleted) return order;

    // Don't decrement here — stock was adjusted when order was placed. Just update outOfStock flags.
    for (const item of order.cart) {
      const p = await ProductModel.findOne({ id: item.id });
      if (p) {
        const currentQty = (typeof p.quantity !== 'undefined') ? p.quantity : (typeof p.stock !== 'undefined' ? p.stock : 0);
        p.outOfStock = (currentQty || 0) <= 0;
        await p.save();
      }
    }

    order.isCompleted = true;
    order.completedAt = new Date();
    await order.save();
    return order;
  }

  // Prevent completing orders on read-only deployments
  if (readOnlyFiles) throw new Error('Read-only deployment: cannot complete orders on read-only filesystem. Set MONGODB_URI to enable persistence.');
  const orders = await readJSON(ORDERS_FILE, []);
  const idx = orders.findIndex(o => Number(o.id) === Number(orderId));
  if (idx === -1) throw new Error('Buyurtma topilmadi');

  const order = orders[idx];
  if (order.isCompleted) return order;

  const products = await readJSON(PRODUCTS_FILE, []);

  // Don't decrement here — stock was adjusted when order was placed. Just update outOfStock flags.
  for (const item of order.cart) {
    const p = products.find(px => Number(px.id) === Number(item.id));
    if (p) {
      if (typeof p.stock === 'undefined' && typeof p.quantity !== 'undefined') p.stock = p.quantity;
      p.outOfStock = (p.stock || 0) <= 0;
    }
  }

  order.isCompleted = true;
  order.completedAt = new Date().toISOString();
  await writeJSON(ORDERS_FILE, orders);
  await writeJSON(PRODUCTS_FILE, products);
  return order;
}

function isReadOnly() { return !!readOnlyFiles; }

module.exports = {
  useMongo,
  getProducts,
  getCategories,
  addProduct,
  deleteProduct,
  editProduct,
  getProductById,
  getOrders,
  addOrder,
  updateOrderStatus,
  updateOrderItemStatus,
  completeOrder,
  isReadOnly
};
