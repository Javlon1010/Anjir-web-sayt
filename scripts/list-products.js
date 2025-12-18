require('dotenv').config();
const { connect } = require('../lib/mongoose');
const Product = require('../models/Product');

(async () => {
  try {
    await connect();
    const count = await Product.countDocuments();
    console.log('Products in DB:', count);
    const recent = await Product.find().sort({ createdAt: -1 }).limit(10);
    console.log('Recent products (ids):', recent.map(p => ({ id: p.id, name: p.name })));
    process.exit(0);
  } catch (err) {
    console.error('Error listing products:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();