const { useMongo } = require('../lib/db');
const { connect } = require('../lib/mongoose');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!useMongo) return res.status(200).json({ ok: false, message: 'MongoDB disabled (MONGODB_URI not set)' });
    try {
      await connect();
      return res.json({ ok: true, message: 'MongoDB connection OK' });
    } catch (err) {
      console.error('GET /api/db-test error:', err);
      return res.status(500).json({ ok: false, message: err && err.message ? err.message : 'Connection failed' });
    }
  } catch (err) {
    console.error('GET /api/db-test unexpected error:', err);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
};