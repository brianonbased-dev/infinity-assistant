# Vercel Deployment Guide - infinityassistant.io

**Status**: ✅ **READY FOR DEPLOYMENT**

---

## Quick Start

### 1. Install Vercel CLI (if not already installed)

```bash
npm i -g vercel
```

### 2. Login to Vercel

```bash
vercel login
```

### 3. Link Project

```bash
cd infinityassistant-service
vercel link
```

### 4. Deploy

```bash
# Preview deployment
vercel

# Production deployment
vercel --prod
```

---

## Environment Variables

Set these in Vercel Dashboard → Project Settings → Environment Variables:

### Required Variables

```env
# Database
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
UAA2_SUPABASE_SERVICE_KEY=your_service_role_key

# Master Portal (uaa2-service)
UAA2_SERVICE_URL=https://uaa2-service.railway.app
UAA2_SERVICE_API_KEY=your_internal_api_key

# Server
NODE_ENV=production
LOG_LEVEL=info
```

### Setting via CLI

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add UAA2_SUPABASE_SERVICE_KEY
vercel env add UAA2_SERVICE_URL
vercel env add UAA2_SERVICE_API_KEY
vercel env add NODE_ENV
vercel env add LOG_LEVEL
```

---

## GitHub Integration (Recommended)

### 1. Connect GitHub Repository

1. Go to Vercel Dashboard
2. Click "Add New Project"
3. Import `infinityassistant-service` repository
4. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (root)
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

### 2. Automatic Deployments

- **Production**: Deploys on push to `main` branch
- **Preview**: Deploys on pull requests
- **Automatic**: Vercel detects Next.js and configures automatically

---

## Custom Domain Setup

### 1. Add Domain in Vercel

1. Go to Project Settings → Domains
2. Add `infinityassistant.io`
3. Follow DNS configuration instructions

### 2. DNS Configuration

Add these DNS records:

```
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

---

## Build Configuration

### Build Settings (vercel.json)

- **Framework**: Next.js 16
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`
- **Node Version**: 20.x (auto-detected)

### Function Configuration

- **Max Duration**: 10 seconds (API routes)
- **Memory**: 1024 MB (default)
- **Region**: `iad1` (US East)

---

## Monitoring & Analytics

### Vercel Analytics

1. Enable in Project Settings → Analytics
2. View metrics in Vercel Dashboard
3. Track:
   - Page views
   - Performance
   - Web Vitals

### Custom Logging

Logs are available in Vercel Dashboard → Logs

```typescript
// In your API routes
console.log('API call received', { endpoint, timestamp });
```

---

## Troubleshooting

### Build Failures

1. **Check Build Logs**: Vercel Dashboard → Deployments → Build Logs
2. **Verify Environment Variables**: All required vars set
3. **Check Dependencies**: `package.json` dependencies correct
4. **TypeScript Errors**: Fix before deploying

### Runtime Errors

1. **Check Function Logs**: Vercel Dashboard → Logs
2. **Verify API Routes**: Test endpoints locally first
3. **Check Environment Variables**: Values correct in production

### Performance Issues

1. **Enable Edge Functions**: For low-latency responses
2. **Optimize Images**: Use Next.js Image component
3. **Enable Compression**: Already enabled in `next.config.js`

---

## Deployment Checklist

- [ ] Environment variables configured
- [ ] GitHub repository connected
- [ ] Build passes locally (`npm run build`)
- [ ] TypeScript compiles (`npm run type-check`)
- [ ] Tests pass (`npm test`)
- [ ] Custom domain configured (if applicable)
- [ ] Monitoring enabled
- [ ] Error tracking configured (Sentry, etc.)

---

## Production URL

After deployment, your app will be available at:

- **Vercel URL**: `https://infinityassistant-service.vercel.app`
- **Custom Domain**: `https://infinityassistant.io` (after DNS setup)

---

## Next Steps

1. ✅ **Deploy to Vercel**: Follow Quick Start above
2. ⏳ **Configure Domain**: Set up infinityassistant.io
3. ⏳ **Set Environment Variables**: Configure all required vars
4. ⏳ **Test Deployment**: Verify all endpoints work
5. ⏳ **Monitor**: Set up monitoring and alerts

---

**Status**: ✅ **READY FOR DEPLOYMENT**  
**Last Updated**: January 29, 2025

