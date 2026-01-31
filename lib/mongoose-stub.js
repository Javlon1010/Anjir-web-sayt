// Mongoose stub - MongoDB is disabled. Using filesystem (JSON files) instead.

async function connect() {
  const MONGO_URI = process.env.MONGODB_URI || null;
  if (!MONGO_URI) {
    throw new Error('MONGODB_URI is not set — MongoDB disabled. Using filesystem fallback (products.json, orders.json).');
  }
  throw new Error('MongoDB support requires mongoose package. Reinstall with: npm install mongoose mongodb');
}

module.exports = { connect };
