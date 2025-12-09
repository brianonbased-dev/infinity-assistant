# 🚀 DEPLOY NOW - Step-by-Step Instructions

**Date**: 2025-02-06  
**All code is committed and ready for deployment**

---

## ⚡ Quick Start (3 Steps)

### Step 1: Generate & Set CRON_SECRET

**Generate Secret** (PowerShell):
```powershell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

**Set in Vercel**:
1. Go to: https://vercel.com/dashboard
2. Select project: `infinityassistant-service`
3. Settings → Environment Variables
4. Add: `CRON_SECRET` = (paste generated value)
5. Apply to: All environments
6. Save

**⏱️ Time**: 2 minutes

---

### Step 2: Apply Database Migration

**Option A - Supabase CLI**:
```bash
supabase db push
```

**Option B - Supabase Dashboard**:
1. Go to: https://supabase.com/dashboard
2. Select your project
3. SQL Editor → New Query
4. Open: `supabase/migrations/20250206_analytics_timeseries.sql`
5. Copy entire SQL → Paste → Run

**Verify**:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('knowledge_analytics_snapshots', 'detection_accuracy_snapshots', 'knowledge_promotion_log');
```
Should return 3 rows.

**⏱️ Time**: 3-5 minutes

---

### Step 3: Deploy to Staging

**Command**:
```bash
vercel --env=staging
```

**Or via Dashboard**:
- Push to staging branch (auto-deploys)
- Or manually trigger deployment in Vercel

**⏱️ Time**: 5-10 minutes

---

## ✅ Verification Checklist

### Immediate (After Deployment)

1. **Cron Jobs** (Vercel Dashboard → Cron Jobs)
   - [ ] 5 cron jobs total (3 new ones added)
   - [ ] `/api/cron/analytics-snapshot` scheduled for 00:00 UTC
   - [ ] `/api/cron/knowledge-gaps` scheduled for 02:00 UTC
   - [ ] `/api/cron/knowledge-promotion` scheduled for 03:00 UTC

2. **Analytics Dashboard**
   - [ ] Visit: `https://staging.infinityassistant.io/admin/knowledge-analytics`
   - [ ] Page loads without errors
   - [ ] All visualizations display
   - [ ] Timeframe selector works

3. **Monitoring Endpoint**
   ```bash
   curl https://staging.infinityassistant.io/api/monitoring/promotion
   ```
   - [ ] Returns JSON with statistics
   - [ ] No errors

4. **Test Cron Endpoint** (Manual)
   ```bash
   curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
     https://staging.infinityassistant.io/api/cron/analytics-snapshot
   ```
   - [ ] Returns `{"success": true, ...}`

### Day 1 (After First Cron Run)

5. **First Snapshot Created**
   - [ ] Check database: `SELECT * FROM knowledge_analytics_snapshots ORDER BY date DESC LIMIT 1;`
   - [ ] Should have entry for today

6. **Promotion Logging**
   - [ ] Check: `SELECT * FROM knowledge_promotion_log ORDER BY promoted_at DESC LIMIT 10;`
   - [ ] Should be empty initially (no promotions yet)

---

## 📊 What to Monitor

### Key Metrics (Week 1)

- **Promotion Rate**: Target ≥1 per day
- **Average Trust Score**: Target ≥0.90
- **Snapshot Success**: 100% (check daily)
- **Knowledge Gaps Researched**: Target ≥5 per day

### Check Daily

1. **Analytics Dashboard**: Verify trends accumulating
2. **Monitoring Endpoint**: Check promotion statistics
3. **Vercel Logs**: Review for errors
4. **Database**: Verify snapshots being created

---

## 🆘 Troubleshooting

### Issue: Cron Jobs Not Running
- Check Vercel Dashboard → Cron Jobs
- Verify `CRON_SECRET` is set correctly
- Check Vercel logs for errors

### Issue: Analytics Dashboard Empty
- Normal initially (no historical data)
- Will populate after first snapshot
- System falls back to simplified generation

### Issue: Migration Failed
- Check Supabase connection
- Verify SQL syntax
- Check Supabase logs

---

## 📚 Full Documentation

- **Deployment Guide**: `docs/DEPLOYMENT_GUIDE_ANALYTICS_AND_AUTOMATION_2025-02-06.md`
- **Checklist**: `docs/DEPLOYMENT_CHECKLIST_2025-02-06.md`
- **Execution Log**: `DEPLOYMENT_EXECUTION_LOG.md`

---

## ✅ Completion Status

- [x] Code committed and pushed
- [x] Unit tests created
- [x] Build successful
- [x] Documentation complete
- [ ] **CRON_SECRET set** ⚠️
- [ ] **Migration applied** ⚠️
- [ ] **Deployed to staging** ⚠️
- [ ] **Verified** ⚠️

---

**Ready to deploy!** Complete the 3 steps above, then verify using the checklist.
