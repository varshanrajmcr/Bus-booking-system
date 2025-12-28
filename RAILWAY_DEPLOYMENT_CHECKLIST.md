# Railway Deployment Checklist

## ✅ Pre-Deployment Steps

### 1. Code Updates (Already Done)
- ✅ Updated `utils/queueConfig.js` to support `REDIS_URL`
- ✅ Updated `utils/cacheService.js` to support `REDIS_URL`
- ✅ Code supports both `REDIS_URL` and individual `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`

### 2. GitHub Repository
- ✅ Code is pushed to GitHub: `https://github.com/varshanrajmcr/Bus-booking-system`

## 🚀 Railway Deployment Steps

### Step 1: Create Railway Project

1. **Go to Railway Dashboard**
   - Visit https://railway.app
   - Sign in to your account

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Authorize Railway to access your GitHub (if not already done)
   - Select your repository: `varshanrajmcr/Bus-booking-system`

### Step 2: Add PostgreSQL Database

1. **In Railway Dashboard:**
   - Click "New" → "Database" → "Add PostgreSQL"
   - Railway will create a PostgreSQL database automatically
   - **Copy the connection variables** from the database service

2. **Note the variables:**
   - `PGHOST` or `DB_HOST`
   - `PGPORT` or `DB_PORT`
   - `PGDATABASE` or `DB_NAME`
   - `PGUSER` or `DB_USER`
   - `PGPASSWORD` or `DB_PASSWORD`

### Step 3: Link Redis Service

1. **You already have Redis service created**
   - Your Redis service URL: `https://railway.com/project/8f9bb84b-04a0-459d-8b34-e3f9c6ac9d1e/service/4660d844-4d45-4814-a522-1c35312bd19f`

2. **Link Redis to your backend service:**
   - Go to your backend service (Node.js service)
   - Click "Variables" tab
   - Click "New Variable" → "Reference"
   - Select your Redis service
   - Railway will automatically add Redis variables

3. **Or manually add Redis variables:**
   - In your backend service → Variables tab
   - Add these variables (get them from your Redis service):
     ```
     REDIS_URL=redis://:password@host:port
     ```
     OR
     ```
     REDIS_HOST=your-redis-host
     REDIS_PORT=6379
     REDIS_PASSWORD=your-redis-password
     ```

### Step 4: Configure Backend Service Environment Variables

Go to your backend service → **Variables** tab and add:

#### Database Variables (from PostgreSQL service)
```
DB_HOST=<from-postgres-service>
DB_PORT=5432
DB_NAME=<from-postgres-service>
DB_USER=<from-postgres-service>
DB_PASSWORD=<from-postgres-service>
```

**OR** Railway might use these names:
```
PGHOST=<from-postgres-service>
PGPORT=5432
PGDATABASE=<from-postgres-service>
PGUSER=<from-postgres-service>
PGPASSWORD=<from-postgres-service>
```

#### Application Variables
```
NODE_ENV=production
PORT=3000 (Railway sets this automatically, but you can override)
```

#### Email Configuration (Optional - for Nodemailer)
```
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password
FROM_EMAIL=your-email@gmail.com
FROM_NAME=Bus Booking System
```

### Step 5: Configure Build Settings

1. **Railway should auto-detect:**
   - Build command: `npm install`
   - Start command: `npm start`
   - Root directory: `/` (root of repo)

2. **Verify in Settings:**
   - Go to your service → Settings
   - Check "Build Command": `npm install`
   - Check "Start Command": `npm start`

### Step 6: Deploy

1. **Railway will auto-deploy:**
   - After connecting the repo, Railway will start deploying
   - Watch the build logs for any errors

2. **Monitor Deployment:**
   - Go to "Deployments" tab
   - Wait for deployment to complete
   - Check logs for:
     - ✅ "Database connection established."
     - ✅ "Redis connected successfully"
     - ✅ "Server running on port 3000"

### Step 7: Initialize Database

1. **After successful deployment:**
   - Go to your service → "Deployments" → Latest deployment
   - Click "View Logs"
   - Or use Railway CLI:
     ```bash
     railway run npm run init-db
     ```

2. **This will:**
   - Create database tables
   - Set up initial schema
   - Create admin user (if configured)

### Step 8: Get Your Backend URL

1. **After successful deployment:**
   - Go to your service → "Settings" → "Networking"
   - Railway will generate a public URL like: `https://your-service-name.up.railway.app`
   - Or you can set a custom domain

2. **Your API URL will be:**
   - `https://your-service-name.up.railway.app/api`

### Step 9: Test Your Backend

Test your API endpoints:
```bash
# Health check
curl https://your-service-name.up.railway.app/api/session

# Should return: {"authenticated":false}
```

### Step 10: Update Frontend (Netlify)

1. **Copy your Railway backend URL**
   - Example: `https://your-service-name.up.railway.app`

2. **Go to Netlify:**
   - Your frontend project → Site settings → Environment variables
   - Add/Update: `VITE_API_URL=https://your-service-name.up.railway.app/api`
   - Redeploy frontend

## 🔍 Troubleshooting

### Build Fails
- Check build logs in Railway
- Ensure all dependencies are in `package.json`
- Check Node.js version (Railway uses Node 18+ by default)

### Database Connection Fails
- Verify database environment variables are set correctly
- Check that PostgreSQL service is running
- Ensure database credentials match
- Try using `PGHOST`, `PGPORT`, etc. if `DB_HOST`, `DB_PORT` don't work

### Redis Connection Fails
- Verify Redis environment variables are set correctly
- Check Redis service is running (not paused)
- Try using `REDIS_URL` if individual variables don't work
- Check deployment logs for specific error messages

### Port Issues
- Railway sets `PORT` environment variable automatically
- Your `server.js` uses `process.env.PORT || 3000` ✅
- No changes needed

### CORS Issues
- CORS is already configured in `server.js` ✅
- Make sure your Netlify URL is in the allowed origins

## 📋 Quick Checklist

- [ ] Railway project created
- [ ] GitHub repo connected
- [ ] PostgreSQL database added
- [ ] Redis service linked to backend
- [ ] Environment variables set (DB, Redis, NODE_ENV)
- [ ] Build settings verified
- [ ] Deployment successful
- [ ] Database initialized (`npm run init-db`)
- [ ] Backend URL obtained
- [ ] API endpoints tested
- [ ] Frontend updated with backend URL

## 🎯 Next Steps After Deployment

1. ✅ Test all API endpoints
2. ✅ Verify Redis connection in logs
3. ✅ Verify database connection in logs
4. ✅ Update Netlify frontend with backend URL
5. ✅ Test full application flow (login, search, booking)

## 📝 Important Notes

- Railway automatically provides `PORT` variable - don't override unless needed
- Railway may use `PGHOST`, `PGPORT`, etc. instead of `DB_HOST`, `DB_PORT` - check your PostgreSQL service variables
- Redis connection string format: `redis://:password@host:port`
- Always check deployment logs for errors
- Database initialization must be run after first deployment

