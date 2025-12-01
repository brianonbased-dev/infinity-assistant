-- Stripe Subscription Tables for Infinity Assistant
-- Created: 2024-12-01
-- Description: Tables for managing Stripe subscriptions, payments, and usage

-- ============================================================================
-- SUBSCRIPTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS infinity_assistant_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL UNIQUE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'business', 'enterprise', 'team')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete', 'incomplete_expired', 'paused', 'unpaid')),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    trial_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON infinity_assistant_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON infinity_assistant_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON infinity_assistant_subscriptions(status);

-- ============================================================================
-- PAYMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS infinity_assistant_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    stripe_customer_id TEXT NOT NULL,
    stripe_invoice_id TEXT,
    stripe_payment_intent_id TEXT,
    amount INTEGER NOT NULL, -- Amount in cents
    currency TEXT NOT NULL DEFAULT 'usd',
    status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payments_customer ON infinity_assistant_payments(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON infinity_assistant_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON infinity_assistant_payments(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON infinity_assistant_payments(status);

-- ============================================================================
-- USAGE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS infinity_assistant_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    daily_count INTEGER NOT NULL DEFAULT 0,
    monthly_count INTEGER NOT NULL DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    api_calls INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_usage_user_date ON infinity_assistant_usage(user_id, date);

-- ============================================================================
-- USERS TABLE (for profile/preferences not covered by Clerk)
-- ============================================================================

CREATE TABLE IF NOT EXISTS infinity_assistant_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL UNIQUE,
    email TEXT,
    display_name TEXT,
    avatar_url TEXT,
    tier TEXT DEFAULT 'free',
    onboarding_completed BOOLEAN DEFAULT FALSE,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_user_id ON infinity_assistant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON infinity_assistant_users(email);

-- ============================================================================
-- PRICING TIERS TABLE (for dynamic pricing configuration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS pricing_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    monthly_price INTEGER, -- Price in cents
    annual_price INTEGER,  -- Price in cents
    stripe_price_id_monthly TEXT,
    stripe_price_id_annual TEXT,
    features JSONB DEFAULT '[]',
    limits JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default pricing tiers
INSERT INTO pricing_tiers (name, display_name, description, monthly_price, annual_price, features, limits, sort_order)
VALUES
    ('free', 'Free', 'Get started with basic features', 0, 0,
     '["Basic chat", "Limited memory", "Community support"]'::jsonb,
     '{"daily": 10, "monthly": 100}'::jsonb, 0),
    ('pro', 'Pro', 'For power users who need more', 1999, 19990,
     '["Unlimited chat", "Full memory", "EV integration", "Priority support", "API access", "Custom personas"]'::jsonb,
     '{"daily": 100, "monthly": 3000}'::jsonb, 1),
    ('business', 'Business', 'For teams and businesses', 4999, 49990,
     '["All Pro features", "Team collaboration", "Shared workspaces", "Admin dashboard", "SSO integration"]'::jsonb,
     '{"daily": 500, "monthly": 15000}'::jsonb, 2),
    ('enterprise', 'Enterprise', 'Custom solutions for large organizations', NULL, NULL,
     '["All Business features", "Dedicated support", "Custom integrations", "SLA guarantee", "On-premise option"]'::jsonb,
     '{"daily": -1, "monthly": -1}'::jsonb, 3)
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    monthly_price = EXCLUDED.monthly_price,
    annual_price = EXCLUDED.annual_price,
    features = EXCLUDED.features,
    limits = EXCLUDED.limits,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

-- ============================================================================
-- FEEDBACK TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS infinity_assistant_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    conversation_id UUID,
    message_id UUID,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback_type TEXT CHECK (feedback_type IN ('positive', 'negative', 'suggestion', 'bug', 'other')),
    comment TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_feedback_user ON infinity_assistant_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_conversation ON infinity_assistant_feedback(conversation_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE infinity_assistant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE infinity_assistant_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE infinity_assistant_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE infinity_assistant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE infinity_assistant_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for backend operations)
CREATE POLICY "Service role full access subscriptions" ON infinity_assistant_subscriptions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access payments" ON infinity_assistant_payments
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access usage" ON infinity_assistant_usage
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access users" ON infinity_assistant_users
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access feedback" ON infinity_assistant_feedback
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Pricing tiers are public read
CREATE POLICY "Public read pricing tiers" ON pricing_tiers
    FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY "Service role full access pricing" ON pricing_tiers
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON infinity_assistant_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_updated_at
    BEFORE UPDATE ON infinity_assistant_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON infinity_assistant_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pricing_updated_at
    BEFORE UPDATE ON pricing_tiers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to increment usage
CREATE OR REPLACE FUNCTION increment_usage(p_user_id TEXT, p_tokens INTEGER DEFAULT 0)
RETURNS void AS $$
BEGIN
    INSERT INTO infinity_assistant_usage (user_id, date, daily_count, monthly_count, tokens_used)
    VALUES (p_user_id, CURRENT_DATE, 1, 1, p_tokens)
    ON CONFLICT (user_id, date)
    DO UPDATE SET
        daily_count = infinity_assistant_usage.daily_count + 1,
        monthly_count = infinity_assistant_usage.monthly_count + 1,
        tokens_used = infinity_assistant_usage.tokens_used + p_tokens,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to check usage limits
CREATE OR REPLACE FUNCTION check_usage_limit(p_user_id TEXT, p_tier TEXT)
RETURNS TABLE(allowed BOOLEAN, daily_remaining INTEGER, monthly_remaining INTEGER) AS $$
DECLARE
    v_limits JSONB;
    v_daily_limit INTEGER;
    v_monthly_limit INTEGER;
    v_current_daily INTEGER;
    v_current_monthly INTEGER;
BEGIN
    -- Get limits for tier
    SELECT limits INTO v_limits FROM pricing_tiers WHERE name = p_tier;

    IF v_limits IS NULL THEN
        v_limits := '{"daily": 10, "monthly": 100}'::jsonb;
    END IF;

    v_daily_limit := (v_limits->>'daily')::INTEGER;
    v_monthly_limit := (v_limits->>'monthly')::INTEGER;

    -- Get current usage
    SELECT COALESCE(daily_count, 0), COALESCE(monthly_count, 0)
    INTO v_current_daily, v_current_monthly
    FROM infinity_assistant_usage
    WHERE user_id = p_user_id AND date = CURRENT_DATE;

    IF NOT FOUND THEN
        v_current_daily := 0;
        v_current_monthly := 0;
    END IF;

    -- Check limits (-1 means unlimited)
    IF v_daily_limit = -1 AND v_monthly_limit = -1 THEN
        RETURN QUERY SELECT TRUE, -1, -1;
    ELSIF v_daily_limit = -1 THEN
        RETURN QUERY SELECT (v_current_monthly < v_monthly_limit), -1, (v_monthly_limit - v_current_monthly);
    ELSIF v_monthly_limit = -1 THEN
        RETURN QUERY SELECT (v_current_daily < v_daily_limit), (v_daily_limit - v_current_daily), -1;
    ELSE
        RETURN QUERY SELECT
            (v_current_daily < v_daily_limit AND v_current_monthly < v_monthly_limit),
            (v_daily_limit - v_current_daily),
            (v_monthly_limit - v_current_monthly);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE infinity_assistant_subscriptions IS 'User subscription records linked to Stripe';
COMMENT ON TABLE infinity_assistant_payments IS 'Payment history from Stripe';
COMMENT ON TABLE infinity_assistant_usage IS 'Daily/monthly usage tracking per user';
COMMENT ON TABLE infinity_assistant_users IS 'Extended user profiles (supplements Clerk)';
COMMENT ON TABLE pricing_tiers IS 'Dynamic pricing tier configuration';
COMMENT ON TABLE infinity_assistant_feedback IS 'User feedback and ratings';
