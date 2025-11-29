-- ============================================================================
-- Infinity Assistant Session & Memory Tables
--
-- Hybrid persistence model:
-- - Sessions & messages stored in database (conversation context)
-- - Compressed memories stored locally by user (editable)
--
-- This migration creates the database-side persistence.
-- ============================================================================

-- ============================================================================
-- CONVERSATION SESSIONS
-- Tracks conversation sessions and their state
-- ============================================================================

CREATE TABLE IF NOT EXISTS infinity_assistant_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    message_count INTEGER NOT NULL DEFAULT 0,
    current_phase TEXT NOT NULL DEFAULT 'intake',
    cycle_count INTEGER NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}',

    -- Indexes for common queries
    CONSTRAINT valid_phase CHECK (
        current_phase IN ('intake', 'reflect', 'execute', 'compress', 'reintake', 'grow', 'evolve', 'autonomize')
    )
);

-- Index for user's sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON infinity_assistant_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON infinity_assistant_sessions(last_active_at DESC);

-- ============================================================================
-- SESSION MESSAGES
-- Recent messages for each session (older messages compressed locally)
-- ============================================================================

CREATE TABLE IF NOT EXISTS infinity_assistant_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES infinity_assistant_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    importance TEXT NOT NULL DEFAULT 'medium',
    phase TEXT NOT NULL DEFAULT 'intake',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',

    CONSTRAINT valid_role CHECK (role IN ('user', 'assistant', 'system')),
    CONSTRAINT valid_importance CHECK (importance IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT valid_message_phase CHECK (
        phase IN ('intake', 'reflect', 'execute', 'compress', 'reintake', 'grow', 'evolve', 'autonomize')
    )
);

-- Index for session's messages
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON infinity_assistant_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON infinity_assistant_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_importance ON infinity_assistant_messages(importance) WHERE importance IN ('high', 'critical');

-- ============================================================================
-- PHASE TRANSITIONS
-- Records phase changes for training data and analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS infinity_assistant_phase_transitions (
    id SERIAL PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES infinity_assistant_sessions(id) ON DELETE CASCADE,
    from_phase TEXT NOT NULL,
    to_phase TEXT NOT NULL,
    trigger TEXT, -- What triggered the transition
    insights TEXT[], -- Key insights from the phase
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_from_phase CHECK (
        from_phase IN ('intake', 'reflect', 'execute', 'compress', 'reintake', 'grow', 'evolve', 'autonomize')
    ),
    CONSTRAINT valid_to_phase CHECK (
        to_phase IN ('intake', 'reflect', 'execute', 'compress', 'reintake', 'grow', 'evolve', 'autonomize')
    )
);

-- Index for session's transitions
CREATE INDEX IF NOT EXISTS idx_transitions_session ON infinity_assistant_phase_transitions(session_id);
CREATE INDEX IF NOT EXISTS idx_transitions_timestamp ON infinity_assistant_phase_transitions(timestamp DESC);

-- ============================================================================
-- USER CONTENT (for content storage service)
-- ============================================================================

CREATE TABLE IF NOT EXISTS infinity_assistant_user_content (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    "contentType" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    size BIGINT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "bucketName" TEXT NOT NULL,
    "thumbnailPath" TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "lastAccessedAt" TIMESTAMPTZ
);

-- Indexes for user content
CREATE INDEX IF NOT EXISTS idx_user_content_user_id ON infinity_assistant_user_content("userId");
CREATE INDEX IF NOT EXISTS idx_user_content_type ON infinity_assistant_user_content("contentType");
CREATE INDEX IF NOT EXISTS idx_user_content_created ON infinity_assistant_user_content("createdAt" DESC);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to increment message count
CREATE OR REPLACE FUNCTION increment_message_count(session_id TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE infinity_assistant_sessions
    SET message_count = message_count + 1,
        last_active_at = NOW()
    WHERE id = session_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment cycle count
CREATE OR REPLACE FUNCTION increment_cycle_count(session_id TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE infinity_assistant_sessions
    SET cycle_count = cycle_count + 1,
        last_active_at = NOW()
    WHERE id = session_id;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old messages (keep last N per session)
CREATE OR REPLACE FUNCTION cleanup_old_messages(keep_count INTEGER DEFAULT 50)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    WITH ranked_messages AS (
        SELECT id, session_id,
               ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY timestamp DESC) as rn
        FROM infinity_assistant_messages
    ),
    to_delete AS (
        SELECT id FROM ranked_messages WHERE rn > keep_count
    )
    DELETE FROM infinity_assistant_messages
    WHERE id IN (SELECT id FROM to_delete);

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on tables
ALTER TABLE infinity_assistant_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE infinity_assistant_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE infinity_assistant_phase_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE infinity_assistant_user_content ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own sessions
CREATE POLICY sessions_user_policy ON infinity_assistant_sessions
    FOR ALL
    USING (user_id = current_setting('app.user_id', true)::TEXT OR current_setting('app.user_id', true) IS NULL);

-- Policy: Users can only access messages in their sessions
CREATE POLICY messages_user_policy ON infinity_assistant_messages
    FOR ALL
    USING (
        session_id IN (
            SELECT id FROM infinity_assistant_sessions
            WHERE user_id = current_setting('app.user_id', true)::TEXT
        )
        OR current_setting('app.user_id', true) IS NULL
    );

-- Policy: Users can only access their content
CREATE POLICY content_user_policy ON infinity_assistant_user_content
    FOR ALL
    USING ("userId" = current_setting('app.user_id', true)::TEXT OR current_setting('app.user_id', true) IS NULL);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE infinity_assistant_sessions IS 'Conversation sessions for Infinity Assistant';
COMMENT ON TABLE infinity_assistant_messages IS 'Recent messages (older messages compressed to local storage)';
COMMENT ON TABLE infinity_assistant_phase_transitions IS 'Phase transitions for uAA2++ protocol tracking';
COMMENT ON TABLE infinity_assistant_user_content IS 'User uploaded and AI generated content';

COMMENT ON COLUMN infinity_assistant_sessions.current_phase IS 'Current uAA2++ phase: intake, reflect, execute, compress, reintake, grow, evolve, autonomize';
COMMENT ON COLUMN infinity_assistant_sessions.cycle_count IS 'Number of complete uAA2++ cycles in this session';
COMMENT ON COLUMN infinity_assistant_messages.importance IS 'Message importance: low, medium, high, critical (critical never auto-deleted)';
