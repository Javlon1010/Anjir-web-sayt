const { connect } = require('../../lib/mongoose');
const Product = require('../../models/Product');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, price, image, category, quantity } = req.body;
    if (!name || !price || !image || !category || quantity === undefined) {
      return res.status(400).json({ error: "Barcha maydonlarni to'ldiring" });
    }

    const quantityNum = parseInt(quantity, 10);
    if (isNaN(quantityNum) || quantityNum < 0) {
      return res.status(400).json({ error: "Noto'g'ri miqdor kiritildi" });
    }

    await connect();
    const newProduct = new Product({ 
      id: Date.now(), 
      name, 
      price, 
      image, 
      category,
      quantity: quantityNum,
      outOfStock: quantityNum <= 0
    });
    await newProduct.save();

    res.status(201).json({ success: true, product: newProduct });
  } catch (err) {
    console.error('POST /api/products/add error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
