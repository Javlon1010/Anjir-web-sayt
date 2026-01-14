const { deleteProduct } = require('../../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.body;
    if (typeof id === 'undefined') return res.status(400).json({ error: 'id required' });

    await deleteProduct(id);

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('POST /api/products/delete error:', err);
    if (err && err.message && err.message.includes('Read-only deployment')) {
      return res.status(501).json({ error: err.message });
    }
    res.status(500).json({ error: 'Server error' });
  }
};
