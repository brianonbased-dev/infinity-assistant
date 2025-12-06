import React, { useState } from 'react';

const mockContextHistory = [
  { id: 1, context: 'Initial setup', timestamp: '2025-12-05T10:00:00Z' },
  { id: 2, context: 'Agent selected: Builder', timestamp: '2025-12-05T10:05:00Z' },
  { id: 3, context: 'Protocol phase: EXECUTE', timestamp: '2025-12-05T10:10:00Z' },
];

export default function ContextViewer() {
  const [contextHistory, setContextHistory] = useState(mockContextHistory);
  const [current, setCurrent] = useState(mockContextHistory.length - 1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/uaa2?resource=cycles&agent_id=uaa2-autonomous&limit=10')
      .then((res) => res.json())
      .then((data) => {
        if (data.cycles) {
          setContextHistory(data.cycles.map((c: any, idx: number) => ({
            id: c.id || idx,
            context: c.agentName || c.agent_id || 'Unknown',
            timestamp: c.startedAt || c.meta?.timestamp || '',
          })));
        } else {
          setContextHistory(mockContextHistory);
        }
      })
      .catch((e) => setError(e.message || 'Failed to load context history'))
      .finally(() => setLoading(false));
  }, []);

  const handleRollback = async () => {
    if (current === 0) return;
    setLoading(true);
    setError('');
    try {
      // Pause protocol cycle (stub cycleId)
      const res = await fetch(`/api/protocol/cycles/${contextHistory[current - 1].id}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to rollback context');
      setCurrent(current - 1);
    } catch (e: any) {
      setError(e.message || 'Failed to rollback context');
    } finally {
      setLoading(false);
    }
  };
  const handleForward = async () => {
    if (current === contextHistory.length - 1) return;
    setLoading(true);
    setError('');
    try {
      // Resume protocol cycle (stub cycleId)
      const res = await fetch(`/api/protocol/cycles/${contextHistory[current + 1].id}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to forward context');
      setCurrent(current + 1);
    } catch (e: any) {
      setError(e.message || 'Failed to forward context');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div aria-label="Context Viewer" role="region" tabIndex={0}>
      <h2>Context Viewer</h2>
      {error && <div role="alert" style={{ color: 'red' }}>{error}</div>}
      {loading && <div aria-busy="true">Loading...</div>}
      <div>
        <strong>Current Context:</strong> {contextHistory[current].context}
        <div>Timestamp: {contextHistory[current].timestamp}</div>
      </div>
      <h3>Context History</h3>
      <ul>
        {contextHistory.map((entry, idx) => (
          <li key={entry.id}>
            <button onClick={() => setCurrent(idx)} aria-label={`View context ${entry.context}`}
              aria-current={idx === current}>
              {entry.context} ({entry.timestamp})
            </button>
          </li>
        ))}
      </ul>
      <button disabled={current === 0} onClick={handleRollback} aria-label="Rollback Context">Rollback</button>
      <button disabled={current === contextHistory.length - 1} onClick={handleForward} aria-label="Forward Context">Forward</button>
    </div>
  );
}
