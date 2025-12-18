const mongoose = require('mongoose');

// Serverless-friendly mongoose connection caching
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/anjir';

if (!process.env.MONGODB_URI) {
  console.warn('⚠️ MONGODB_URI is not set in environment. Using default local URI.');
}

// Basic validation: ensure URI starts with mongodb:// or mongodb+srv://
if (MONGO_URI && !/^mongodb(\+srv)?:\/\//i.test(MONGO_URI)) {
  console.error('❌ MONGODB_URI looks invalid. It must start with "mongodb://" or "mongodb+srv://".');
}

let cached = global._mongoose;

if (!cached) {
  cached = global._mongoose = { conn: null, promise: null };
}

async function connect() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    };

    cached.promise = mongoose.connect(MONGO_URI, opts)
      .catch((err) => {
        // Provide actionable hints
        const msg = err && err.message ? err.message : String(err);
        console.error('MongoDB connection failed:', msg);

        if (/^http/i.test(MONGO_URI)) {
          console.error('Hint: Your URI starts with http(s):// — it should start with mongodb:// or mongodb+srv://');
        } else if (/ECONNREFUSED/.test(msg) && /:80/.test(msg)) {
          console.error('Hint: connection refused on port 80 — check that your URI is not using http:// and that host is correct');
        } else if (/ENOTFOUND|getaddrinfo/.test(msg)) {
          console.error('Hint: Host not found — check your cluster host name and DNS (mongodb+srv requires SRV DNS entries)');
        } else if (/authentication|auth failed|Authentication failed/i.test(msg)) {
          console.error('Hint: Authentication failed — check username/password and user roles (readWrite)');
        }

        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = { connect };
