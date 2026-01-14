#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { connect } = require('../lib/mongoose');
const Product = require('../models/Product');
const Order = require('../models/Order');

async function fileExists(p) {
  try { await fs.access(p); return true; } catch (e) { return false; }
}

async function readJSON(file, def = []) {
  try {
    const txt = await fs.readFile(file, 'utf8');
    return JSON.parse(txt);
  } catch (err) { return def; }
}

async function upsertProducts(products, { force = false } = {}) {
  let added = 0, updated = 0;
  for (const p of products) {
    const doc = {
      id: Number(p.id || p.id || Date.now()),
      name: p.name,
      price: p.price,
      image: p.image,
      category: p.category,
      quantity: typeof p.stock !== 'undefined' ? Number(p.stock) : (typeof p.quantity !== 'undefined' ? Number(p.quantity) : 0),
      outOfStock: (typeof p.stock !== 'undefined' ? Number(p.stock) : (typeof p.quantity !== 'undefined' ? Number(p.quantity) : 0)) <= 0
    };

    const existing = await Product.findOne({ id: doc.id }).lean();
    if (!existing) {
      await Product.create(doc);
      added++;
    } else if (force) {
      await Product.findOneAndUpdate({ id: doc.id }, doc, { new: true });
      updated++;
    }
  }
  return { added, updated };
}

async function upsertOrders(orders, { force = false } = {}) {
  let added = 0, updated = 0;
  for (const o of orders) {
    const doc = {
      id: Number(o.id || o.orderNumber || Date.now()),
      orderNumber: Number(o.orderNumber || o.id || Date.now()),
      name: o.name,
      phone: o.phone,
      address: o.address,
      cart: (o.cart || []).map(it => ({ id: it.id, name: it.name, price: it.price, image: it.image, category: it.category, quantity: Number(it.quantity)||1, status: it.status || '' })),
      total: Number(o.total || 0),
      status: o.status || 'Yangi',
      date: o.date ? new Date(o.date) : (o.createdAt ? new Date(o.createdAt) : new Date()),
      location: o.location || '',
      isCompleted: !!o.isCompleted
    };

    const existing = await Order.findOne({ id: doc.id }).lean();
    if (!existing) {
      await Order.create(doc);
      added++;
    } else if (force) {
      await Order.findOneAndUpdate({ id: doc.id }, doc, { new: true });
      updated++;
    }
  }
  return { added, updated };
}

(async function main() {
  try {
    const args = process.argv.slice(2);
    const force = args.includes('--force');
    const dry = args.includes('--dry-run');

    if (!process.env.MONGODB_URI) {
      console.error('MONGODB_URI is not set — aborting. Set MONGODB_URI and try again.');
      process.exit(2);
    }

    await connect();
    console.log('Connected to MongoDB');

    const productsFile = path.join(__dirname, '..', 'products.json');
    const ordersFile = path.join(__dirname, '..', 'orders.json');

    const products = (await readJSON(productsFile, [])).slice();
    const orders = (await readJSON(ordersFile, [])).slice();

    console.log(`Found ${products.length} products in ${productsFile}`);
    console.log(`Found ${orders.length} orders in ${ordersFile}`);

    if (dry) {
      console.log('Dry-run mode: no changes will be made. Use --force to update existing items.');
      process.exit(0);
    }

    const pRes = await upsertProducts(products, { force });
    const oRes = await upsertOrders(orders, { force });

    console.log(`Products: added=${pRes.added} updated=${pRes.updated}`);
    console.log(`Orders: added=${oRes.added} updated=${oRes.updated}`);

    console.log('Import complete.');
    process.exit(0);
  } catch (err) {
    console.error('Import failed:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();