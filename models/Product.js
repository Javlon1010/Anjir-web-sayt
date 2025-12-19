const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  id: { type: Number, unique: true, required: true },
  name: { type: String, required: true },
  price: { type: String, required: true },
  image: { type: String, required: true },
  category: { type: String, required: true },
  quantity: { type: Number, required: true, default: 0 },
  outOfStock: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);
