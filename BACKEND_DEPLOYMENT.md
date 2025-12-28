# Backend Deployment Guide

## ⚠️ Important: Netlify Limitations

**Netlify Functions are NOT suitable for this backend** because:
- ❌ 10-second timeout (free tier) / 26 seconds (paid)
- ❌ No persistent database connections
- ❌ No background workers (BullMQ)
- ❌ No Server-Sent Events (SSE) support
- ❌ No Redis support
- ❌ No long-running processes

## ✅ Recommended: Keep Backend on Railway

Your backend is already deployed on Railway. This is the **best solution**:

### Current Setup (Recommended)
- **Frontend**: Netlify (https://stately-conkies-41d0db.netlify.app)
- **Backend**: Railway (https://laudable-creation-production.up.railway.app)

### Steps to Connect:

1. **Get your Railway backend URL:**
   - Go to Railway dashboard
   - Find your service URL (e.g., `https://laudable-creation-production.up.railway.app`)
   - Your API URL will be: `https://laudable-creation-production.up.railway.app/api`

2. **Set environment variable in Netlify:**
   - Go to Netlify dashboard → Your site → Site settings → Environment variables
   - Add: `VITE_API_URL` = `https://your-railway-url.railway.app/api`

3. **Update CORS in your backend:**
   - In Railway, add environment variable or update `server.js`:
   ```javascript
   const cors = require('cors');
   app.use(cors({
     origin: [
       'https://stately-conkies-41d0db.netlify.app',
       'https://6950cfc8d57c3ccaca1fb2e2--stately-conkies-41d0db.netlify.app',
       'http://localhost:5173'
     ],
     credentials: true
   }));
   ```

4. **Redeploy Netlify:**
   - After setting `VITE_API_URL`, trigger a new deployment

## Alternative: Netlify Functions (NOT RECOMMENDED)

If you still want to try Netlify Functions (with severe limitations):

### Setup Steps:

1. **Install Netlify CLI:**
   ```bash
   npm install -g netlify-cli
   ```

2. **Create Netlify Functions wrapper:**
   - Create `netlify/functions/api.js`
   - This would need to wrap your Express app
   - **Problem**: Your app uses SSE, workers, and persistent connections which won't work

3. **Limitations you'll face:**
   - SSE routes won't work (timeout)
   - Background workers won't work
   - Database connections will timeout
   - Queue processing won't work

### Why Railway is Better:

✅ **Railway Advantages:**
- Full Node.js environment
- Persistent connections
- Background workers
- SSE support
- Redis support
- No timeout limits
- PostgreSQL support
- Free tier available

## Current Architecture (Recommended)

```
┌─────────────────┐         ┌──────────────────┐
│   Netlify       │  ──────▶│    Railway       │
│   (Frontend)    │  API    │    (Backend)     │
│   React App     │  Calls  │    Express API   │
└─────────────────┘         └──────────────────┘
                                      │
                                      ▼
                            ┌──────────────────┐
                            │   PostgreSQL     │
                            │   Redis          │
                            └──────────────────┘
```

## Quick Setup Checklist

- [ ] Get Railway backend URL
- [ ] Set `VITE_API_URL` in Netlify environment variables
- [ ] Update CORS in backend to allow Netlify domain
- [ ] Redeploy Netlify frontend
- [ ] Test API connection

## Support

If you need help with Railway deployment or configuration, check:
- Railway Dashboard: https://railway.app
- Railway Docs: https://docs.railway.app

