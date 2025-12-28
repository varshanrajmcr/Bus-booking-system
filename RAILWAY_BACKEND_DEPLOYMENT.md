# Railway Backend Deployment Guide

## Step-by-Step: Deploy Backend to Railway

### Prerequisites
- GitHub account with your repository pushed
- Railway account (sign up at https://railway.app)

### Step 1: Create Railway Project

1. **Go to Railway Dashboard**
   - Visit https://railway.app
   - Sign in or create an account

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Authorize Railway to access your GitHub
   - Select your repository: `varshanrajmcr/Bus-booking-system`

### Step 2: Configure Service

1. **Railway will auto-detect Node.js**
   - It should detect `package.json` and `server.js`

2. **Set Root Directory (if needed)**
   - Railway should detect the root automatically
   - If not, set root directory to: `/` (root of repo)

3. **Configure Build Settings**
   - Build command: `npm install` (or leave default)
   - Start command: `npm start`
   - Output directory: Leave empty (not needed for backend)

### Step 3: Add Environment Variables

Go to your Railway service → Variables tab and add:

#### Database Variables
```
DB_HOST=your-postgres-host
DB_PORT=5432
DB_NAME=bus_booking_db
DB_USER=postgres
DB_PASSWORD=your-db-password
```

#### Redis Variables (if using Redis)
```
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password (if required)
```

#### Application Variables
```
NODE_ENV=production
PORT=3000 (Railway will set this automatically, but you can override)
```

#### Optional: Email Configuration (for Nodemailer)
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### Step 4: Add PostgreSQL Database

1. **In Railway Dashboard:**
   - Click "New" → "Database" → "Add PostgreSQL"
   - Railway will create a PostgreSQL database automatically
   - Copy the connection variables from the database service

2. **Update Environment Variables:**
   - Use the PostgreSQL connection details Railway provides
   - Update `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` in your service variables

### Step 5: Add Redis (Optional but Recommended)

1. **In Railway Dashboard:**
   - Click "New" → "Database" → "Add Redis"
   - Railway will create a Redis instance

2. **Update Environment Variables:**
   - Use the Redis connection details Railway provides
   - Update `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` if required

### Step 6: Deploy

1. **Railway will auto-deploy:**
   - After connecting the repo, Railway will start deploying
   - Watch the build logs for any errors

2. **Check Deployment:**
   - Go to "Deployments" tab
   - Wait for deployment to complete
   - Check logs for any errors

### Step 7: Get Your Backend URL

1. **After successful deployment:**
   - Go to your service → "Settings" → "Networking"
   - Railway will generate a public URL like: `https://your-service-name.up.railway.app`
   - Or you can set a custom domain

2. **Your API URL will be:**
   - `https://your-service-name.up.railway.app/api`

### Step 8: Initialize Database

1. **Run database initialization:**
   - In Railway, go to your service
   - Click "Deployments" → "Latest deployment" → "View Logs"
   - Or use Railway CLI:
   ```bash
   railway run npm run init-db
   ```

### Step 9: Test Your Backend

Test your API endpoints:
```bash
# Health check
curl https://your-service-name.up.railway.app/api/session

# Should return: {"authenticated":false}
```

### Step 10: Update CORS (Already Done)

✅ CORS is already configured in `server.js` to allow:
- Netlify domains
- Localhost for development
- All Netlify preview deployments

### Troubleshooting

#### Build Fails
- Check build logs in Railway
- Ensure all dependencies are in `package.json`
- Check Node.js version (Railway uses Node 18+ by default)

#### Database Connection Fails
- Verify database environment variables are set correctly
- Check that PostgreSQL service is running
- Ensure database credentials match

#### Port Issues
- Railway sets `PORT` environment variable automatically
- Your `server.js` should use `process.env.PORT || 3000`
- Check if your code uses the PORT variable correctly

#### Redis Connection Fails
- Verify Redis environment variables
- Check Redis service is running
- If Redis is optional, the app should still work without it (with warnings)

### Railway CLI (Optional)

Install Railway CLI for easier management:
```bash
npm install -g @railway/cli
railway login
railway link  # Link to your project
railway up    # Deploy
railway logs  # View logs
```

### Next Steps

After backend is deployed:
1. ✅ Copy your Railway backend URL
2. ✅ Go to Netlify frontend deployment guide
3. ✅ Set `VITE_API_URL` environment variable in Netlify
4. ✅ Test the connection

### Your Backend URL Format

After deployment, your backend will be at:
```
https://your-service-name.up.railway.app
```

Your API endpoints will be at:
```
https://your-service-name.up.railway.app/api/*
```

Example:
- `https://your-service-name.up.railway.app/api/session`
- `https://your-service-name.up.railway.app/api/customer/login`
- `https://your-service-name.up.railway.app/api/buses/search`

