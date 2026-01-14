const { getCategories } = require('../../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const cats = await getCategories();
    res.status(200).json(cats || []);
  } catch (err) {
    console.error('GET /api/products/categories error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};