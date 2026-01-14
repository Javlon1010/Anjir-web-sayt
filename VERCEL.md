Deploying to Vercel — quick notes

1) Env vars
- In Vercel dashboard (Project > Settings > Environment Variables) add:
  - `MONGODB_URI` = your connection string (do NOT commit this to Git)

2) API structure
- Serverless API endpoints live in `api/` (already added):
  - `GET /api/products` -> `api/products/index.js`
  - `POST /api/products/add` -> `api/products/add.js`
  - `POST /api/products/delete` -> `api/products/delete.js`
  - `POST /api/products/edit` -> `api/products/edit.js`

3) Local testing
- You can still run `node bot.js` locally (if you prefer running a single Express server) or test serverless routes with `vercel dev`.

4) Notes
- `lib/mongoose.js` uses a connection cache to avoid multiple connections on serverless platforms.
- The project no longer defaults to a local MongoDB. If `MONGODB_URI` is not set, the app falls back to filesystem storage using `products.json` and `orders.json`.
- Make sure the `MONGODB_URI` has access to your IPs if using a self-hosted database or correct whitelist settings on Atlas.

5) Security note
- **Do NOT put real credentials in `.env.example`**. Copy `.env.example` to `.env` and fill in your real `MONGODB_URI` there. `.env` is ignored by git in this project.
