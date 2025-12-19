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

// Generate order number
const getNextOrderNumber = async function() {
  const result = await this.constructor.findOne({}, {}, { sort: { 'orderNumber': -1 } });
  return result ? result.orderNumber + 1 : 1;
};

const orderSchema = new mongoose.Schema({
  id: { type: Number, unique: true, required: true },
  orderNumber: { type: Number, unique: true },
  name: String,
  phone: String,
  address: String,
  cart: [itemSchema],
  total: Number,
  status: { 
    type: String, 
    enum: ['Yangi', 'Qabul qilindi', 'Yetkazilmoqda', 'Yetkazib berildi', 'Bekor qilindi'],
    default: 'Yangi' 
  },
  date: { type: Date, default: Date.now },
  location: { type: String, default: '' },
  isCompleted: { type: Boolean, default: false },
  completedAt: { type: Date }
}, { timestamps: true });

// Add pre-save hook to set order number
orderSchema.pre('save', async function(next) {
  if (this.isNew) {
    this.orderNumber = await getNextOrderNumber.call(this);
  }
  next();
});

// Method to complete an order and update product quantities
orderSchema.methods.completeOrder = async function() {
  if (this.isCompleted) return;
  
  // Update product quantities
  for (const item of this.cart) {
    await mongoose.model('Product').updateOne(
      { id: item.id },
      { 
        $inc: { quantity: -item.quantity },
        $set: { 
          outOfStock: { $lte: [ { $subtract: ['$quantity', item.quantity] }, 0 ] } 
        }
      }
    );
  }
  
  this.isCompleted = true;
  this.completedAt = new Date();
  await this.save();
};

// Add static method to get active orders
orderSchema.statics.getActiveOrders = function() {
  return this.find({ isCompleted: false }).sort({ createdAt: -1 });
};

// Add static method to get completed orders
orderSchema.statics.getCompletedOrders = function() {
  return this.find({ isCompleted: true }).sort({ completedAt: -1 });
};

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
