# Netlify Frontend Deployment Guide

## Step-by-Step: Deploy Frontend to Netlify

### Prerequisites
- GitHub account with your repository pushed
- Netlify account (sign up at https://netlify.com)
- Backend deployed on Railway (get the URL first)

### Step 1: Connect Repository to Netlify

1. **Go to Netlify Dashboard**
   - Visit https://app.netlify.com
   - Sign in or create an account

2. **Add New Site**
   - Click "Add new site" → "Import an existing project"
   - Choose "Deploy with GitHub"
   - Authorize Netlify to access your GitHub
   - Select your repository: `varshanrajmcr/Bus-booking-system`

### Step 2: Configure Build Settings

Netlify should auto-detect the settings, but verify:

1. **Base directory:** `client`
   - This tells Netlify where your frontend code is

2. **Build command:** `npm run build`
   - This builds your React app

3. **Publish directory:** `client/dist`
   - This is where Vite outputs the built files

### Step 3: Add Environment Variables

**CRITICAL:** Set your backend API URL

1. **Go to Site Settings**
   - In your Netlify site dashboard
   - Click "Site settings" → "Environment variables"

2. **Add Environment Variable:**
   - **Key:** `VITE_API_URL`
   - **Value:** `https://your-railway-backend.up.railway.app/api`
   - Replace with your actual Railway backend URL

3. **Example:**
   ```
   VITE_API_URL=https://laudable-creation-production.up.railway.app/api
   ```

### Step 4: Deploy

1. **Click "Deploy site"**
   - Netlify will start building and deploying
   - Watch the build logs

2. **Wait for Deployment**
   - Build typically takes 1-2 minutes
   - Check for any build errors

### Step 5: Get Your Frontend URL

After deployment:
- Netlify will assign a URL like: `https://random-name-123.netlify.app`
- You can customize it in Site settings → "Change site name"

### Step 6: Verify Configuration Files

✅ These files should already be in your repo:

1. **`client/netlify.toml`** - Netlify configuration
2. **`client/public/_redirects`** - React Router redirects
3. **`client/src/services/api.js`** - Uses `VITE_API_URL` environment variable

### Step 7: Test Your Deployment

1. **Visit your Netlify URL:**
   ```
   https://your-site.netlify.app
   ```

2. **Test Routes:**
   - Home: `https://your-site.netlify.app/`
   - Customer Login: `https://your-site.netlify.app/customer/login`
   - Admin Login: `https://your-site.netlify.app/admin/login`

3. **Check Browser Console:**
   - Open DevTools (F12)
   - Check for any API connection errors
   - Verify API calls are going to your Railway backend

### Step 8: Update CORS in Backend (Already Done)

✅ CORS is already configured in your backend to allow:
- Your Netlify domain
- All Netlify preview deployments
- Localhost for development

If you get CORS errors:
1. Check your Railway backend URL is correct
2. Verify CORS configuration in `server.js`
3. Make sure your Netlify domain is in the allowed origins list

### Troubleshooting

#### Build Fails
- Check build logs in Netlify
- Ensure `client/package.json` has all dependencies
- Verify Node.js version (Netlify uses Node 18+)

#### 404 Errors on Routes
- Verify `client/public/_redirects` file exists
- Check `client/netlify.toml` has redirect rules
- Clear Netlify cache and redeploy

#### API Calls Fail
- Verify `VITE_API_URL` environment variable is set
- Check the value matches your Railway backend URL
- Ensure backend is deployed and running
- Check browser console for CORS errors

#### Environment Variable Not Working
- Environment variables must start with `VITE_` to be accessible in React
- Redeploy after adding/changing environment variables
- Check build logs to verify variable is being used

### Custom Domain (Optional)

1. **Go to Site Settings → Domain management**
2. **Add custom domain**
3. **Follow DNS configuration instructions**

### Continuous Deployment

✅ **Auto-deploy is enabled by default:**
- Every push to `main` branch will trigger a new deployment
- You can disable this in Site settings → Build & deploy

### Preview Deployments

- Netlify creates preview deployments for pull requests
- Each preview gets its own URL
- CORS is configured to allow all `*.netlify.app` domains

### Environment Variables for Different Branches

You can set different environment variables for:
- Production (main branch)
- Deploy previews (PR branches)
- Branch deploys

Go to: Site settings → Environment variables → "Edit variables"

### Quick Checklist

- [ ] Repository connected to Netlify
- [ ] Build settings configured (base: `client`, publish: `client/dist`)
- [ ] `VITE_API_URL` environment variable set
- [ ] Backend deployed on Railway
- [ ] CORS configured in backend
- [ ] First deployment successful
- [ ] Tested routes work correctly
- [ ] API calls connect to backend

### Your Frontend URL Format

After deployment, your frontend will be at:
```
https://your-site-name.netlify.app
```

Example routes:
- `https://your-site-name.netlify.app/`
- `https://your-site-name.netlify.app/customer/login`
- `https://your-site-name.netlify.app/admin/dashboard`

### Next Steps

After both are deployed:
1. ✅ Test login functionality
2. ✅ Test API calls
3. ✅ Verify sessions work
4. ✅ Test all features end-to-end

