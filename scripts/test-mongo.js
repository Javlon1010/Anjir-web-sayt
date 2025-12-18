require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    const uri = process.env.MONGODB_URI;
    console.log('URI exists:', !!uri);
    if (!uri) {
      console.error('❌ MONGODB_URI is not set in your environment. Create .env or set the env var (copy .env.example).');
      process.exit(1);
    }

    // show only prefix and host (mask sensitive parts)
    const prefix = uri.split('://')[0];
    const host = (uri.split('@').pop() || uri).split('?')[0];
    console.log('URI prefix:', prefix);
    console.log('URI host (masked):', host.replace(/:[^@]+@/, ':****@'));

    if (!/^mongodb(\+srv)?:\/\//i.test(uri)) {
      console.error('❌ Invalid URI: it should start with mongodb:// or mongodb+srv://');
      process.exit(1);
    }

    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('✅ MongoDB connected');
    await mongoose.disconnect();
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);

    // Print Node/OpenSSL info for diagnosis
    console.error('\n=== Diagnostic info ===');
    console.error('Node version:', process.versions.node);
    console.error('OpenSSL version:', process.versions.openssl);
    console.error('Error:');
    console.error(msg);

    // Extra TLS-related hint and an optional insecure retry for debugging
    if (/TLSV1_ALERT_INTERNAL_ERROR|TLS alert number 80|TLSV1_ALERT/.test(msg) || /TLSV1/.test(msg)) {
      console.error('\nHint: TLS handshake failed (TLS alert). This can be caused by:');
      console.error('- Outdated Node/OpenSSL that does not support required TLS version.');
      console.error('- Corporate proxy / antivirus intercepting TLS (MITM).');
      console.error('- DNS SRV issues with mongodb+srv URIs.');
      console.error('\nAttempting a temporary insecure retry (tlsAllowInvalidCertificates=true) to determine if this is a certificate validation issue...');

      try {
        await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true, tlsAllowInvalidCertificates: true, tlsInsecure: true });
        console.log('\n✅ Connected with tlsAllowInvalidCertificates=true (INSECURE, for debug only)');
        await mongoose.disconnect();
        console.error('\nResult: certificate validation likely the issue. Revert this setting and fix certificate/trust or network/proxy.');
      } catch (err2) {
        console.error('\nRetry with insecure TLS also failed:');
        console.error(err2 && err2.message ? err2.message : err2);
        console.error('\nSuggestion: check Node/OpenSSL version and try connecting from another network or using MongoDB Compass/mongosh to see if connection works there.');
      }

      process.exit(1);
    }

    // Provide helpful suggestions for other errors
    console.error('\nConnection error (do NOT paste your full URI):');
    console.error(msg);

    if (/ECONNREFUSED/.test(msg) && /:80/.test(msg)) {
      console.error('Hint: It looks like the client tried to connect to port 80 — check that your URI does not start with http:// and that the host is correct.');
    } else if (/ENOTFOUND|getaddrinfo/i.test(msg)) {
      console.error('Hint: Host not found — check cluster host/connection string (mongodb+srv requires SRV DNS).');
    } else if (/auth/i.test(msg) || /Authentication failed/i.test(msg)) {
      console.error('Hint: Authentication failed — verify username/password and user role (readWrite).');
    } else if (/timed out|ETIMEDOUT/i.test(msg)) {
      console.error('Hint: Connection timed out — check IP whitelist and network access in Atlas.');
    }

    process.exit(1);
  }
})();
