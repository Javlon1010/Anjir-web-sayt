const { editProduct } = require('../../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let { id, name, price, image, category, stock } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });

    const product = await editProduct({ id, name, price, image, category, stock });

    if (!product) return res.status(404).json({ error: 'Mahsulot topilmadi' });

    res.status(200).json({ success: true, product });
  } catch (err) {
    console.error('POST /api/products/edit error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
