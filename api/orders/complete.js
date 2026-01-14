const { completeOrder } = require('../../lib/db');

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

    const order = await completeOrder(orderId);

    res.status(200).json({ 
      success: true, 
      message: 'Buyurtma muvaffaqiyatli yakunlandi',
      orderNumber: order.orderNumber || order.id
    });
  } catch (err) {
    console.error('POST /api/orders/complete error:', err);
    if (err && err.message && err.message.includes('Read-only deployment')) {
      return res.status(501).json({ error: err.message });
    }
    res.status(500).json({ 
      error: 'Buyurtmani yakunlashda xatolik yuz berdi',
      details: err.message 
    });
  }
};
