-- Knowledge Packets Migration
-- Stores knowledge packets for the marketplace and tracks user applications

-- ============================================================================
-- KNOWLEDGE PACKETS TABLE (Master data - synced from UAA2)
-- ============================================================================

CREATE TABLE IF NOT EXISTS knowledge_packets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id TEXT UNIQUE NOT NULL, -- ID from UAA2 master portal

    -- Basic info
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    content TEXT, -- Full markdown content

    -- Classification
    type TEXT NOT NULL CHECK (type IN ('research', 'protocol', 'insight', 'documentation', 'pattern')),
    domain TEXT NOT NULL DEFAULT 'general',
    target_mode TEXT NOT NULL CHECK (target_mode IN ('assistant', 'build', 'both')) DEFAULT 'both',

    -- Status
    status TEXT NOT NULL CHECK (status IN ('draft', 'pending_approval', 'approved', 'published', 'rejected', 'archived')) DEFAULT 'published',

    -- Metadata
    version TEXT NOT NULL DEFAULT '1.0.0',
    tags TEXT[] DEFAULT '{}',
    confidence DECIMAL(3,2) DEFAULT 0.80,

    -- Authorship
    created_by TEXT NOT NULL,
    approved_by TEXT,
    published_by TEXT,

    -- Related content
    sources TEXT[] DEFAULT '{}',
    related_packet_ids UUID[] DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,

    -- Search optimization
    search_vector TSVECTOR GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(content, '')), 'C') ||
        setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'B')
    ) STORED
);

-- Indexes for knowledge_packets
CREATE INDEX IF NOT EXISTS idx_knowledge_packets_type ON knowledge_packets(type);
CREATE INDEX IF NOT EXISTS idx_knowledge_packets_domain ON knowledge_packets(domain);
CREATE INDEX IF NOT EXISTS idx_knowledge_packets_target_mode ON knowledge_packets(target_mode);
CREATE INDEX IF NOT EXISTS idx_knowledge_packets_status ON knowledge_packets(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_packets_tags ON knowledge_packets USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_knowledge_packets_search ON knowledge_packets USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_knowledge_packets_created_at ON knowledge_packets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_packets_published_at ON knowledge_packets(published_at DESC);

-- ============================================================================
-- USER APPLIED PACKETS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_applied_packets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL, -- Can be anonymous or clerk user ID
    packet_id UUID NOT NULL REFERENCES knowledge_packets(id) ON DELETE CASCADE,

    -- Which mode the packet is applied to
    target_mode TEXT NOT NULL CHECK (target_mode IN ('assistant', 'build')),

    -- Application status
    status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'removed')) DEFAULT 'active',

    -- Timestamps
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    removed_at TIMESTAMPTZ,

    -- Ensure unique application per user/packet/mode
    UNIQUE(user_id, packet_id, target_mode)
);

-- Indexes for user_applied_packets
CREATE INDEX IF NOT EXISTS idx_user_applied_packets_user_id ON user_applied_packets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_applied_packets_packet_id ON user_applied_packets(packet_id);
CREATE INDEX IF NOT EXISTS idx_user_applied_packets_target_mode ON user_applied_packets(target_mode);
CREATE INDEX IF NOT EXISTS idx_user_applied_packets_status ON user_applied_packets(status);
CREATE INDEX IF NOT EXISTS idx_user_applied_packets_active ON user_applied_packets(user_id, target_mode) WHERE status = 'active';

-- ============================================================================
-- PACKET ANALYTICS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS packet_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    packet_id UUID NOT NULL REFERENCES knowledge_packets(id) ON DELETE CASCADE,

    -- Counters
    view_count INTEGER DEFAULT 0,
    apply_count INTEGER DEFAULT 0,
    unapply_count INTEGER DEFAULT 0,

    -- Ratings (optional future feature)
    total_rating INTEGER DEFAULT 0,
    rating_count INTEGER DEFAULT 0,

    -- Timestamps
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(packet_id)
);

-- Index for packet_analytics
CREATE INDEX IF NOT EXISTS idx_packet_analytics_packet_id ON packet_analytics(packet_id);
CREATE INDEX IF NOT EXISTS idx_packet_analytics_apply_count ON packet_analytics(apply_count DESC);

-- ============================================================================
-- PACKET APPROVAL HISTORY TABLE (Audit trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS packet_approval_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    packet_id UUID NOT NULL REFERENCES knowledge_packets(id) ON DELETE CASCADE,

    -- Action
    action TEXT NOT NULL CHECK (action IN ('submitted', 'approved', 'rejected', 'published', 'unpublished', 'archived')),

    -- Actor
    performed_by TEXT NOT NULL,

    -- Details
    notes TEXT,
    reason TEXT,

    -- Previous state
    previous_status TEXT,
    new_status TEXT,

    -- Timestamps
    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for packet_approval_history
CREATE INDEX IF NOT EXISTS idx_packet_approval_history_packet_id ON packet_approval_history(packet_id);
CREATE INDEX IF NOT EXISTS idx_packet_approval_history_performed_at ON packet_approval_history(performed_at DESC);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update packet analytics on apply
CREATE OR REPLACE FUNCTION increment_packet_apply_count()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO packet_analytics (packet_id, apply_count)
    VALUES (NEW.packet_id, 1)
    ON CONFLICT (packet_id)
    DO UPDATE SET
        apply_count = packet_analytics.apply_count + 1,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update packet analytics on unapply
CREATE OR REPLACE FUNCTION increment_packet_unapply_count()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'active' AND NEW.status = 'removed' THEN
        UPDATE packet_analytics
        SET unapply_count = unapply_count + 1, updated_at = NOW()
        WHERE packet_id = NEW.packet_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_knowledge_packet_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger for apply count
DROP TRIGGER IF EXISTS trigger_increment_apply_count ON user_applied_packets;
CREATE TRIGGER trigger_increment_apply_count
    AFTER INSERT ON user_applied_packets
    FOR EACH ROW
    EXECUTE FUNCTION increment_packet_apply_count();

-- Trigger for unapply count
DROP TRIGGER IF EXISTS trigger_increment_unapply_count ON user_applied_packets;
CREATE TRIGGER trigger_increment_unapply_count
    AFTER UPDATE ON user_applied_packets
    FOR EACH ROW
    EXECUTE FUNCTION increment_packet_unapply_count();

-- Trigger for timestamp updates
DROP TRIGGER IF EXISTS trigger_update_packet_timestamp ON knowledge_packets;
CREATE TRIGGER trigger_update_packet_timestamp
    BEFORE UPDATE ON knowledge_packets
    FOR EACH ROW
    EXECUTE FUNCTION update_knowledge_packet_timestamp();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE knowledge_packets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_applied_packets ENABLE ROW LEVEL SECURITY;
ALTER TABLE packet_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE packet_approval_history ENABLE ROW LEVEL SECURITY;

-- Knowledge packets: Anyone can read published packets
CREATE POLICY "Published packets are viewable by everyone" ON knowledge_packets
    FOR SELECT USING (status = 'published');

-- User applied packets: Users can only see their own
CREATE POLICY "Users can view their own applied packets" ON user_applied_packets
    FOR SELECT USING (true); -- We filter by user_id in the application

CREATE POLICY "Users can insert their own applied packets" ON user_applied_packets
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own applied packets" ON user_applied_packets
    FOR UPDATE USING (true);

-- Analytics: Public read
CREATE POLICY "Analytics are viewable by everyone" ON packet_analytics
    FOR SELECT USING (true);

-- ============================================================================
-- INITIAL SEED DATA (Example packets)
-- ============================================================================

INSERT INTO knowledge_packets (
    external_id, title, summary, content, type, domain, target_mode, status,
    version, tags, created_by, published_by, published_at
) VALUES
(
    'seed-packet-typescript-patterns',
    'TypeScript Best Practices',
    'Common TypeScript patterns and best practices for modern web development.',
    E'# TypeScript Best Practices\n\n## Type Safety\n- Always use strict mode\n- Prefer interfaces over type aliases for objects\n- Use generics for reusable components\n\n## Code Patterns\n```typescript\n// Good: Explicit return types\nfunction getUser(id: string): Promise<User> {\n  return fetch(`/api/users/${id}`).then(r => r.json());\n}\n\n// Good: Union types for states\ntype LoadingState = \"idle\" | \"loading\" | \"success\" | \"error\";\n```',
    'pattern',
    'development',
    'build',
    'published',
    '1.0.0',
    ARRAY['typescript', 'patterns', 'best-practices'],
    'system',
    'system',
    NOW()
),
(
    'seed-packet-react-hooks',
    'React Hooks Patterns',
    'Essential React hooks patterns for state management and side effects.',
    E'# React Hooks Patterns\n\n## Custom Hooks\n```typescript\nfunction useLocalStorage<T>(key: string, initialValue: T) {\n  const [value, setValue] = useState<T>(() => {\n    const stored = localStorage.getItem(key);\n    return stored ? JSON.parse(stored) : initialValue;\n  });\n\n  useEffect(() => {\n    localStorage.setItem(key, JSON.stringify(value));\n  }, [key, value]);\n\n  return [value, setValue] as const;\n}\n```',
    'pattern',
    'development',
    'build',
    'published',
    '1.0.0',
    ARRAY['react', 'hooks', 'state-management'],
    'system',
    'system',
    NOW()
),
(
    'seed-packet-api-design',
    'REST API Design Guidelines',
    'Best practices for designing RESTful APIs with clear conventions.',
    E'# REST API Design Guidelines\n\n## URL Structure\n- Use nouns, not verbs: `/users` not `/getUsers`\n- Use plural nouns: `/users` not `/user`\n- Use hyphens for readability: `/user-profiles`\n\n## HTTP Methods\n- GET: Read\n- POST: Create\n- PUT: Full update\n- PATCH: Partial update\n- DELETE: Remove\n\n## Response Codes\n- 200: Success\n- 201: Created\n- 400: Bad request\n- 401: Unauthorized\n- 404: Not found\n- 500: Server error',
    'documentation',
    'architecture',
    'both',
    'published',
    '1.0.0',
    ARRAY['api', 'rest', 'design', 'backend'],
    'system',
    'system',
    NOW()
),
(
    'seed-packet-ai-prompting',
    'Effective AI Prompting Techniques',
    'Strategies for getting better results from AI assistants through effective prompting.',
    E'# Effective AI Prompting\n\n## Key Principles\n1. **Be Specific**: Clear, detailed prompts get better results\n2. **Provide Context**: Give background information\n3. **Set Constraints**: Define format, length, style\n4. **Use Examples**: Show what you want\n\n## Prompt Structure\n```\n[Role] You are a [expert type]\n[Context] Given [background]\n[Task] Please [specific action]\n[Format] Output as [format]\n```',
    'insight',
    'ai',
    'assistant',
    'published',
    '1.0.0',
    ARRAY['ai', 'prompting', 'assistant', 'productivity'],
    'system',
    'system',
    NOW()
)
ON CONFLICT (external_id) DO NOTHING;

-- Initialize analytics for seed packets
INSERT INTO packet_analytics (packet_id)
SELECT id FROM knowledge_packets WHERE external_id LIKE 'seed-packet-%'
ON CONFLICT (packet_id) DO NOTHING;
