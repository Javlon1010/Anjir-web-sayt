// Mongoose stub - MongoDB is disabled by default
// App uses filesystem (products.json, orders.json) instead

async function connect() {
  const MONGO_URI = process.env.MONGODB_URI || null;
  if (!MONGO_URI) {
    throw new Error('MONGODB_URI not set - using filesystem fallback');
  }
  throw new Error('MongoDB support requires: npm install mongoose mongodb');
}

module.exports = { connect };