const { useMongo, isReadOnly } = require('../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    res.json({ useMongo: !!useMongo, readOnlyFiles: !!isReadOnly() });
  } catch (err) {
    console.error('GET /api/server-info error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};