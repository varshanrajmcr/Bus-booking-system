# Render Deployment Fix Guide

## Issues Fixed

1. ✅ Database connection now supports `DATABASE_URL` (Render's format)
2. ✅ Session pool updated to support `DATABASE_URL`
3. ✅ Redis connection handles missing Redis gracefully

## Environment Variables to Set in Render

### Step 1: Link PostgreSQL Database

1. In your Render web service → **Settings** → **Environment**
2. Click **"Link Resource"** → Select your PostgreSQL database
3. Render will automatically add `DATABASE_URL` ✅

**OR manually add:**

```
DATABASE_URL=postgres://user:password@host:port/database
```

### Step 2: Redis Configuration

**Option A: If you have Redis on Render**
1. Link Redis service (same as PostgreSQL)
2. Render will auto-add Redis variables

**Option B: If you DON'T have Redis (app will work without it)**
- Remove or don't set these variables:
  - `REDIS_HOST`
  - `REDIS_PORT`
  - `REDIS_PASSWORD`
  - `REDIS_URL`

The app will work without Redis (with warnings in logs, but won't crash).

**Option C: Use External Redis (Upstash, etc.)**
```
REDIS_URL=redis://:password@host:port
```

### Step 3: Application Variables

```
NODE_ENV=production
PORT=10000
```

**Note:** Render sets `PORT` automatically, but you can override.

### Step 4: Email Configuration (Optional)

```
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password
FROM_EMAIL=your-email@gmail.com
FROM_NAME=Bus Booking System
```

## Quick Checklist

- [ ] PostgreSQL database created on Render
- [ ] PostgreSQL linked to web service (adds `DATABASE_URL`)
- [ ] Redis configured (optional - app works without it)
- [ ] `NODE_ENV=production` set
- [ ] Email variables set (if using email)
- [ ] Remove any Railway-specific variables (`REDIS_HOST=redis.railway.internal`)

## Common Issues

### Issue: "database 'railway' does not exist"
**Solution:** Make sure `DATABASE_URL` is set from Render's PostgreSQL service, or remove `DB_NAME=railway` if it exists.

### Issue: "getaddrinfo ENOTFOUND redis.railway.internal"
**Solution:** 
- Remove `REDIS_HOST=redis.railway.internal` from environment variables
- Either set correct Redis variables for Render, or remove them entirely (app works without Redis)

### Issue: Database connection fails
**Solution:**
- Verify `DATABASE_URL` is set correctly
- Check PostgreSQL service is running
- Ensure database is linked to web service

## After Setting Variables

1. **Redeploy** your service in Render
2. **Check logs** for:
   - ✅ "Database connection established successfully"
   - ⚠️ Redis warnings are OK (if Redis not configured)
   - ✅ "Server running on port..."

## Testing

After deployment, test your API:
```bash
curl https://your-service.onrender.com/api/session
# Should return: {"authenticated":false}
```

