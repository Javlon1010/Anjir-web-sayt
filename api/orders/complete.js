const { connect } = require('../../lib/mongoose');
const Order = require('../../models/Order');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: "Buyurtma ID si ko'rsatilmagan" });
    }

    await connect();
    const order = await Order.findOne({ id: orderId });
    
    if (!order) {
      return res.status(404).json({ error: 'Buyurtma topilmadi' });
    }

    // Complete the order and update product quantities
    await order.completeOrder();
    
    res.status(200).json({ 
      success: true, 
      message: 'Buyurtma muvaffaqiyatli yakunlandi',
      orderNumber: order.orderNumber
    });
  } catch (err) {
    console.error('POST /api/orders/complete error:', err);
    res.status(500).json({ 
      error: 'Buyurtmani yakunlashda xatolik yuz berdi',
      details: err.message 
    });
  }
};
