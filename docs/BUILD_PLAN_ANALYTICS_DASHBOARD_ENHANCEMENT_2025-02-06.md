# Build Plan: Analytics Dashboard Enhancement

**Date**: 2025-02-06  
**Builder Agent**: Analytics Dashboard Foundation Directive  
**Status**: IN PROGRESS

---

## Executive Summary

Enhance the existing analytics dashboard at `/admin/knowledge-analytics` with missing visualizations and metrics as specified in CEO Directive XXX.

**Current State**: Basic dashboard exists with summary cards, top categories, and knowledge gaps table.

**Target State**: Complete dashboard with all 6 visualization types:
1. ✅ Job Category Growth Charts (enhance with time series)
2. ✅ Life Context/Interest Growth Charts (enhance with time series)
3. ✅ Knowledge Gap Heatmaps (enhance visualization)
4. ✅ Top Queries Per Category (add dedicated section)
5. ✅ Experimental vs Canonical Knowledge Trends (add trend charts)
6. ✅ Detection Accuracy Metrics (new section)

---

## Technical Requirements

### 1. Growth Over Time Charts

**Implementation**:
- Add time-series data tracking to `JobKnowledgeTracker` and `InterestKnowledgeTracker`
- Create LineChart components showing growth trends
- Support timeframes: day, week, month, all

**Data Structure**:
```typescript
interface TimeSeriesData {
  date: string;
  queries: number;
  gaps: number;
  experimental: number;
  canonical: number;
}
```

### 2. Detection Accuracy Metrics

**Implementation**:
- Enhance `/api/analytics/knowledge` to include detection accuracy data
- Create accuracy visualization (line chart over time)
- Add category-specific accuracy breakdown
- Show improvement trends

**Data Source**: `/api/detection/feedback` endpoint

### 3. Experimental vs Canonical Trends

**Implementation**:
- Add stacked area chart showing experimental vs canonical over time
- Show promotion rate (experimental → canonical)
- Display quality metrics

### 4. Top Queries Per Category

**Implementation**:
- Enhance existing top queries display
- Add query trend visualization
- Add category-specific query insights

### 5. Knowledge Gap Heatmap Enhancement

**Implementation**:
- Create visual heatmap using color intensity
- Show gaps by category and context
- Add priority visualization

---

## Architecture Design

### Component Structure

```
/admin/knowledge-analytics/page.tsx
├── SummaryCards (existing)
├── GrowthCharts (new)
│   ├── JobCategoryGrowthChart
│   └── InterestGrowthChart
├── DetectionAccuracySection (new)
│   ├── AccuracyTrendChart
│   └── CategoryAccuracyBreakdown
├── KnowledgeTrendsSection (new)
│   ├── ExperimentalVsCanonicalChart
│   └── PromotionRateChart
├── TopQueriesSection (new)
│   ├── TopQueriesTable
│   └── QueryTrendChart
└── KnowledgeGapHeatmap (enhanced)
```

### API Enhancements

**Enhanced Endpoint**: `/api/analytics/knowledge`

**New Query Parameters**:
- `timeframe`: 'day' | 'week' | 'month' | 'all'
- `includeAccuracy`: boolean
- `includeTrends`: boolean

**Response Structure**:
```typescript
{
  summary: {...},
  professional: {...},
  companion: {...},
  trends: {
    jobCategories: TimeSeriesData[],
    interests: TimeSeriesData[],
    experimental: TimeSeriesData[],
    canonical: TimeSeriesData[],
  },
  accuracy: {
    overall: number,
    byCategory: Record<string, number>,
    trend: TimeSeriesData[],
  },
  topQueries: {
    byCategory: Record<string, QueryData[]>,
    global: QueryData[],
  },
  knowledgeGaps: {...}
}
```

---

## Implementation Plan

### Phase 1: Data Layer Enhancements (2-3 hours)

1. **Enhance Trackers with Time Series**
   - Add time-series tracking to `JobKnowledgeTracker`
   - Add time-series tracking to `InterestKnowledgeTracker`
   - Store daily snapshots

2. **Enhance Analytics API**
   - Add timeframe filtering
   - Add accuracy data aggregation
   - Add trend calculations

### Phase 2: UI Components (3-4 hours)

1. **Growth Charts**
   - Create `GrowthChart` component
   - Add timeframe selector
   - Implement LineChart with multiple series

2. **Detection Accuracy Section**
   - Create `DetectionAccuracySection` component
   - Add accuracy trend chart
   - Add category breakdown

3. **Knowledge Trends Section**
   - Create `KnowledgeTrendsSection` component
   - Add stacked area chart
   - Add promotion rate metrics

4. **Top Queries Section**
   - Enhance query display
   - Add query trend visualization

5. **Heatmap Enhancement**
   - Improve visual heatmap
   - Add priority indicators

### Phase 3: Integration & Testing (1-2 hours)

1. **Integration**
   - Wire up all components
   - Test data flow
   - Verify real-time updates

2. **Testing**
   - Test with various timeframes
   - Test with empty data
   - Test responsiveness

---

## Success Criteria

- ✅ All 6 visualization types implemented
- ✅ Growth over time charts functional
- ✅ Detection accuracy metrics displayed
- ✅ Experimental vs canonical trends visible
- ✅ Top queries per category shown
- ✅ Enhanced knowledge gap heatmap
- ✅ Real-time data updates working
- ✅ Export functionality working
- ✅ Mobile responsive

---

## Timeline

- **Phase 1**: 2-3 hours (Data layer)
- **Phase 2**: 3-4 hours (UI components)
- **Phase 3**: 1-2 hours (Integration & testing)
- **Total**: 6-9 hours (1-2 days)

---

## Dependencies

- ✅ Recharts library (already installed)
- ✅ Existing analytics API
- ✅ Existing tracking infrastructure
- ✅ Detection feedback API

---

## Risks & Mitigation

**Risk**: Time-series data storage may require database changes
**Mitigation**: Use in-memory tracking with periodic snapshots, or add simple time-series table

**Risk**: Performance with large datasets
**Mitigation**: Implement pagination, caching, and data aggregation

---

*Builder Agent - Analytics Dashboard Enhancement*
