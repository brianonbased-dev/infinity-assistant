import React, { useState } from 'react';

export default function AgentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [agentName, setAgentName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  if (!open) return null;
  const handleSave = async () => {
    setError('');
    if (!agentName) {
      setError('Agent name required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: 'default', agentName, agentType: 'generic' }),
      });
      if (!res.ok) throw new Error('Failed to save agent');
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save agent');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div role="dialog" aria-modal="true" aria-label="Agent Management Modal" tabIndex={-1}>
      <h2>Add/Edit Agent</h2>
      <input
        type="text"
        placeholder="Agent Name"
        value={agentName}
        onChange={(e) => setAgentName(e.target.value)}
        aria-label="Agent Name"
        autoFocus
      />
      {error && <div role="alert" style={{ color: 'red' }}>{error}</div>}
      {loading && <div aria-busy="true">Saving...</div>}
      <button onClick={handleSave} aria-label="Save Agent">Save</button>
      <button onClick={onClose} aria-label="Cancel">Cancel</button>
    </div>
  );
}
