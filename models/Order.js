const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  id: Number,
  name: String,
  price: String,
  image: String,
  category: String,
  quantity: { type: Number, default: 1 },
  status: { type: String, enum: ['', 'delivered', 'not_found'], default: '' }
});

const orderSchema = new mongoose.Schema({
  id: { type: Number, unique: true, required: true },
  name: String,
  phone: String,
  address: String,
  cart: [itemSchema],
  total: Number,
  status: { type: String, default: 'Yangi' },
  date: String,
  location: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
