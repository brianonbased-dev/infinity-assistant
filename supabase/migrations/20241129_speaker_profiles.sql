-- ============================================================================
-- Speaker Profiles & Family Recognition Tables
--
-- Hybrid storage strategy:
-- - Database: Fast online access, real-time sync, search
-- - File-based: Offline access, user-editable, backup
--
-- Features:
-- - Voice/speaker recognition profiles
-- - Family member management
-- - Personalized greetings
-- - Communication style preferences
-- - Remembered facts per speaker
-- ============================================================================

-- ============================================================================
-- SPEAKER PROFILES
-- Individual speaker recognition with style fingerprinting
-- ============================================================================

CREATE TABLE IF NOT EXISTS infinity_speaker_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,  -- The account owner

    -- Identity
    name TEXT,
    nickname TEXT,
    relationship TEXT,  -- parent, child, grandparent, friend, other

    -- Language preferences
    detected_language VARCHAR(10) DEFAULT 'en',
    preferred_language VARCHAR(10),

    -- Age estimation
    estimated_age VARCHAR(20) DEFAULT 'adult',
    -- Options: child, teen, adult, senior

    -- Communication style (detected)
    communication_style VARCHAR(50) DEFAULT 'friendly',
    -- Options: casual, friendly, professional, technical, academic, supportive

    vocabulary_level VARCHAR(20) DEFAULT 'intermediate',
    -- Options: simple, intermediate, advanced, technical

    formality_level VARCHAR(20) DEFAULT 'neutral',
    -- Options: very_casual, casual, neutral, formal, very_formal

    -- Style fingerprint for recognition (JSONB for flexibility)
    style_fingerprint JSONB DEFAULT '{
        "avgWordLength": 0,
        "avgMessageLength": 0,
        "punctuationStyle": "standard",
        "emojiUsage": "rare",
        "greetingStyle": null,
        "signaturePatterns": []
    }'::jsonb,

    -- Personalization
    interests TEXT[] DEFAULT '{}',
    remembered_facts TEXT[] DEFAULT '{}',

    -- Statistics
    message_count INTEGER DEFAULT 0,
    confidence DECIMAL(3,2) DEFAULT 0.5,

    -- Timestamps
    first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Sync tracking
    file_sync_at TIMESTAMPTZ,  -- Last synced to file storage
    needs_file_sync BOOLEAN DEFAULT true
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_speaker_profiles_user_id ON infinity_speaker_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_speaker_profiles_name ON infinity_speaker_profiles(name);
CREATE INDEX IF NOT EXISTS idx_speaker_profiles_relationship ON infinity_speaker_profiles(relationship);
CREATE INDEX IF NOT EXISTS idx_speaker_profiles_age ON infinity_speaker_profiles(estimated_age);
CREATE INDEX IF NOT EXISTS idx_speaker_profiles_last_seen ON infinity_speaker_profiles(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_speaker_profiles_needs_sync ON infinity_speaker_profiles(needs_file_sync) WHERE needs_file_sync = true;

-- Full-text search on name and interests
CREATE INDEX IF NOT EXISTS idx_speaker_profiles_interests ON infinity_speaker_profiles USING gin(interests);
CREATE INDEX IF NOT EXISTS idx_speaker_profiles_facts ON infinity_speaker_profiles USING gin(remembered_facts);

-- ============================================================================
-- FAMILY GROUPS
-- Organize speakers into family/household units
-- ============================================================================

CREATE TABLE IF NOT EXISTS infinity_family_groups (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,  -- Account owner

    -- Family info
    family_name TEXT NOT NULL,
    household_languages TEXT[] DEFAULT '{"en"}',
    primary_language VARCHAR(10) DEFAULT 'en',

    -- Family settings
    has_children BOOLEAN DEFAULT false,
    child_safety_level VARCHAR(20) DEFAULT 'family',
    -- Options: open, family, strict

    -- Cultural context
    cultural_background TEXT[] DEFAULT '{}',

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_family_groups_user_id ON infinity_family_groups(user_id);

-- ============================================================================
-- FAMILY MEMBERSHIPS
-- Link speakers to family groups
-- ============================================================================

CREATE TABLE IF NOT EXISTS infinity_family_memberships (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES infinity_family_groups(id) ON DELETE CASCADE,
    speaker_id TEXT NOT NULL REFERENCES infinity_speaker_profiles(id) ON DELETE CASCADE,

    -- Role in family
    role VARCHAR(50) DEFAULT 'member',
    -- Options: owner, parent, child, guardian, grandparent, other

    -- Permissions
    can_modify_settings BOOLEAN DEFAULT false,

    -- Timestamps
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(family_id, speaker_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_family_memberships_family ON infinity_family_memberships(family_id);
CREATE INDEX IF NOT EXISTS idx_family_memberships_speaker ON infinity_family_memberships(speaker_id);

-- ============================================================================
-- GREETING TEMPLATES
-- Customizable greetings per age/relationship
-- ============================================================================

CREATE TABLE IF NOT EXISTS infinity_greeting_templates (
    id TEXT PRIMARY KEY,
    user_id TEXT,  -- NULL = system default

    -- Target
    age_group VARCHAR(20),  -- child, teen, adult, senior
    relationship TEXT,  -- parent, child, etc.
    is_returning BOOLEAN DEFAULT false,

    -- Greeting
    greeting TEXT NOT NULL,
    language VARCHAR(10) DEFAULT 'en',

    -- Usage
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_greetings_user ON infinity_greeting_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_greetings_age ON infinity_greeting_templates(age_group);
CREATE INDEX IF NOT EXISTS idx_greetings_lang ON infinity_greeting_templates(language);

-- Insert default greetings
INSERT INTO infinity_greeting_templates (id, user_id, age_group, is_returning, greeting, language) VALUES
-- Child greetings (English)
('greet_child_1', NULL, 'child', false, 'Hey buddy! What''s up?', 'en'),
('greet_child_2', NULL, 'child', false, 'Hi there, little one! How can I help?', 'en'),
('greet_child_3', NULL, 'child', false, 'Hello! Ready to learn something cool?', 'en'),
('greet_child_4', NULL, 'child', false, 'Hey! What are we doing today?', 'en'),
('greet_child_ret_1', NULL, 'child', true, 'Hey {name}! Good to see you again!', 'en'),
('greet_child_ret_2', NULL, 'child', true, 'Hi {name}! What are we learning today?', 'en'),

-- Teen greetings (English)
('greet_teen_1', NULL, 'teen', false, 'Hey! What''s going on?', 'en'),
('greet_teen_2', NULL, 'teen', false, 'Hey there! How can I help?', 'en'),
('greet_teen_ret_1', NULL, 'teen', true, 'Hey {name}! What''s up?', 'en'),

-- Adult greetings (English)
('greet_adult_1', NULL, 'adult', false, 'Hello! How can I help you today?', 'en'),
('greet_adult_2', NULL, 'adult', false, 'Hi there! What can I assist you with?', 'en'),
('greet_adult_ret_1', NULL, 'adult', true, 'Welcome back, {name}! How can I help?', 'en'),
('greet_adult_ret_2', NULL, 'adult', true, 'Hi {name}! Good to see you again.', 'en'),

-- Senior greetings (English)
('greet_senior_1', NULL, 'senior', false, 'Hello! How are you today?', 'en'),
('greet_senior_2', NULL, 'senior', false, 'Hi there! How can I help you?', 'en'),

-- Child greetings (Spanish)
('greet_child_es_1', NULL, 'child', false, 'Hola amiguito! Que tal?', 'es'),
('greet_child_es_2', NULL, 'child', false, 'Hola! Listo para aprender algo nuevo?', 'es'),
('greet_child_ret_es_1', NULL, 'child', true, 'Hola {name}! Que bueno verte!', 'es'),

-- Adult greetings (Spanish)
('greet_adult_es_1', NULL, 'adult', false, 'Hola! En que puedo ayudarte hoy?', 'es'),
('greet_adult_ret_es_1', NULL, 'adult', true, 'Bienvenido de nuevo, {name}! Como puedo ayudarte?', 'es')

ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_speaker_profiles_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.needs_file_sync = true;  -- Mark for sync
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_speaker_profiles_timestamp
    BEFORE UPDATE ON infinity_speaker_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_speaker_profiles_timestamp();

CREATE TRIGGER trigger_update_family_groups_timestamp
    BEFORE UPDATE ON infinity_family_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_speaker_profiles_timestamp();

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Get random greeting for age group
CREATE OR REPLACE FUNCTION get_greeting(
    p_age_group VARCHAR(20),
    p_is_returning BOOLEAN DEFAULT false,
    p_language VARCHAR(10) DEFAULT 'en',
    p_speaker_name TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    v_greeting TEXT;
BEGIN
    SELECT greeting INTO v_greeting
    FROM infinity_greeting_templates
    WHERE (age_group = p_age_group OR age_group IS NULL)
      AND is_returning = p_is_returning
      AND language = p_language
      AND user_id IS NULL  -- System defaults
    ORDER BY RANDOM()
    LIMIT 1;

    -- Replace {name} placeholder
    IF p_speaker_name IS NOT NULL AND v_greeting IS NOT NULL THEN
        v_greeting := REPLACE(v_greeting, '{name}', p_speaker_name);
    END IF;

    RETURN COALESCE(v_greeting, 'Hello! How can I help you?');
END;
$$ LANGUAGE plpgsql;

-- Get or create speaker profile
CREATE OR REPLACE FUNCTION upsert_speaker_profile(
    p_id TEXT,
    p_user_id TEXT,
    p_name TEXT DEFAULT NULL,
    p_detected_language VARCHAR(10) DEFAULT 'en',
    p_estimated_age VARCHAR(20) DEFAULT 'adult',
    p_style_fingerprint JSONB DEFAULT NULL
)
RETURNS infinity_speaker_profiles AS $$
DECLARE
    v_profile infinity_speaker_profiles;
BEGIN
    INSERT INTO infinity_speaker_profiles (
        id, user_id, name, detected_language, estimated_age, style_fingerprint
    ) VALUES (
        p_id, p_user_id, p_name, p_detected_language, p_estimated_age,
        COALESCE(p_style_fingerprint, '{}'::jsonb)
    )
    ON CONFLICT (id) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, infinity_speaker_profiles.name),
        detected_language = EXCLUDED.detected_language,
        estimated_age = EXCLUDED.estimated_age,
        last_seen = NOW(),
        message_count = infinity_speaker_profiles.message_count + 1,
        needs_file_sync = true
    RETURNING * INTO v_profile;

    RETURN v_profile;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE infinity_speaker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE infinity_family_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE infinity_family_memberships ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY speaker_profiles_user_policy ON infinity_speaker_profiles
    FOR ALL USING (user_id = current_setting('app.user_id', true)::TEXT OR current_setting('app.user_id', true) IS NULL);

CREATE POLICY family_groups_user_policy ON infinity_family_groups
    FOR ALL USING (user_id = current_setting('app.user_id', true)::TEXT OR current_setting('app.user_id', true) IS NULL);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE infinity_speaker_profiles IS 'Voice/speaker recognition profiles with style fingerprinting';
COMMENT ON TABLE infinity_family_groups IS 'Family/household units for shared communication preferences';
COMMENT ON TABLE infinity_family_memberships IS 'Links speakers to family groups';
COMMENT ON TABLE infinity_greeting_templates IS 'Customizable greetings per age/relationship';

COMMENT ON COLUMN infinity_speaker_profiles.style_fingerprint IS 'JSONB fingerprint for voice/writing style matching';
COMMENT ON COLUMN infinity_speaker_profiles.needs_file_sync IS 'Flag to indicate database changes need to sync to file storage';
COMMENT ON FUNCTION get_greeting IS 'Returns random age-appropriate greeting with name substitution';
