# Deployment Checklist: Analytics Dashboard & Knowledge Gap Automation

**Date**: 2025-02-06  
**Status**: ✅ Ready for Deployment

---

## Pre-Deployment Verification

### ✅ Code Quality
- [x] TypeScript type checking passed
- [x] Build successful
- [x] Unit tests created (KnowledgePromotionService)
- [x] Code follows existing patterns

### ✅ Configuration
- [x] `vercel.json` updated with new cron jobs
- [x] Vitest config updated for service tests
- [x] All new files created and organized

### ⚠️ Required Actions

#### 1. Database Migration
**Action Required**: Apply migration to Supabase

```bash
# Option 1: Using Supabase CLI
supabase db push

# Option 2: Manual SQL execution
# Run: supabase/migrations/20250206_analytics_timeseries.sql
```

**Migration Creates**:
- `knowledge_analytics_snapshots` table
- `detection_accuracy_snapshots` table  
- `knowledge_promotion_log` table
- 3 helper functions for analytics

**Verification**:
```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'knowledge_analytics_snapshots',
    'detection_accuracy_snapshots',
    'knowledge_promotion_log'
  );
```

#### 2. Environment Variables
**Action Required**: Verify/Set in Vercel dashboard

**Required**:
- `NEXT_PUBLIC_SUPABASE_URL` ✅ (should already exist)
- `SUPABASE_SERVICE_ROLE_KEY` ✅ (should already exist)
- `CRON_SECRET` ⚠️ (new - set a secure random string)

**Set CRON_SECRET**:
```bash
# Generate secure secret
openssl rand -base64 32

# Add to Vercel environment variables
# Project Settings → Environment Variables → Add CRON_SECRET
```

#### 3. Cron Jobs Configuration
**Status**: ✅ Added to `vercel.json`

**Cron Jobs**:
- `/api/cron/analytics-snapshot` - Daily at 00:00 UTC
- `/api/cron/knowledge-gaps` - Daily at 02:00 UTC  
- `/api/cron/knowledge-promotion` - Daily at 03:00 UTC

**Verification**: After deployment, check Vercel dashboard → Cron Jobs

---

## Deployment Steps

### Step 1: Apply Database Migration
```bash
supabase db push
```

### Step 2: Set Environment Variables
1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add `CRON_SECRET` (if not exists)
3. Verify other required variables are set

### Step 3: Deploy to Staging
```bash
# Option 1: Using deployment script
.\scripts\deploy-analytics-automation.ps1  # Windows PowerShell
./scripts/deploy-analytics-automation.sh    # Linux/Mac

# Option 2: Manual deployment
vercel --env=staging
```

### Step 4: Verify Deployment

#### 4.1 Check Cron Jobs
- Go to Vercel Dashboard → Cron Jobs
- Verify 3 new cron jobs are listed
- Check schedules are correct

#### 4.2 Test Analytics Dashboard
```
https://staging.infinityassistant.io/admin/knowledge-analytics
```

**Verify**:
- [ ] Dashboard loads without errors
- [ ] All 6 visualization types display
- [ ] Timeframe selector works
- [ ] Growth charts show data (may be empty initially)
- [ ] Detection accuracy metrics display
- [ ] Top queries table populates
- [ ] Export functionality works

#### 4.3 Test Monitoring Endpoint
```bash
curl https://staging.infinityassistant.io/api/monitoring/promotion?includeAlerts=true
```

**Verify**:
- [ ] Returns promotion statistics
- [ ] Alerts array included (may be empty)
- [ ] No errors in response

#### 4.4 Test Cron Endpoints (Manual)
```bash
# Test analytics snapshot
curl -H "Authorization: Bearer ${CRON_SECRET}" \
  https://staging.infinityassistant.io/api/cron/analytics-snapshot

# Test knowledge gaps research
curl -H "Authorization: Bearer ${CRON_SECRET}" \
  https://staging.infinityassistant.io/api/cron/knowledge-gaps

# Test knowledge promotion
curl -H "Authorization: Bearer ${CRON_SECRET}" \
  https://staging.infinityassistant.io/api/cron/knowledge-promotion
```

**Verify**:
- [ ] All endpoints return success
- [ ] Analytics snapshot creates database entry
- [ ] Knowledge gaps research runs
- [ ] Knowledge promotion evaluates items

---

## Post-Deployment Monitoring

### Day 1 (Immediate)
- [ ] Verify first analytics snapshot created
- [ ] Check promotion monitoring endpoint
- [ ] Review any errors in Vercel logs
- [ ] Test analytics dashboard with real data

### Day 2-3 (Short-term)
- [ ] Verify daily snapshots are being created
- [ ] Check promotion rates (target: ≥1 per day)
- [ ] Review promotion statistics
- [ ] Check for any alerts

### Week 1 (Validation)
- [ ] Review promotion criteria effectiveness
- [ ] Adjust criteria if needed (based on data)
- [ ] Verify time-series data accumulating
- [ ] Check analytics dashboard trends

---

## Rollback Plan

### If Critical Issues Detected

#### 1. Disable Cron Jobs
- Go to Vercel Dashboard → Cron Jobs
- Disable problematic cron jobs
- Or set invalid `CRON_SECRET` temporarily

#### 2. Revert Code
```bash
# Revert to previous deployment
vercel rollback

# Or revert git commit
git revert HEAD
git push
```

#### 3. Database Rollback (if needed)
```sql
-- Only if absolutely necessary
DROP TABLE IF EXISTS knowledge_promotion_log;
DROP TABLE IF EXISTS detection_accuracy_snapshots;
DROP TABLE IF EXISTS knowledge_analytics_snapshots;

DROP FUNCTION IF EXISTS get_analytics_trends;
DROP FUNCTION IF EXISTS get_accuracy_trends;
DROP FUNCTION IF EXISTS get_promotion_stats;
```

---

## Success Criteria

### Immediate (Day 1)
- ✅ Deployment successful
- ✅ Cron jobs configured
- ✅ Analytics dashboard accessible
- ✅ Monitoring endpoint functional

### Short-term (Week 1)
- ✅ Daily snapshots created
- ✅ Promotion automation working
- ✅ Time-series data accumulating
- ✅ No critical errors

### Long-term (Month 1)
- ✅ Promotion rate ≥1 per day
- ✅ Average trust score ≥0.90
- ✅ 50+ knowledge gaps filled
- ✅ Analytics dashboard providing insights

---

## Troubleshooting

### Issue: Analytics Dashboard Shows No Data

**Check**:
1. Are snapshots being created? `SELECT * FROM knowledge_analytics_snapshots ORDER BY date DESC LIMIT 10;`
2. Is cron job running? Check Vercel cron logs
3. API response: `/api/analytics/knowledge?includeTrends=true`

**Solution**: System falls back to simplified generation if no historical data

### Issue: Promotion Not Working

**Check**:
1. Promotion criteria: Review `KnowledgePromotionService` thresholds
2. Experimental knowledge exists: Check knowledge base table
3. Promotion logs: `SELECT * FROM knowledge_promotion_log ORDER BY promoted_at DESC LIMIT 10;`

**Solution**: Test manually via `/api/knowledge-gaps/promotion?batch=true`

### Issue: Cron Jobs Not Running

**Check**:
1. Vercel dashboard → Cron Jobs (verify configured)
2. `CRON_SECRET` set correctly
3. Authorization header in cron requests

**Solution**: Verify cron configuration in Vercel dashboard

---

## Support & Documentation

**Documentation**:
- Deployment Guide: `docs/DEPLOYMENT_GUIDE_ANALYTICS_AND_AUTOMATION_2025-02-06.md`
- Build Plans: `docs/BUILD_PLAN_*.md`
- Cycle Report: `docs/BUILDER_CYCLE_REPORT_*.md`

**API Endpoints**:
- Analytics: `/api/analytics/knowledge`
- Monitoring: `/api/monitoring/promotion`
- Promotion: `/api/knowledge-gaps/promotion`

**Deployment Scripts**:
- Windows: `scripts/deploy-analytics-automation.ps1`
- Linux/Mac: `scripts/deploy-analytics-automation.sh`

---

**Status**: ✅ **READY FOR DEPLOYMENT**

*Complete checklist before proceeding to production.*
