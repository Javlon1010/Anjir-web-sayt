const { updateOrderStatus } = require('../../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id, status } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });

    const order = await updateOrderStatus(id, status);
    if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });
    res.json({ success: true, order });
  } catch (err) {
    console.error('POST /api/orders/update error:', err);
    if (err && err.message && err.message.includes('Read-only deployment')) return res.status(501).json({ error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
};