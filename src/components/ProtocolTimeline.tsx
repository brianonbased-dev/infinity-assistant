import React from 'react';

const phases = [
  'INTAKE', 'REFLECT', 'EXECUTE', 'COMPRESS', 'GROW', 'RE-INTAKE', 'EVOLVE', 'AUTONOMIZE'
];

export default function ProtocolTimeline({ currentPhase = 2 }: { currentPhase?: number }) {
  const [phaseIdx, setPhaseIdx] = React.useState(currentPhase);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handlePhaseClick = async (idx: number) => {
    setLoading(true);
    setError('');
    try {
      // Advance protocol cycle phase (stub cycleId)
      const res = await fetch(`/api/protocol/cycles/cycle-1/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: idx }),
      });
      if (!res.ok) throw new Error('Failed to set phase');
      setPhaseIdx(idx);
    } catch (e: any) {
      setError(e.message || 'Failed to set phase');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div aria-label="Protocol Timeline" role="region" tabIndex={0}>
      <h2>Protocol Cycle Timeline</h2>
      {error && <div role="alert" style={{ color: 'red' }}>{error}</div>}
      {loading && <div aria-busy="true">Updating phase...</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        {phases.map((phase, idx) => (
          <button
            key={phase}
            style={{
              padding: 8,
              borderRadius: 4,
              background: idx === phaseIdx ? '#4f8cff' : '#eee',
              color: idx === phaseIdx ? '#fff' : '#333',
              transition: 'background 0.3s',
              cursor: 'pointer',
              border: 'none',
            }}
            title={`Phase ${idx + 1}: ${phase}`}
            aria-pressed={idx === phaseIdx}
            aria-label={`Set phase to ${phase}`}
            onClick={() => handlePhaseClick(idx)}
          >
            {phase}
          </button>
        ))}
      </div>
    </div>
  );
}
