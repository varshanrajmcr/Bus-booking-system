# Netlify Deployment Guide

## Quick Fix for 404 Errors

The configuration files have been created to fix the 404 issue:
- `public/_redirects` - Redirects all routes to index.html
- `netlify.toml` - Netlify build configuration

## Deployment Steps

### 1. Build Configuration
The `netlify.toml` file is already configured with:
- Build command: `npm run build`
- Publish directory: `dist`

### 2. Environment Variables
You need to set up environment variables in Netlify:

1. Go to your Netlify site dashboard
2. Navigate to **Site settings** → **Environment variables**
3. Add the following variable:
   - **Key**: `VITE_API_URL`
   - **Value**: Your backend API URL (e.g., `https://your-backend.herokuapp.com/api` or `https://your-backend.railway.app/api`)

### 3. Backend Deployment
**Important**: Netlify only hosts the frontend. You need to deploy your backend separately:

**Options:**
- **Heroku**: Free tier available
- **Railway**: Easy deployment
- **Render**: Free tier available
- **DigitalOcean**: More control
- **AWS/Google Cloud**: For production

### 4. Update Backend CORS Settings
Make sure your backend allows requests from your Netlify domain:

```javascript
// In your server.js or app.js
const cors = require('cors');

app.use(cors({
  origin: ['https://your-netlify-site.netlify.app', 'http://localhost:5173'],
  credentials: true
}));
```

### 5. Update netlify.toml Proxy
If you want to use Netlify's proxy instead of environment variables:

1. Open `netlify.toml`
2. Replace `https://your-backend-url.com` with your actual backend URL
3. This will proxy all `/api/*` requests to your backend

### 6. Deploy to Netlify

**Option A: Via Netlify Dashboard**
1. Go to [Netlify](https://app.netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Connect to your GitHub repository
4. Set build settings:
   - Base directory: `client`
   - Build command: `npm run build`
   - Publish directory: `client/dist`
5. Add environment variable: `VITE_API_URL`
6. Click "Deploy site"

**Option B: Via Netlify CLI**
```bash
npm install -g netlify-cli
cd client
netlify login
netlify init
netlify deploy --prod
```

## Troubleshooting

### Still getting 404 errors?
1. Make sure `public/_redirects` file exists
2. Check that `netlify.toml` has the redirect rule
3. Clear Netlify cache and redeploy

### API calls failing?
1. Check that `VITE_API_URL` environment variable is set
2. Verify backend CORS settings allow your Netlify domain
3. Check browser console for CORS errors
4. Ensure backend is deployed and accessible

### Build fails?
1. Make sure all dependencies are in `package.json`
2. Check Node.js version (Netlify uses Node 18 by default)
3. Add `.nvmrc` file to specify Node version if needed

## File Structure
```
client/
├── public/
│   └── _redirects          # Netlify redirects (copied to dist)
├── netlify.toml            # Netlify configuration
├── package.json
└── src/
    └── services/
        └── api.js          # Uses VITE_API_URL env variable
```

## Next Steps
1. Deploy your backend to a hosting service
2. Set `VITE_API_URL` in Netlify environment variables
3. Update backend CORS to allow your Netlify domain
4. Redeploy on Netlify

