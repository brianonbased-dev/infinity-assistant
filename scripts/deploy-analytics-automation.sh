#!/bin/bash

# Deployment Script for Analytics Dashboard & Knowledge Gap Automation
# Date: 2025-02-06

set -e

echo "🚀 Starting deployment of Analytics Dashboard & Knowledge Gap Automation..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Run tests
echo -e "${YELLOW}Step 1: Running tests...${NC}"
npm test -- --run
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Tests failed. Aborting deployment.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Tests passed${NC}"
echo ""

# Step 2: Type check
echo -e "${YELLOW}Step 2: Running type check...${NC}"
npm run type-check
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Type check failed. Aborting deployment.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Type check passed${NC}"
echo ""

# Step 3: Build
echo -e "${YELLOW}Step 3: Building application...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed. Aborting deployment.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Build successful${NC}"
echo ""

# Step 4: Database migration reminder
echo -e "${YELLOW}Step 4: Database Migration${NC}"
echo "⚠️  IMPORTANT: Apply database migration before deployment:"
echo "   supabase db push"
echo "   OR"
echo "   Run migration: supabase/migrations/20250206_analytics_timeseries.sql"
echo ""
read -p "Have you applied the database migration? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ Please apply database migration first.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Database migration confirmed${NC}"
echo ""

# Step 5: Environment variables check
echo -e "${YELLOW}Step 5: Environment Variables Check${NC}"
echo "Required environment variables:"
echo "  - NEXT_PUBLIC_SUPABASE_URL"
echo "  - SUPABASE_SERVICE_ROLE_KEY"
echo "  - CRON_SECRET (for cron job authentication)"
echo ""
read -p "Are all environment variables configured? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ Please configure environment variables first.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Environment variables confirmed${NC}"
echo ""

# Step 6: Deployment
echo -e "${YELLOW}Step 6: Deploying to Vercel...${NC}"
echo "Choose deployment target:"
echo "  1) Preview (for testing)"
echo "  2) Staging"
echo "  3) Production"
read -p "Enter choice (1-3): " choice

case $choice in
    1)
        echo "Deploying to preview..."
        vercel
        ;;
    2)
        echo "Deploying to staging..."
        vercel --env=staging
        ;;
    3)
        echo "Deploying to production..."
        read -p "⚠️  Are you sure you want to deploy to PRODUCTION? (yes/no): " confirm
        if [[ $confirm != "yes" ]]; then
            echo -e "${RED}❌ Production deployment cancelled.${NC}"
            exit 1
        fi
        vercel --prod
        ;;
    *)
        echo -e "${RED}❌ Invalid choice. Aborting.${NC}"
        exit 1
        ;;
esac

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Deployment failed.${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Deployment successful!${NC}"
echo ""
echo "📋 Post-Deployment Checklist:"
echo "  1. Verify cron jobs are configured in Vercel dashboard"
echo "  2. Test analytics dashboard: /admin/knowledge-analytics"
echo "  3. Test monitoring endpoint: /api/monitoring/promotion"
echo "  4. Verify snapshots are created (check after first cron run)"
echo "  5. Monitor promotion rates for 24-48 hours"
echo ""
echo "🎉 Deployment complete!"
