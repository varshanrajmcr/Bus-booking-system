# Quick Deployment Guide

## 🚀 Separate Deployment: Backend (Railway) + Frontend (Netlify)

### Architecture
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

## 📋 Quick Checklist

### Backend on Railway
- [ ] Sign up at https://railway.app
- [ ] Create new project from GitHub repo
- [ ] Add PostgreSQL database
- [ ] Add Redis (optional)
- [ ] Set environment variables
- [ ] Deploy and get backend URL
- [ ] Test API endpoints

### Frontend on Netlify
- [ ] Sign up at https://netlify.com
- [ ] Connect GitHub repository
- [ ] Set base directory: `client`
- [ ] Set publish directory: `client/dist`
- [ ] Add `VITE_API_URL` environment variable
- [ ] Deploy and get frontend URL
- [ ] Test frontend routes

## 🔗 Connection

1. **Get Railway Backend URL:**
   ```
   https://your-service-name.up.railway.app
   ```

2. **Set in Netlify:**
   - Environment Variable: `VITE_API_URL`
   - Value: `https://your-service-name.up.railway.app/api`

3. **Redeploy Netlify** after setting the variable

## 📚 Detailed Guides

- **Backend:** See `RAILWAY_BACKEND_DEPLOYMENT.md`
- **Frontend:** See `NETLIFY_FRONTEND_DEPLOYMENT.md`

## ✅ What's Already Configured

- ✅ CORS in backend (allows Netlify domains)
- ✅ Environment variable support in frontend
- ✅ React Router redirects for Netlify
- ✅ PORT environment variable support
- ✅ All necessary configuration files

## 🎯 After Deployment

**Backend URL:** `https://your-backend.railway.app/api`  
**Frontend URL:** `https://your-frontend.netlify.app`

Test:
- Frontend: `https://your-frontend.netlify.app/customer/login`
- API: `https://your-backend.railway.app/api/session`

