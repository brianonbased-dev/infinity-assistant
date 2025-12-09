# Deployment Script for Analytics Dashboard & Knowledge Gap Automation
# Date: 2025-02-06
# PowerShell version for Windows

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting deployment of Analytics Dashboard & Knowledge Gap Automation..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Run tests
Write-Host "Step 1: Running tests..." -ForegroundColor Yellow
npm test -- --run
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Tests failed. Aborting deployment." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Tests passed" -ForegroundColor Green
Write-Host ""

# Step 2: Type check
Write-Host "Step 2: Running type check..." -ForegroundColor Yellow
npm run type-check
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Type check failed. Aborting deployment." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Type check passed" -ForegroundColor Green
Write-Host ""

# Step 3: Build
Write-Host "Step 3: Building application..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed. Aborting deployment." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Build successful" -ForegroundColor Green
Write-Host ""

# Step 4: Database migration reminder
Write-Host "Step 4: Database Migration" -ForegroundColor Yellow
Write-Host "⚠️  IMPORTANT: Apply database migration before deployment:" -ForegroundColor Yellow
Write-Host "   supabase db push" -ForegroundColor White
Write-Host "   OR" -ForegroundColor White
Write-Host "   Run migration: supabase/migrations/20250206_analytics_timeseries.sql" -ForegroundColor White
Write-Host ""
$migrationApplied = Read-Host "Have you applied the database migration? (y/n)"
if ($migrationApplied -ne "y" -and $migrationApplied -ne "Y") {
    Write-Host "❌ Please apply database migration first." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Database migration confirmed" -ForegroundColor Green
Write-Host ""

# Step 5: Environment variables check
Write-Host "Step 5: Environment Variables Check" -ForegroundColor Yellow
Write-Host "Required environment variables:" -ForegroundColor White
Write-Host "  - NEXT_PUBLIC_SUPABASE_URL" -ForegroundColor White
Write-Host "  - SUPABASE_SERVICE_ROLE_KEY" -ForegroundColor White
Write-Host "  - CRON_SECRET (for cron job authentication)" -ForegroundColor White
Write-Host ""
$envVarsConfigured = Read-Host "Are all environment variables configured? (y/n)"
if ($envVarsConfigured -ne "y" -and $envVarsConfigured -ne "Y") {
    Write-Host "❌ Please configure environment variables first." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Environment variables confirmed" -ForegroundColor Green
Write-Host ""

# Step 6: Deployment
Write-Host "Step 6: Deploying to Vercel..." -ForegroundColor Yellow
Write-Host "Choose deployment target:" -ForegroundColor White
Write-Host "  1) Preview (for testing)" -ForegroundColor White
Write-Host "  2) Staging" -ForegroundColor White
Write-Host "  3) Production" -ForegroundColor White
$choice = Read-Host "Enter choice (1-3)"

switch ($choice) {
    "1" {
        Write-Host "Deploying to preview..." -ForegroundColor Cyan
        vercel
    }
    "2" {
        Write-Host "Deploying to staging..." -ForegroundColor Cyan
        vercel --env=staging
    }
    "3" {
        Write-Host "Deploying to production..." -ForegroundColor Cyan
        $confirm = Read-Host "⚠️  Are you sure you want to deploy to PRODUCTION? (yes/no)"
        if ($confirm -ne "yes") {
            Write-Host "❌ Production deployment cancelled." -ForegroundColor Red
            exit 1
        }
        vercel --prod
    }
    default {
        Write-Host "❌ Invalid choice. Aborting." -ForegroundColor Red
        exit 1
    }
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Deployment successful!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Post-Deployment Checklist:" -ForegroundColor Cyan
Write-Host "  1. Verify cron jobs are configured in Vercel dashboard" -ForegroundColor White
Write-Host "  2. Test analytics dashboard: /admin/knowledge-analytics" -ForegroundColor White
Write-Host "  3. Test monitoring endpoint: /api/monitoring/promotion" -ForegroundColor White
Write-Host "  4. Verify snapshots are created (check after first cron run)" -ForegroundColor White
Write-Host "  5. Monitor promotion rates for 24-48 hours" -ForegroundColor White
Write-Host ""
Write-Host "🎉 Deployment complete!" -ForegroundColor Green
