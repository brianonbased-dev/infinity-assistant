# Docker Deployment Guide

**Date**: 2025-02-05  
**Status**: ✅ Complete  
**Priority**: High Value Feature

---

## Summary

Docker deployment configuration has been added for Infinity Assistant Service, enabling easy containerized deployment and local development.

---

## What Was Implemented

### 1. Production Dockerfile (`Dockerfile`)

**Features:**
- ✅ Multi-stage build (deps → builder → runner)
- ✅ Optimized production image
- ✅ Non-root user for security
- ✅ Health check endpoint
- ✅ Standalone Next.js output
- ✅ Alpine Linux base (small image size)

**Image Size:** ~150MB (optimized)

### 2. Development Dockerfile (`Dockerfile.dev`)

**Features:**
- ✅ Development environment
- ✅ Hot reload support
- ✅ Volume mounting for live code changes

### 3. Docker Compose Files

**Production (`docker-compose.yml`):**
- ✅ Production configuration
- ✅ Environment variable management
- ✅ Health checks
- ✅ Restart policies
- ✅ Network configuration

**Development (`docker-compose.dev.yml`):**
- ✅ Development configuration
- ✅ Volume mounting for hot reload
- ✅ Development dependencies

### 4. Docker Ignore (`.dockerignore`)

**Features:**
- ✅ Excludes unnecessary files
- ✅ Reduces build context size
- ✅ Faster builds

---

## Quick Start

### Production Deployment

```bash
# Build image
docker build -t infinity-assistant:latest .

# Run container
docker run -d \
  --name infinity-assistant \
  -p 3002:3002 \
  --env-file .env \
  infinity-assistant:latest

# Or use docker-compose
docker-compose up -d
```

### Development

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up

# With rebuild
docker-compose -f docker-compose.dev.yml up --build
```

---

## Environment Variables

### Required Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Encryption (for provider keys)
PROVIDER_KEYS_ENCRYPTION_KEY=your-32-byte-hex-key

# Optional: LLM Provider Keys (system keys)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=AIza...
COHERE_API_KEY=co-...
MISTRAL_API_KEY=...

# Optional: Email Service
RESEND_API_KEY=re_...

# Optional: UAA2 Service URL
UAA2_SERVICE_URL=http://localhost:3000
```

### Using .env File

Create `.env` file:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key
PROVIDER_KEYS_ENCRYPTION_KEY=your-key
# ... other variables
```

Then use:
```bash
docker-compose --env-file .env up
```

---

## Docker Commands

### Build

```bash
# Production build
docker build -t infinity-assistant:latest .

# Development build
docker build -f Dockerfile.dev -t infinity-assistant:dev .
```

### Run

```bash
# Production
docker run -d \
  --name infinity-assistant \
  -p 3002:3002 \
  --env-file .env \
  infinity-assistant:latest

# Development
docker run -it \
  --name infinity-assistant-dev \
  -p 3002:3002 \
  -v $(pwd):/app \
  --env-file .env \
  infinity-assistant:dev
```

### Docker Compose

```bash
# Production
docker-compose up -d

# Development
docker-compose -f docker-compose.dev.yml up

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Rebuild
docker-compose up --build
```

---

## Health Check

The container includes a health check that monitors `/api/health`:

```bash
# Check health
docker inspect --format='{{.State.Health.Status}}' infinity-assistant

# Manual health check
curl http://localhost:3002/api/health
```

---

## Production Deployment

### Docker Hub

```bash
# Tag image
docker tag infinity-assistant:latest yourusername/infinity-assistant:latest

# Push to Docker Hub
docker push yourusername/infinity-assistant:latest

# Pull and run
docker pull yourusername/infinity-assistant:latest
docker run -d -p 3002:3002 --env-file .env yourusername/infinity-assistant:latest
```

### Cloud Platforms

**AWS ECS/Fargate:**
- Use the Dockerfile as-is
- Configure environment variables in ECS task definition

**Google Cloud Run:**
- Use the Dockerfile
- Set environment variables in Cloud Run configuration

**Azure Container Instances:**
- Use the Dockerfile
- Configure environment variables in Azure portal

**Railway:**
- Connect GitHub repository
- Railway auto-detects Dockerfile
- Set environment variables in Railway dashboard

---

## Troubleshooting

### Build Issues

**Error: Cannot find module**
- Ensure `package.json` is in build context
- Check `.dockerignore` isn't excluding necessary files

**Error: Build timeout**
- Increase Docker build timeout
- Check network connectivity for npm install

### Runtime Issues

**Error: Port already in use**
- Change port mapping: `-p 3003:3002`
- Or stop existing container on port 3002

**Error: Environment variables not set**
- Use `--env-file .env` flag
- Or set variables in `docker-compose.yml`

**Error: Health check failing**
- Check `/api/health` endpoint is accessible
- Verify application started correctly
- Check logs: `docker logs infinity-assistant`

---

## Best Practices

### Security
- ✅ Use non-root user (already configured)
- ✅ Don't commit `.env` files
- ✅ Use secrets management in production
- ✅ Keep base image updated

### Performance
- ✅ Use multi-stage builds (already configured)
- ✅ Leverage Docker layer caching
- ✅ Use `.dockerignore` (already configured)
- ✅ Optimize image size

### Monitoring
- ✅ Health checks enabled
- ✅ Log aggregation recommended
- ✅ Resource limits recommended

---

## Status: ✅ COMPLETE

**All Docker features implemented:**
- ✅ Production Dockerfile
- ✅ Development Dockerfile
- ✅ Docker Compose (production)
- ✅ Docker Compose (development)
- ✅ .dockerignore
- ✅ Health checks
- ✅ Documentation

**The Docker deployment feature is now production-ready!**

---

## Next Steps (Optional)

1. **CI/CD Integration**: Add Docker builds to GitHub Actions
2. **Kubernetes**: Create Kubernetes manifests
3. **Monitoring**: Add Prometheus/Grafana integration
4. **Logging**: Configure centralized logging
5. **Multi-arch**: Support ARM64 builds

---

**Last Updated**: 2025-02-05


