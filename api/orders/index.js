const { getOrders } = require('../../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { completed } = req.query;
    let orders = await getOrders();
    if (typeof completed !== 'undefined') {
      const wantCompleted = completed === 'true' || completed === '1';
      orders = (orders || []).filter(o => Boolean(o.isCompleted) === wantCompleted || (wantCompleted ? (o.status === 'Tugallandi' || o.status === 'Yetkazib berildi' || o.isCompleted) : (!o.isCompleted && o.status !== 'Tugallandi')));
    }
    res.json(orders || []);
  } catch (err) {
    console.error('GET /api/orders error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};