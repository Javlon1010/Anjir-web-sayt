const { addProduct } = require('../../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Accept either `stock` (admin UI) or `quantity` (legacy)
    const { name, price, image, category } = req.body;
    const quantity = (typeof req.body.stock !== 'undefined') ? req.body.stock : req.body.quantity;

    if (!name || !price || !image || !category || quantity === undefined) {
      return res.status(400).json({ error: "Barcha maydonlarni to'ldiring" });
    }

    const quantityNum = parseInt(quantity, 10);
    if (isNaN(quantityNum) || quantityNum < 0) {
      return res.status(400).json({ error: "Noto'g'ri miqdor kiritildi" });
    }

    const product = await addProduct({ name, price, image, category, stock: quantityNum });

    res.status(201).json({ success: true, product });
  } catch (err) {
    console.error('POST /api/products/add error:', err);
    if (err && err.message && err.message.includes('Read-only deployment')) {
      return res.status(501).json({ error: err.message });
    }
    res.status(500).json({ error: 'Server error' });
  }
};
