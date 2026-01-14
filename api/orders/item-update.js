const fetch = require('node-fetch');
const { updateOrderItemStatus, getOrderById } = require('../../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orderId, itemId, status } = req.body;
    const result = await updateOrderItemStatus(orderId, Number(itemId), status);
    if (!result) return res.status(404).json({ error: 'Buyurtma yoki mahsulot topilmadi' });

    const { order, item } = result;

    res.json({ success: true, itemStatus: item.status, already: !!result.already, item: { name: item.name } });

    // Notify admin via Telegram (best-effort)
    try {
      const TOKEN = process.env.BOT_TOKEN;
      const CHAT_ID = process.env.WORKER_CHAT_IDS ? (process.env.WORKER_CHAT_IDS.split(',')[0] || null) : null;
      if (TOKEN && CHAT_ID) {
        const itext = `🔁 Buyurtma ${order.id} — mahsulot holati yangilandi\nMahsulot: ${item.name}\nHolat: ${item.status}`;
        await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: CHAT_ID, text: itext, parse_mode: 'HTML' }) });
      }
    } catch (err) { console.error('Telegram notify item status error:', err); }

    // If order completed, notify admin too
    if (order.status === 'Tugallandi') {
      try {
        const TOKEN = process.env.BOT_TOKEN;
        const CHAT_ID = process.env.WORKER_CHAT_IDS ? (process.env.WORKER_CHAT_IDS.split(',')[0] || null) : null;
        if (TOKEN && CHAT_ID) {
          const completeText = `✅ Buyurtma ${order.id} tugallandi\nMijoz: ${order.name} | ${order.phone} | ${order.address}`;
          await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: CHAT_ID, text: completeText, parse_mode: 'HTML' }) });
        }
      } catch (err) { console.error('Telegram notify complete error:', err); }
    }

  } catch (err) {
    console.error('POST /api/orders/item-update error:', err);
    if (err && err.message && err.message.includes('Read-only deployment')) return res.status(501).json({ error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
};