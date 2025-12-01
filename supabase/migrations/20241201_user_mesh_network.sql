-- ============================================================================
-- User Mesh Network Tables
--
-- Enables every InfinityAssistant user to join the mesh network.
-- Each user gets their own mesh node registration and API key.
-- ============================================================================

-- User mesh nodes table
CREATE TABLE IF NOT EXISTS user_mesh_nodes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  node_id VARCHAR(100) NOT NULL UNIQUE,
  node_name VARCHAR(255) NOT NULL,
  api_key_hash VARCHAR(64) NOT NULL, -- SHA256 hash of API key
  api_key_preview VARCHAR(20) NOT NULL, -- Preview like "ia_mesh_...abcd"
  capabilities TEXT[] DEFAULT ARRAY['chat', 'knowledge-access', 'workspace-sync', 'user-preferences'],
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  tier VARCHAR(20) DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
  settings JSONB DEFAULT '{
    "allowRemoteAccess": false,
    "shareKnowledge": false,
    "syncWorkspace": true,
    "notifyOnMeshEvents": true,
    "preferredLLM": "auto",
    "meshVisibility": "private"
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_node UNIQUE (user_id)
);

-- Mesh connections between users
CREATE TABLE IF NOT EXISTS mesh_connections (
  id VARCHAR(50) PRIMARY KEY,
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  connected_at TIMESTAMPTZ,
  CONSTRAINT no_self_connection CHECK (from_user_id != to_user_id),
  CONSTRAINT unique_connection UNIQUE (from_user_id, to_user_id)
);

-- Mesh messages/events log
CREATE TABLE IF NOT EXISTS mesh_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_node_id VARCHAR(100),
  to_node_id VARCHAR(100),
  event_type VARCHAR(50) NOT NULL, -- 'message', 'knowledge_share', 'sync', 'heartbeat'
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_mesh_nodes_user_id ON user_mesh_nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_mesh_nodes_node_id ON user_mesh_nodes(node_id);
CREATE INDEX IF NOT EXISTS idx_user_mesh_nodes_api_key_hash ON user_mesh_nodes(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_user_mesh_nodes_status ON user_mesh_nodes(status);
CREATE INDEX IF NOT EXISTS idx_user_mesh_nodes_last_active ON user_mesh_nodes(last_active_at);

CREATE INDEX IF NOT EXISTS idx_mesh_connections_from_user ON mesh_connections(from_user_id);
CREATE INDEX IF NOT EXISTS idx_mesh_connections_to_user ON mesh_connections(to_user_id);
CREATE INDEX IF NOT EXISTS idx_mesh_connections_status ON mesh_connections(status);

CREATE INDEX IF NOT EXISTS idx_mesh_events_from_node ON mesh_events(from_node_id);
CREATE INDEX IF NOT EXISTS idx_mesh_events_to_node ON mesh_events(to_node_id);
CREATE INDEX IF NOT EXISTS idx_mesh_events_type ON mesh_events(event_type);
CREATE INDEX IF NOT EXISTS idx_mesh_events_created ON mesh_events(created_at);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE user_mesh_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesh_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesh_events ENABLE ROW LEVEL SECURITY;

-- User mesh nodes policies
CREATE POLICY "Users can view their own mesh node"
  ON user_mesh_nodes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own mesh node"
  ON user_mesh_nodes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mesh node"
  ON user_mesh_nodes FOR UPDATE
  USING (auth.uid() = user_id);

-- Allow viewing public mesh nodes (for discovery)
CREATE POLICY "Users can view public mesh nodes"
  ON user_mesh_nodes FOR SELECT
  USING (settings->>'meshVisibility' IN ('friends', 'public'));

-- Mesh connections policies
CREATE POLICY "Users can view their connections"
  ON mesh_connections FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can create connection requests"
  ON mesh_connections FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can update connections to them"
  ON mesh_connections FOR UPDATE
  USING (auth.uid() = to_user_id);

-- Mesh events policies (users can see events they're involved in)
CREATE POLICY "Users can view their mesh events"
  ON mesh_events FOR SELECT
  USING (
    from_node_id IN (SELECT node_id FROM user_mesh_nodes WHERE user_id = auth.uid())
    OR to_node_id IN (SELECT node_id FROM user_mesh_nodes WHERE user_id = auth.uid())
  );

-- ============================================================================
-- Functions
-- ============================================================================

-- Function to update last_active_at on node activity
CREATE OR REPLACE FUNCTION update_mesh_node_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_mesh_nodes
  SET last_active_at = NOW()
  WHERE node_id = NEW.from_node_id OR node_id = NEW.to_node_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update activity on mesh events
CREATE TRIGGER trigger_mesh_activity
  AFTER INSERT ON mesh_events
  FOR EACH ROW
  EXECUTE FUNCTION update_mesh_node_activity();

-- ============================================================================
-- Service role bypass for API operations
-- ============================================================================

-- Allow service role full access for API operations
CREATE POLICY "Service role has full access to mesh nodes"
  ON user_mesh_nodes FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to mesh connections"
  ON mesh_connections FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to mesh events"
  ON mesh_events FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
