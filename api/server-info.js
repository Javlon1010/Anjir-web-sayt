const { useMongo, isReadOnly } = require('../lib/db');
const { connect } = require('../lib/mongoose');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const info = { useMongo: !!useMongo, readOnlyFiles: !!isReadOnly(), dbConnected: null, dbError: null };
    if (useMongo) {
      try {
        await connect();
        info.dbConnected = true;
      } catch (err) {
        info.dbConnected = false;
        info.dbError = err && err.message ? err.message : String(err);
      }
    }
    return res.json(info);
  } catch (err) {
    console.error('GET /api/server-info error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};