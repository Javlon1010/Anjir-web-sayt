const { updateOrderStatus } = require('../../../../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orderId } = req.query;
    const { status } = req.body;
    const order = await updateOrderStatus(orderId, status);
    if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });
    res.json({ success: true, order });
  } catch (err) {
    console.error('PUT /api/orders/[orderId]/status error:', err);
    if (err && err.message && err.message.includes('Read-only deployment')) return res.status(501).json({ error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
};