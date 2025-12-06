import React from 'react';

export default function Dashboard() {
  const [agentStatus, setAgentStatus] = React.useState('Loading...');
  const [protocolPhase, setProtocolPhase] = React.useState('Loading...');
  const [metrics, setMetrics] = React.useState({ tasks: 0, errors: 0, uptime: '0%' });
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    fetch('/api/uaa2?resource=status')
      .then((res) => res.json())
      .then((data) => {
        setAgentStatus(data.metrics?.activeAgents ? `Active (${data.metrics.activeAgents})` : 'Unknown');
        setProtocolPhase(data.latestCycle?.currentPhase ? `Phase ${data.latestCycle.currentPhase}/7` : 'Unknown');
        setMetrics({
          tasks: data.metrics?.totalCycles || 0,
          errors: data.metrics?.failedCycles || 0,
          uptime: data.healthScore ? `${data.healthScore}%` : 'N/A',
        });
      })
      .catch((e) => setError(e.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const handleStartAgent = async () => {
    setLoading(true);
    setError('');
    try {
      // Register a new agent (stub workspaceId)
      const res = await fetch('/api/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: 'default', agentName: 'NewAgent', agentType: 'generic' }),
      });
      if (!res.ok) throw new Error('Failed to start agent');
      setAgentStatus('Active');
    } catch (e: any) {
      setError(e.message || 'Failed to start agent');
    } finally {
      setLoading(false);
    }
  };
  const handleRunProtocol = async () => {
    setLoading(true);
    setError('');
    try {
      // Execute protocol cycle
      const res = await fetch('/api/uaa2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'execute-cycle', agent_id: 'uaa2-autonomous', task_description: 'Run protocol cycle' }),
      });
      if (!res.ok) throw new Error('Failed to run protocol');
      setProtocolPhase('Phase 1/7');
    } catch (e: any) {
      setError(e.message || 'Failed to run protocol');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div aria-label="Dashboard" role="main" tabIndex={0}>
      <h2>Infinity Assistant Dashboard</h2>
      {error && <div role="alert" style={{ color: 'red' }}>{error}</div>}
      {loading && <div aria-busy="true">Loading...</div>}
      <div>
        <div>Agent Status: <span>{agentStatus}</span></div>
        <div>Protocol Cycle: <span>{protocolPhase}</span></div>
        <div>Tasks: {metrics.tasks} | Errors: {metrics.errors} | Uptime: {metrics.uptime}</div>
        <button onClick={handleStartAgent} aria-label="Start Agent">Start Agent</button>
        <button onClick={handleRunProtocol} aria-label="Run Protocol">Run Protocol</button>
      </div>
    </div>
  );
}
