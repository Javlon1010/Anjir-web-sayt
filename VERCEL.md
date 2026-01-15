Deploying to Vercel — quick notes

## 1) Environment Variables
In Vercel dashboard (Project > Settings > Environment Variables) add:
- `MONGODB_URI` = your connection string (do NOT commit this to Git)
- `ADMIN_PASSWORD` = your admin password (default: `12`)
- `BOT_TOKEN` = your Telegram bot token (optional)
- `WORKER_CHAT_IDS` = comma-separated Telegram chat IDs (optional)

## 2) API Structure
Serverless API endpoints live in `api/` (already added):
- `GET /api/products` -> `api/products/index.js`
- `POST /api/products/add` -> `api/products/add.js` (requires password)
- `POST /api/products/delete` -> `api/products/delete.js` (requires password)
- `POST /api/products/edit` -> `api/products/edit.js` (requires password)
- `GET /api/orders` -> `api/orders/index.js`
- `POST /api/orders/update` -> `api/orders/update.js` (requires password)
- `POST /api/orders/complete` -> `api/orders/complete.js` (requires password)
- `POST /api/orders/item-update` -> `api/orders/item-update.js` (requires password)

## 3) Local Testing
```bash
# Run the development server
npm start

# Or with nodemon for auto-reload
npm run dev
```

## 4) Password Protection
All write operations (POST, PUT, DELETE) require:
```
Header: x-admin-password: [your password from ADMIN_PASSWORD env var]
```

The frontend admin panels (`indexAdmin.html` and `index7.html`) will prompt for the password on page load.

## 5) Important Notes
- `lib/mongoose.js` uses a connection cache to avoid multiple connections on serverless platforms.
- The project no longer defaults to a local MongoDB. If `MONGODB_URI` is not set, the app falls back to filesystem storage using `products.json` and `orders.json`.
- **IMPORTANT**: On Vercel and other serverless providers the filesystem is read-only — write operations (add/edit/delete products, update orders) will fail. In this case the admin UI will be disabled for write actions and show a message instructing you to set `MONGODB_URI` to enable persistence.

## 6) Migration to MongoDB
To migrate existing local data to MongoDB (recommended):
1. Create a MongoDB database (e.g., Atlas free tier) and obtain the `MONGODB_URI` connection string.
2. In your local shell set `MONGODB_URI` and run the migration script:
   ```bash
   export MONGODB_URI="mongodb+srv://..."
   npm run migrate:to-mongo
   # Or on Windows PowerShell:
   $env:MONGODB_URI='mongodb+srv://...'
   npm run migrate:to-mongo
   ```
   - Use `--dry-run` to preview or `--force` to overwrite existing records.
3. Once imported, add `MONGODB_URI` to your Vercel Project > Settings > Environment Variables and redeploy.

## 7) Security Notes
- **Do NOT put real credentials in `.env.example`**. Copy `.env.example` to `.env` and fill in your real values there. `.env` is ignored by git in this project.
- All admin operations require the `ADMIN_PASSWORD` from environment variables.
- Make sure the `MONGODB_URI` has access to your IPs if using a self-hosted database or correct whitelist settings on Atlas.

## 8) Deployment Checklist
- [ ] Set `MONGODB_URI` in Vercel environment variables
- [ ] Set `ADMIN_PASSWORD` in Vercel environment variables (e.g., `12`)
- [ ] Set `BOT_TOKEN` if using Telegram notifications (optional)
- [ ] Set `WORKER_CHAT_IDS` if using Telegram notifications (optional)
- [ ] Test admin panel: http://yourdomain.com/indexAdmin.html
- [ ] Test orders panel: http://yourdomain.com/index7.html
- [ ] Verify product add/edit/delete works
- [ ] Verify order status updates work
- [ ] Check Telegram notifications (if enabled)

## 9) Troubleshooting
- **"Password incorrect"** - Check `ADMIN_PASSWORD` in Vercel environment variables matches frontend
- **"Write operations fail"** - Make sure `MONGODB_URI` is set in Vercel
- **"MongoDB connection refused"** - Check IP whitelist on MongoDB Atlas
- **"Telegram notifications not working"** - Verify `BOT_TOKEN` and `WORKER_CHAT_IDS` are correct

---

**Last Updated**: 2026-01-15

