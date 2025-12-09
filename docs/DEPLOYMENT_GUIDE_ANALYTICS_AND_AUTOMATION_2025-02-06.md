# Deployment Guide: Analytics Dashboard & Knowledge Gap Automation

**Date**: 2025-02-06  
**Status**: Ready for Staging Deployment

---

## Pre-Deployment Checklist

### 1. Database Migrations

**Required Migration**: `20250206_analytics_timeseries.sql`

```bash
# Apply migration to Supabase
supabase migration up 20250206_analytics_timeseries
```

**Migration Creates**:
- `knowledge_analytics_snapshots` table
- `detection_accuracy_snapshots` table
- `knowledge_promotion_log` table
- Helper functions: `get_analytics_trends()`, `get_accuracy_trends()`, `get_promotion_stats()`

### 2. Environment Variables

**Required Variables** (already configured):
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET` (for cron job authentication)

**Optional Variables**:
- `NEXT_PUBLIC_APP_URL` (for internal API calls)

### 3. Vercel Cron Jobs

**Configure in `vercel.json`**:

```json
{
  "crons": [
    {
      "path": "/api/cron/analytics-snapshot",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/knowledge-gaps",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/knowledge-promotion",
      "schedule": "0 3 * * *"
    }
  ]
}
```

**Schedule**:
- Analytics Snapshot: Daily at midnight (00:00 UTC)
- Knowledge Gaps Research: Daily at 2 AM (02:00 UTC)
- Knowledge Promotion: Daily at 3 AM (03:00 UTC)

### 4. Test Coverage

**Run Tests**:
```bash
npm test
```

**Test Files**:
- `src/lib/knowledge-promotion/__tests__/KnowledgePromotionService.test.ts`

---

## Deployment Steps

### Step 1: Apply Database Migrations

```bash
# Connect to Supabase
supabase link --project-ref <your-project-ref>

# Apply migration
supabase db push
```

**Verify Migration**:
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

### Step 2: Deploy to Staging

**Vercel Deployment**:
```bash
# Deploy to staging
vercel --env=staging

# Or use Vercel dashboard
# Push to staging branch triggers auto-deploy
```

**Railway Deployment** (if applicable):
```bash
railway up
```

### Step 3: Configure Cron Jobs

**Vercel Dashboard**:
1. Go to Project Settings → Cron Jobs
2. Add three cron jobs:
   - `/api/cron/analytics-snapshot` - Daily at 00:00 UTC
   - `/api/cron/knowledge-gaps` - Daily at 02:00 UTC
   - `/api/cron/knowledge-promotion` - Daily at 03:00 UTC
3. Set `CRON_SECRET` in environment variables
4. Add `Authorization: Bearer ${CRON_SECRET}` header

### Step 4: Verify Deployment

**Health Checks**:
```bash
# Check analytics API
curl https://staging.infinityassistant.io/api/analytics/knowledge?includeTrends=true&includeAccuracy=true

# Check promotion monitoring
curl https://staging.infinityassistant.io/api/monitoring/promotion

# Check cron endpoints (with auth)
curl -H "Authorization: Bearer ${CRON_SECRET}" \
  https://staging.infinityassistant.io/api/cron/analytics-snapshot
```

**Dashboard Access**:
- Navigate to: `https://staging.infinityassistant.io/admin/knowledge-analytics`
- Verify all visualizations load
- Check timeframe selector works
- Verify real-time data updates

---

## Post-Deployment Testing

### 1. Analytics Dashboard Testing

**Test Cases**:
- [ ] Dashboard loads without errors
- [ ] All 6 visualization types display
- [ ] Timeframe selector works (day/week/month/all)
- [ ] Growth charts show data
- [ ] Detection accuracy metrics display
- [ ] Top queries table populates
- [ ] Export functionality works
- [ ] Mobile responsive

**Test Data**:
- Create test queries to generate analytics data
- Wait for daily snapshot to capture data
- Verify trends appear in charts

### 2. Knowledge Gap Automation Testing

**Test Cases**:
- [ ] Knowledge gaps identified automatically
- [ ] Research triggered for high-priority gaps
- [ ] Experimental knowledge created
- [ ] Promotion criteria evaluated correctly
- [ ] Qualified items promoted to canonical
- [ ] Promotion logged in monitoring system

**Manual Testing**:
```bash
# Trigger gap research manually
curl -X POST https://staging.infinityassistant.io/api/knowledge-gaps/research \
  -H "Content-Type: application/json" \
  -d '{"gapId": "test-gap", "category": "technology-engineering", "type": "professional"}'

# Trigger promotion manually
curl -X POST https://staging.infinityassistant.io/api/knowledge-gaps/promotion \
  -H "Content-Type: application/json" \
  -d '{"batch": true}'
```

### 3. Monitoring Testing

**Test Cases**:
- [ ] Promotion statistics API returns data
- [ ] Alerts generated for low promotion rates
- [ ] Alerts generated for quality drops
- [ ] Recent promotions list populated

**Monitoring Endpoint**:
```bash
curl https://staging.infinityassistant.io/api/monitoring/promotion?includeAlerts=true
```

---

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Promotion Rate**
   - Target: ≥ 1 promotion per day
   - Alert: < 1 promotion per day for 3+ days

2. **Average Trust Score**
   - Target: ≥ 0.90
   - Alert: < 0.90 for 3+ days

3. **Analytics Snapshot Success**
   - Target: 100% success rate
   - Alert: Any snapshot failures

4. **Knowledge Gap Research**
   - Target: 5+ gaps researched per day
   - Alert: < 5 gaps researched for 3+ days

### Monitoring Dashboard

**Access**: `/admin/knowledge-analytics`

**Metrics Displayed**:
- Total queries
- Knowledge gaps
- Experimental vs canonical trends
- Detection accuracy
- Top queries
- Promotion statistics (via monitoring API)

### Alert Configuration

**Promotion Alerts**:
- Low promotion rate: Warning
- Quality drop: Warning
- Research failures: Error

**Check Alerts**:
```bash
curl https://staging.infinityassistant.io/api/monitoring/promotion?includeAlerts=true
```

---

## Rollback Plan

### If Issues Detected

1. **Database Rollback**:
   ```sql
   -- Drop tables (if needed)
   DROP TABLE IF EXISTS knowledge_promotion_log;
   DROP TABLE IF EXISTS detection_accuracy_snapshots;
   DROP TABLE IF EXISTS knowledge_analytics_snapshots;
   
   -- Drop functions
   DROP FUNCTION IF EXISTS get_analytics_trends;
   DROP FUNCTION IF EXISTS get_accuracy_trends;
   DROP FUNCTION IF EXISTS get_promotion_stats;
   ```

2. **Code Rollback**:
   ```bash
   # Revert to previous deployment
   vercel rollback
   ```

3. **Disable Cron Jobs**:
   - Remove cron jobs from Vercel dashboard
   - Or set `CRON_SECRET` to invalid value

---

## Production Deployment

### Pre-Production Checklist

- [ ] All staging tests passed
- [ ] Database migrations applied
- [ ] Cron jobs configured
- [ ] Monitoring alerts configured
- [ ] Documentation updated
- [ ] Team notified

### Production Deployment

**Same steps as staging**, but:
1. Deploy to production environment
2. Use production Supabase database
3. Configure production cron jobs
4. Set up production monitoring alerts

---

## Troubleshooting

### Issue: Analytics Dashboard Shows No Data

**Solution**:
1. Check if snapshots are being created: `SELECT * FROM knowledge_analytics_snapshots ORDER BY date DESC LIMIT 10;`
2. Verify cron job is running: Check Vercel cron logs
3. Check API response: `/api/analytics/knowledge?includeTrends=true`

### Issue: Promotion Not Working

**Solution**:
1. Check promotion criteria: Review `KnowledgePromotionService` criteria
2. Check logs: `SELECT * FROM knowledge_promotion_log ORDER BY promoted_at DESC LIMIT 10;`
3. Verify experimental knowledge exists: Check knowledge base table
4. Test manually: Use `/api/knowledge-gaps/promotion` endpoint

### Issue: Time-Series Data Not Appearing

**Solution**:
1. Verify migration applied: Check tables exist
2. Check snapshot creation: Verify cron job running
3. Fallback: System will use simplified generation if no historical data

---

## Support

**Documentation**:
- Build Plans: `docs/BUILD_PLAN_*.md`
- Cycle Report: `docs/BUILDER_CYCLE_REPORT_*.md`

**API Documentation**:
- Analytics API: `/api/analytics/knowledge`
- Monitoring API: `/api/monitoring/promotion`
- Promotion API: `/api/knowledge-gaps/promotion`

---

*Deployment Guide - Analytics Dashboard & Knowledge Gap Automation*
