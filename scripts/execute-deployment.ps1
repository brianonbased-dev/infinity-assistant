# Execute Deployment: Analytics Dashboard & Knowledge Gap Automation
# Date: 2025-02-06

$ErrorActionPreference = "Stop"

Write-Host "🚀 Executing Deployment Steps..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Generate CRON_SECRET
Write-Host "Step 1: Generating CRON_SECRET..." -ForegroundColor Yellow
$cronSecret = [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
Write-Host "Generated CRON_SECRET: $cronSecret" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  IMPORTANT: Copy this CRON_SECRET and add it to Vercel:" -ForegroundColor Yellow
Write-Host "   1. Go to Vercel Dashboard → Project → Settings → Environment Variables" -ForegroundColor White
Write-Host "   2. Add new variable: CRON_SECRET = $cronSecret" -ForegroundColor White
Write-Host "   3. Apply to: Production, Preview, Development" -ForegroundColor White
Write-Host ""
$continue = Read-Host "Have you added CRON_SECRET to Vercel? (y/n)"
if ($continue -ne "y" -and $continue -ne "Y") {
    Write-Host "❌ Please add CRON_SECRET to Vercel first." -ForegroundColor Red
    exit 1
}
Write-Host "✅ CRON_SECRET configured" -ForegroundColor Green
Write-Host ""

# Step 2: Apply Database Migration
Write-Host "Step 2: Applying Database Migration..." -ForegroundColor Yellow
Write-Host "Attempting to apply migration..." -ForegroundColor White

# Check if supabase CLI is available
$supabaseAvailable = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabaseAvailable) {
    Write-Host "⚠️  Supabase CLI not found. Please apply migration manually:" -ForegroundColor Yellow
    Write-Host "   1. Go to Supabase Dashboard → SQL Editor" -ForegroundColor White
    Write-Host "   2. Open: supabase/migrations/20250206_analytics_timeseries.sql" -ForegroundColor White
    Write-Host "   3. Copy and execute the SQL" -ForegroundColor White
    Write-Host ""
    $migrationApplied = Read-Host "Have you applied the migration manually? (y/n)"
    if ($migrationApplied -ne "y" -and $migrationApplied -ne "Y") {
        Write-Host "❌ Please apply database migration first." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Running: supabase db push" -ForegroundColor White
    supabase db push
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  Migration push failed. Please apply manually:" -ForegroundColor Yellow
        Write-Host "   supabase/migrations/20250206_analytics_timeseries.sql" -ForegroundColor White
        $migrationApplied = Read-Host "Have you applied the migration manually? (y/n)"
        if ($migrationApplied -ne "y" -and $migrationApplied -ne "Y") {
            Write-Host "❌ Please apply database migration first." -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "✅ Migration applied successfully" -ForegroundColor Green
    }
}
Write-Host ""

# Step 3: Deploy to Staging
Write-Host "Step 3: Deploying to Staging..." -ForegroundColor Yellow
Write-Host "Running: vercel --env=staging" -ForegroundColor White
Write-Host ""

# Check if vercel CLI is available
$vercelAvailable = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercelAvailable) {
    Write-Host "⚠️  Vercel CLI not found. Please deploy manually:" -ForegroundColor Yellow
    Write-Host "   1. Go to Vercel Dashboard" -ForegroundColor White
    Write-Host "   2. Select your project" -ForegroundColor White
    Write-Host "   3. Click 'Deploy' or push to staging branch" -ForegroundColor White
    Write-Host ""
    $deployed = Read-Host "Have you deployed to staging? (y/n)"
    if ($deployed -ne "y" -and $deployed -ne "Y") {
        Write-Host "❌ Please deploy to staging." -ForegroundColor Red
        exit 1
    }
} else {
    vercel --env=staging
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  Deployment failed. Please check errors above." -ForegroundColor Yellow
        exit 1
    }
    Write-Host "✅ Deployment initiated" -ForegroundColor Green
}
Write-Host ""

# Step 4: Verification Checklist
Write-Host "Step 4: Deployment Verification Checklist" -ForegroundColor Yellow
Write-Host ""
Write-Host "Please verify the following:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. ✅ Database Migration Applied" -ForegroundColor White
Write-Host "   - Check Supabase: Tables should exist" -ForegroundColor Gray
Write-Host "   - knowledge_analytics_snapshots" -ForegroundColor Gray
Write-Host "   - detection_accuracy_snapshots" -ForegroundColor Gray
Write-Host "   - knowledge_promotion_log" -ForegroundColor Gray
Write-Host ""
Write-Host "2. ✅ CRON_SECRET Configured" -ForegroundColor White
Write-Host "   - Vercel Dashboard → Environment Variables" -ForegroundColor Gray
Write-Host "   - CRON_SECRET should be set" -ForegroundColor Gray
Write-Host ""
Write-Host "3. ✅ Cron Jobs Configured" -ForegroundColor White
Write-Host "   - Vercel Dashboard → Cron Jobs" -ForegroundColor Gray
Write-Host "   - Should see 3 new cron jobs:" -ForegroundColor Gray
Write-Host "     * /api/cron/analytics-snapshot (00:00 UTC)" -ForegroundColor Gray
Write-Host "     * /api/cron/knowledge-gaps (02:00 UTC)" -ForegroundColor Gray
Write-Host "     * /api/cron/knowledge-promotion (03:00 UTC)" -ForegroundColor Gray
Write-Host ""
Write-Host "4. ✅ Test Analytics Dashboard" -ForegroundColor White
Write-Host "   URL: https://staging.infinityassistant.io/admin/knowledge-analytics" -ForegroundColor Gray
Write-Host "   - Should load without errors" -ForegroundColor Gray
Write-Host "   - All visualizations should display" -ForegroundColor Gray
Write-Host ""
Write-Host "5. ✅ Test Monitoring Endpoint" -ForegroundColor White
Write-Host "   curl https://staging.infinityassistant.io/api/monitoring/promotion" -ForegroundColor Gray
Write-Host "   - Should return JSON with statistics" -ForegroundColor Gray
Write-Host ""
Write-Host "6. ✅ Test Cron Endpoints (Manual)" -ForegroundColor White
Write-Host "   curl -H 'Authorization: Bearer $CRON_SECRET' \`" -ForegroundColor Gray
Write-Host "     https://staging.infinityassistant.io/api/cron/analytics-snapshot" -ForegroundColor Gray
Write-Host ""

Write-Host "📋 Full verification checklist:" -ForegroundColor Cyan
Write-Host "   docs/DEPLOYMENT_CHECKLIST_2025-02-06.md" -ForegroundColor White
Write-Host ""

Write-Host "✅ Deployment execution complete!" -ForegroundColor Green
Write-Host "🎉 Next: Monitor for 24-48 hours to verify automation is working" -ForegroundColor Cyan
