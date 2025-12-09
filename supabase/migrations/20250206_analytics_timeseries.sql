-- ============================================================================
-- Analytics Time-Series Tables
--
-- Stores historical analytics data for trend visualization
-- Replaces simplified trend generation with real historical data
-- ============================================================================

-- ============================================================================
-- KNOWLEDGE ANALYTICS SNAPSHOTS
-- Daily snapshots of knowledge metrics
-- ============================================================================

CREATE TABLE IF NOT EXISTS knowledge_analytics_snapshots (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    mode TEXT NOT NULL CHECK (mode IN ('professional', 'companion', 'all')),
    
    -- Professional mode metrics
    professional_queries INTEGER NOT NULL DEFAULT 0,
    professional_gaps INTEGER NOT NULL DEFAULT 0,
    professional_experimental INTEGER NOT NULL DEFAULT 0,
    professional_canonical INTEGER NOT NULL DEFAULT 0,
    
    -- Companion mode metrics
    companion_queries INTEGER NOT NULL DEFAULT 0,
    companion_gaps INTEGER NOT NULL DEFAULT 0,
    companion_experimental INTEGER NOT NULL DEFAULT 0,
    companion_canonical INTEGER NOT NULL DEFAULT 0,
    
    -- Overall metrics
    total_queries INTEGER NOT NULL DEFAULT 0,
    total_gaps INTEGER NOT NULL DEFAULT 0,
    total_experimental INTEGER NOT NULL DEFAULT 0,
    total_canonical INTEGER NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Unique constraint: one snapshot per date and mode
    UNIQUE(date, mode)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_date ON knowledge_analytics_snapshots(date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_mode ON knowledge_analytics_snapshots(mode);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_date_mode ON knowledge_analytics_snapshots(date DESC, mode);

-- ============================================================================
-- DETECTION ACCURACY SNAPSHOTS
-- Daily snapshots of detection accuracy metrics
-- ============================================================================

CREATE TABLE IF NOT EXISTS detection_accuracy_snapshots (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Overall accuracy
    overall_accuracy DECIMAL(5, 2) NOT NULL DEFAULT 0,
    total_feedback INTEGER NOT NULL DEFAULT 0,
    corrections INTEGER NOT NULL DEFAULT 0,
    
    -- Mode-specific accuracy
    professional_accuracy DECIMAL(5, 2),
    companion_accuracy DECIMAL(5, 2),
    
    -- Category-specific accuracy (stored as JSONB for flexibility)
    category_accuracy JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Unique constraint: one snapshot per date
    UNIQUE(date)
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_accuracy_snapshots_date ON detection_accuracy_snapshots(date DESC);

-- ============================================================================
-- KNOWLEDGE PROMOTION LOG
-- Tracks all promotion events for monitoring
-- ============================================================================

CREATE TABLE IF NOT EXISTS knowledge_promotion_log (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    experimental_id TEXT NOT NULL,
    canonical_id TEXT NOT NULL,
    
    -- Promotion details
    trust_score DECIMAL(5, 4) NOT NULL,
    validation_count INTEGER NOT NULL,
    age_days INTEGER NOT NULL,
    usage_count INTEGER NOT NULL,
    
    -- Metadata
    type TEXT NOT NULL CHECK (type IN ('wisdom', 'pattern', 'gotcha')),
    domain TEXT NOT NULL,
    source TEXT,
    
    -- Timestamps
    promoted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Metadata
    metadata JSONB DEFAULT '{}'
);

-- Indexes for monitoring queries
CREATE INDEX IF NOT EXISTS idx_promotion_log_promoted_at ON knowledge_promotion_log(promoted_at DESC);
CREATE INDEX IF NOT EXISTS idx_promotion_log_domain ON knowledge_promotion_log(domain);
CREATE INDEX IF NOT EXISTS idx_promotion_log_type ON knowledge_promotion_log(type);

-- ============================================================================
-- FUNCTIONS
-- Helper functions for analytics
-- ============================================================================

-- Function to get trend data for a date range
CREATE OR REPLACE FUNCTION get_analytics_trends(
    p_start_date DATE,
    p_end_date DATE,
    p_mode TEXT DEFAULT 'all'
)
RETURNS TABLE (
    date DATE,
    queries INTEGER,
    gaps INTEGER,
    experimental INTEGER,
    canonical INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.date,
        CASE 
            WHEN p_mode = 'professional' THEN s.professional_queries
            WHEN p_mode = 'companion' THEN s.companion_queries
            ELSE s.total_queries
        END as queries,
        CASE 
            WHEN p_mode = 'professional' THEN s.professional_gaps
            WHEN p_mode = 'companion' THEN s.companion_gaps
            ELSE s.total_gaps
        END as gaps,
        CASE 
            WHEN p_mode = 'professional' THEN s.professional_experimental
            WHEN p_mode = 'companion' THEN s.companion_experimental
            ELSE s.total_experimental
        END as experimental,
        CASE 
            WHEN p_mode = 'professional' THEN s.professional_canonical
            WHEN p_mode = 'companion' THEN s.companion_canonical
            ELSE s.total_canonical
        END as canonical
    FROM knowledge_analytics_snapshots s
    WHERE s.date BETWEEN p_start_date AND p_end_date
        AND (p_mode = 'all' OR s.mode = p_mode OR s.mode = 'all')
    ORDER BY s.date ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to get accuracy trend data
CREATE OR REPLACE FUNCTION get_accuracy_trends(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    date DATE,
    accuracy DECIMAL(5, 2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.date,
        a.overall_accuracy as accuracy
    FROM detection_accuracy_snapshots a
    WHERE a.date BETWEEN p_start_date AND p_end_date
    ORDER BY a.date ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to get promotion statistics
CREATE OR REPLACE FUNCTION get_promotion_stats(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    total_promotions BIGINT,
    avg_trust_score DECIMAL(5, 4),
    avg_validation_count NUMERIC,
    avg_age_days NUMERIC,
    promotions_by_type JSONB,
    promotions_by_domain JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_promotions,
        AVG(trust_score)::DECIMAL(5, 4) as avg_trust_score,
        AVG(validation_count)::NUMERIC as avg_validation_count,
        AVG(age_days)::NUMERIC as avg_age_days,
        jsonb_object_agg(type, count) FILTER (WHERE type IS NOT NULL) as promotions_by_type,
        jsonb_object_agg(domain, count) FILTER (WHERE domain IS NOT NULL) as promotions_by_domain
    FROM (
        SELECT 
            type,
            domain,
            COUNT(*) as count
        FROM knowledge_promotion_log
        WHERE (p_start_date IS NULL OR promoted_at::DATE >= p_start_date)
            AND (p_end_date IS NULL OR promoted_at::DATE <= p_end_date)
        GROUP BY type, domain
    ) subq
    CROSS JOIN (
        SELECT 
            AVG(trust_score) as avg_trust_score,
            AVG(validation_count) as avg_validation_count,
            AVG(age_days) as avg_age_days
        FROM knowledge_promotion_log
        WHERE (p_start_date IS NULL OR promoted_at::DATE >= p_start_date)
            AND (p_end_date IS NULL OR promoted_at::DATE <= p_end_date)
    ) stats;
END;
$$ LANGUAGE plpgsql;
