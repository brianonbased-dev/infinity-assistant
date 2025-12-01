'use client';

/**
 * Build Progress Window
 *
 * Full-featured build progress visualization with:
 * - Real-time phase progress tracking
 * - Visual evidence gallery (screenshots, diffs, previews)
 * - Checkpoint timeline with revert capability
 * - Mock data test runner
 * - Conversation flow (Assistant → CEO → Futurist)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  buildProgressService,
  type BuildProgressEvent,
} from '@/services/BuildProgressService';
import type {
  BuildProgress,
  BuildPhase,
  BuildCheckpoint,
  VisualEvidence,
  MockTestResult,
  BuildConversation,
  ConversationMessage,
  ConversationRole,
  TimelineEvent,
  PhaseStep,
} from '@/types/build-progress';

// ============================================================================
// STYLES (Iron Man Theme)
// ============================================================================

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100vh',
    backgroundColor: '#0a0a0f',
    color: '#e0e0e0',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    borderBottom: '1px solid rgba(0, 180, 216, 0.2)',
    background: 'linear-gradient(180deg, rgba(0, 180, 216, 0.1) 0%, transparent 100%)',
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#00b4d8',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  statusBadge: (status: string) => ({
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500,
    backgroundColor: status === 'completed' ? 'rgba(0, 255, 136, 0.2)' :
                    status === 'failed' ? 'rgba(255, 59, 48, 0.2)' :
                    status === 'in_progress' ? 'rgba(0, 180, 216, 0.2)' :
                    'rgba(255, 255, 255, 0.1)',
    color: status === 'completed' ? '#00ff88' :
           status === 'failed' ? '#ff3b30' :
           status === 'in_progress' ? '#00b4d8' :
           '#888',
    border: `1px solid ${status === 'completed' ? 'rgba(0, 255, 136, 0.3)' :
                         status === 'failed' ? 'rgba(255, 59, 48, 0.3)' :
                         status === 'in_progress' ? 'rgba(0, 180, 216, 0.3)' :
                         'rgba(255, 255, 255, 0.1)'}`,
  }),
  main: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: '280px',
    borderRight: '1px solid rgba(0, 180, 216, 0.2)',
    display: 'flex',
    flexDirection: 'column' as const,
    background: 'rgba(0, 0, 0, 0.3)',
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid rgba(0, 180, 216, 0.2)',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  tab: (active: boolean) => ({
    padding: '12px 20px',
    cursor: 'pointer',
    borderBottom: active ? '2px solid #00b4d8' : '2px solid transparent',
    color: active ? '#00b4d8' : '#888',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'all 0.2s',
  }),
  tabContent: {
    flex: 1,
    overflow: 'auto',
    padding: '20px',
  },
  phaseList: {
    padding: '12px',
  },
  phaseItem: (active: boolean, status: string) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    marginBottom: '4px',
    borderRadius: '8px',
    backgroundColor: active ? 'rgba(0, 180, 216, 0.15)' : 'transparent',
    border: `1px solid ${active ? 'rgba(0, 180, 216, 0.3)' : 'transparent'}`,
    cursor: 'pointer',
    transition: 'all 0.2s',
  }),
  phaseIcon: (status: string) => ({
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    backgroundColor: status === 'completed' ? 'rgba(0, 255, 136, 0.2)' :
                    status === 'in_progress' ? 'rgba(0, 180, 216, 0.2)' :
                    status === 'failed' ? 'rgba(255, 59, 48, 0.2)' :
                    'rgba(255, 255, 255, 0.05)',
    color: status === 'completed' ? '#00ff88' :
           status === 'in_progress' ? '#00b4d8' :
           status === 'failed' ? '#ff3b30' :
           '#666',
  }),
  progressBar: {
    height: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '2px',
    overflow: 'hidden',
    marginTop: '8px',
  },
  progressFill: (progress: number) => ({
    height: '100%',
    width: `${progress}%`,
    backgroundColor: '#00b4d8',
    transition: 'width 0.3s ease',
  }),
  card: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(0, 180, 216, 0.2)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px',
  },
  button: (variant: 'primary' | 'secondary' | 'danger' = 'primary') => ({
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'all 0.2s',
    backgroundColor: variant === 'primary' ? 'rgba(0, 180, 216, 0.2)' :
                    variant === 'danger' ? 'rgba(255, 59, 48, 0.2)' :
                    'rgba(255, 255, 255, 0.1)',
    color: variant === 'primary' ? '#00b4d8' :
           variant === 'danger' ? '#ff3b30' :
           '#888',
    border: `1px solid ${variant === 'primary' ? 'rgba(0, 180, 216, 0.3)' :
                         variant === 'danger' ? 'rgba(255, 59, 48, 0.3)' :
                         'rgba(255, 255, 255, 0.1)'}`,
  }),
};

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface BuildProgressWindowProps {
  buildId: string;
  onClose?: () => void;
}

type TabType = 'evidence' | 'checkpoints' | 'tests' | 'conversation' | 'timeline';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function BuildProgressWindow({ buildId, onClose }: BuildProgressWindowProps) {
  const [build, setBuild] = useState<BuildProgress | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('evidence');
  const [selectedPhase, setSelectedPhase] = useState<BuildPhase | null>(null);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<BuildCheckpoint | null>(null);
  const [activeConversation, setActiveConversation] = useState<BuildConversation | null>(null);

  // Subscribe to build updates
  useEffect(() => {
    const currentBuild = buildProgressService.getBuild(buildId);
    if (currentBuild) {
      setBuild(currentBuild);
      setSelectedPhase(currentBuild.currentPhase);
    }

    const unsubscribe = buildProgressService.subscribe(buildId, (event) => {
      const updatedBuild = buildProgressService.getBuild(buildId);
      if (updatedBuild) {
        setBuild({ ...updatedBuild });
      }
    });

    return () => unsubscribe();
  }, [buildId]);

  if (!build) {
    return (
      <div style={styles.container}>
        <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
          Loading build progress...
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.title}>
          <span style={{ fontSize: '24px' }}>&#9881;</span>
          Build Progress
          <span style={styles.statusBadge(build.status)}>
            {build.status.replace('_', ' ').toUpperCase()}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: '#666' }}>
            {Math.round(calculateOverallProgress(build))}% Complete
          </span>
          {onClose && (
            <button style={styles.button('secondary')} onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </header>

      <div style={styles.main}>
        {/* Sidebar - Phase List */}
        <aside style={styles.sidebar}>
          <div style={{ padding: '12px', borderBottom: '1px solid rgba(0, 180, 216, 0.1)' }}>
            <h3 style={{ fontSize: '12px', color: '#666', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Build Phases
            </h3>
          </div>
          <div style={styles.phaseList}>
            {build.phases.map((phase) => (
              <div
                key={phase.phase}
                style={styles.phaseItem(selectedPhase === phase.phase, phase.status)}
                onClick={() => setSelectedPhase(phase.phase)}
              >
                <div style={styles.phaseIcon(phase.status)}>
                  {phase.status === 'completed' ? '✓' :
                   phase.status === 'in_progress' ? '▶' :
                   phase.status === 'failed' ? '✕' : '○'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 500 }}>
                    {formatPhaseName(phase.phase)}
                  </div>
                  {phase.status === 'in_progress' && (
                    <div style={styles.progressBar}>
                      <div style={styles.progressFill(phase.progress)} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Metrics Summary */}
          <div style={{ padding: '12px', borderTop: '1px solid rgba(0, 180, 216, 0.1)', marginTop: 'auto' }}>
            <h3 style={{ fontSize: '12px', color: '#666', margin: '0 0 12px', textTransform: 'uppercase' }}>
              Metrics
            </h3>
            <MetricRow label="Checkpoints" value={build.metrics.checkpointCount} />
            <MetricRow label="Evidence" value={build.metrics.evidenceCount} />
            <MetricRow label="Tests Passed" value={`${build.metrics.testsPassed}/${build.metrics.testsPassed + build.metrics.testsFailed}`} />
            <MetricRow label="Conversations" value={build.metrics.conversationCount} />
          </div>
        </aside>

        {/* Main Content */}
        <main style={styles.content}>
          {/* Tabs */}
          <div style={styles.tabs}>
            {(['evidence', 'checkpoints', 'tests', 'conversation', 'timeline'] as TabType[]).map((tab) => (
              <div
                key={tab}
                style={styles.tab(activeTab === tab)}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </div>
            ))}
          </div>

          {/* Tab Content */}
          <div style={styles.tabContent}>
            {activeTab === 'evidence' && (
              <EvidencePanel build={build} selectedPhase={selectedPhase} />
            )}
            {activeTab === 'checkpoints' && (
              <CheckpointsPanel
                build={build}
                onSelectCheckpoint={setSelectedCheckpoint}
                selectedCheckpoint={selectedCheckpoint}
              />
            )}
            {activeTab === 'tests' && (
              <TestsPanel build={build} />
            )}
            {activeTab === 'conversation' && (
              <ConversationPanel
                build={build}
                activeConversation={activeConversation}
                onSelectConversation={setActiveConversation}
              />
            )}
            {activeTab === 'timeline' && (
              <TimelinePanel build={build} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function MetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
      <span style={{ color: '#666' }}>{label}</span>
      <span style={{ color: '#00b4d8' }}>{value}</span>
    </div>
  );
}

function EvidencePanel({ build, selectedPhase }: { build: BuildProgress; selectedPhase: BuildPhase | null }) {
  const filteredEvidence = selectedPhase
    ? build.evidence.filter((e) => e.phase === selectedPhase)
    : build.evidence;

  if (filteredEvidence.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
        No evidence captured yet.
        {selectedPhase && <div style={{ marginTop: '8px', fontSize: '13px' }}>Try selecting "All Phases"</div>}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
      {filteredEvidence.map((evidence) => (
        <EvidenceCard key={evidence.id} evidence={evidence} />
      ))}
    </div>
  );
}

function EvidenceCard({ evidence }: { evidence: VisualEvidence }) {
  return (
    <div style={styles.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '14px', color: '#fff' }}>{evidence.title}</h4>
          <span style={{ fontSize: '12px', color: '#666' }}>{formatPhaseName(evidence.phase)}</span>
        </div>
        <span style={{
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          backgroundColor: 'rgba(0, 180, 216, 0.1)',
          color: '#00b4d8',
        }}>
          {evidence.type}
        </span>
      </div>

      {/* Evidence Preview */}
      <div style={{
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '8px',
        padding: '12px',
        minHeight: '120px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {evidence.type === 'screenshot' && (
          <div style={{ color: '#666', fontSize: '13px' }}>
            Screenshot: {(evidence.data as any).width}x{(evidence.data as any).height}
          </div>
        )}
        {evidence.type === 'diff' && (
          <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>
            <span style={{ color: '#00ff88' }}>+{(evidence.data as any).additions}</span>
            {' / '}
            <span style={{ color: '#ff3b30' }}>-{(evidence.data as any).deletions}</span>
          </div>
        )}
        {evidence.type === 'terminal' && (
          <pre style={{ margin: 0, fontSize: '11px', color: '#00ff88', maxHeight: '100px', overflow: 'auto' }}>
            $ {(evidence.data as any).command}
          </pre>
        )}
        {evidence.type === 'test_result' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: '24px',
              color: (evidence.data as any).passed ? '#00ff88' : '#ff3b30',
            }}>
              {(evidence.data as any).passed ? '✓' : '✕'}
            </div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              {(evidence.data as any).duration}ms
            </div>
          </div>
        )}
      </div>

      {evidence.description && (
        <p style={{ margin: '12px 0 0', fontSize: '13px', color: '#888' }}>
          {evidence.description}
        </p>
      )}

      {evidence.annotations && evidence.annotations.length > 0 && (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <span style={{ fontSize: '11px', color: '#666' }}>
            {evidence.annotations.length} annotation(s)
          </span>
        </div>
      )}
    </div>
  );
}

function CheckpointsPanel({
  build,
  onSelectCheckpoint,
  selectedCheckpoint,
}: {
  build: BuildProgress;
  onSelectCheckpoint: (cp: BuildCheckpoint | null) => void;
  selectedCheckpoint: BuildCheckpoint | null;
}) {
  const handleRevert = async (checkpoint: BuildCheckpoint) => {
    if (!confirm(`Revert to "${checkpoint.name}"? Changes after this point will be stashed.`)) {
      return;
    }

    await buildProgressService.revertToCheckpoint({
      buildId: build.id,
      checkpointId: checkpoint.id,
      reason: 'User requested revert',
      preserveAfter: true,
      requestedBy: 'user',
    });
  };

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '16px', color: '#fff' }}>Checkpoints</h3>
        <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
          Click a checkpoint to preview, or revert to roll back changes.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {build.checkpoints.map((checkpoint, index) => (
          <div
            key={checkpoint.id}
            style={{
              ...styles.card,
              cursor: 'pointer',
              border: selectedCheckpoint?.id === checkpoint.id
                ? '1px solid rgba(0, 180, 216, 0.5)'
                : '1px solid rgba(0, 180, 216, 0.2)',
            }}
            onClick={() => onSelectCheckpoint(selectedCheckpoint?.id === checkpoint.id ? null : checkpoint)}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'rgba(0, 180, 216, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#00b4d8',
                fontSize: '14px',
                fontWeight: 600,
              }}>
                {build.checkpoints.length - index}
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 4px', fontSize: '14px', color: '#fff' }}>
                  {checkpoint.name}
                </h4>
                <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#666' }}>
                  {checkpoint.description}
                </p>
                <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#666' }}>
                  <span>Phase: {formatPhaseName(checkpoint.phase)}</span>
                  <span>Created: {formatTime(checkpoint.createdAt)}</span>
                  <span>By: {checkpoint.createdBy}</span>
                </div>
              </div>
              {checkpoint.canRevert && (
                <button
                  style={styles.button('danger')}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRevert(checkpoint);
                  }}
                >
                  Revert
                </button>
              )}
            </div>

            {selectedCheckpoint?.id === checkpoint.id && (
              <div style={{
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid rgba(255,255,255,0.1)',
              }}>
                <h5 style={{ margin: '0 0 8px', fontSize: '12px', color: '#888' }}>Snapshot Details</h5>
                <div style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>
                  <div>Commit: {checkpoint.snapshot.commitHash}</div>
                  <div>Files: {checkpoint.snapshot.fileState.length}</div>
                  <div>DB Version: {checkpoint.snapshot.dbMigrationVersion || 'N/A'}</div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TestsPanel({ build }: { build: BuildProgress }) {
  const [running, setRunning] = useState(false);

  const runTests = async () => {
    setRunning(true);
    try {
      await buildProgressService.runMockTests(build.id, {
        id: 'default',
        name: 'Default Test Suite',
        scenarios: [
          {
            id: 'happy-path',
            name: 'Happy Path',
            type: 'happy_path',
            data: { users: [{ id: '1', email: 'test@example.com', name: 'Test User', role: 'user' }] },
            expectedOutcome: { success: true, assertions: ['User can login', 'Dashboard loads', 'Data displays'] },
          },
          {
            id: 'edge-case',
            name: 'Edge Cases',
            type: 'edge_case',
            data: {},
            expectedOutcome: { success: true, assertions: ['Empty state handled', 'Error messages show'] },
          },
        ],
        createdAt: new Date(),
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h3 style={{ margin: '0 0 8px', fontSize: '16px', color: '#fff' }}>Mock Data Tests</h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
            Test your build with mock data before going live.
          </p>
        </div>
        <button style={styles.button('primary')} onClick={runTests} disabled={running}>
          {running ? 'Running...' : 'Run Tests'}
        </button>
      </div>

      {build.mockTests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          No tests run yet. Click "Run Tests" to start.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {build.mockTests.map((test) => (
            <div key={test.id} style={styles.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: test.status === 'passed' ? 'rgba(0, 255, 136, 0.2)' :
                                  test.status === 'failed' ? 'rgba(255, 59, 48, 0.2)' :
                                  'rgba(255, 255, 255, 0.1)',
                  color: test.status === 'passed' ? '#00ff88' :
                         test.status === 'failed' ? '#ff3b30' : '#666',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                }}>
                  {test.status === 'passed' ? '✓' : test.status === 'failed' ? '✕' : '•'}
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, fontSize: '14px', color: '#fff' }}>{test.scenarioName}</h4>
                  <span style={{ fontSize: '12px', color: '#666' }}>
                    {test.duration ? `${test.duration}ms` : 'Running...'}
                  </span>
                </div>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  backgroundColor: test.status === 'passed' ? 'rgba(0, 255, 136, 0.1)' :
                                  test.status === 'failed' ? 'rgba(255, 59, 48, 0.1)' :
                                  'rgba(255, 255, 255, 0.1)',
                  color: test.status === 'passed' ? '#00ff88' :
                         test.status === 'failed' ? '#ff3b30' : '#666',
                }}>
                  {test.status}
                </span>
              </div>

              {test.assertions.length > 0 && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  {test.assertions.map((assertion, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '12px' }}>
                      <span style={{ color: assertion.passed ? '#00ff88' : '#ff3b30' }}>
                        {assertion.passed ? '✓' : '✕'}
                      </span>
                      <span style={{ color: '#888' }}>{assertion.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConversationPanel({
  build,
  activeConversation,
  onSelectConversation,
}: {
  build: BuildProgress;
  activeConversation: BuildConversation | null;
  onSelectConversation: (conv: BuildConversation | null) => void;
}) {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages]);

  const handleSendMessage = async () => {
    if (!activeConversation || !newMessage.trim()) return;

    await buildProgressService.addMessage(activeConversation.id, 'user', newMessage);
    setNewMessage('');

    // Auto-generate assistant response
    setTimeout(async () => {
      await buildProgressService.generatePersonaResponse(activeConversation, 'assistant');
    }, 500);
  };

  const startNewConversation = async () => {
    const conversation = await buildProgressService.startConversation(
      build.id,
      'implementation_question',
      'I have a question about the current implementation...'
    );
    onSelectConversation(conversation);
  };

  const handleEscalate = async () => {
    if (!activeConversation) return;
    await buildProgressService.escalateConversation(activeConversation.id, 'Need higher-level input');
  };

  if (!activeConversation) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', color: '#fff' }}>Conversations</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
              Discuss changes with Assistant → CEO → Futurist
            </p>
          </div>
          <button style={styles.button('primary')} onClick={startNewConversation}>
            New Conversation
          </button>
        </div>

        {build.conversations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            No conversations yet. Start one to discuss your build.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {build.conversations.map((conv) => (
              <div
                key={conv.id}
                style={{ ...styles.card, cursor: 'pointer' }}
                onClick={() => onSelectConversation(conv)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px', fontSize: '14px', color: '#fff' }}>
                      {formatTopicName(conv.topic)}
                    </h4>
                    <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                      {conv.messages.length} messages • {formatPhaseName(conv.phase)}
                    </p>
                  </div>
                  <span style={styles.statusBadge(conv.status)}>
                    {conv.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Conversation Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <button style={styles.button('secondary')} onClick={() => onSelectConversation(null)}>
          ← Back
        </button>
        <h3 style={{ margin: 0, fontSize: '16px', color: '#fff', flex: 1 }}>
          {formatTopicName(activeConversation.topic)}
        </h3>
        <button style={styles.button('secondary')} onClick={handleEscalate}>
          Escalate
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', marginBottom: '16px' }}>
        {activeConversation.messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Type your message..."
          style={{
            flex: 1,
            padding: '12px',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(0, 180, 216, 0.2)',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '14px',
          }}
        />
        <button style={styles.button('primary')} onClick={handleSendMessage}>
          Send
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  const roleColors: Record<ConversationRole, string> = {
    user: '#00b4d8',
    assistant: '#00ff88',
    ceo: '#ffd700',
    futurist: '#ff6b6b',
  };

  const roleNames: Record<ConversationRole, string> = {
    user: 'You',
    assistant: 'Assistant',
    ceo: 'CEO',
    futurist: 'Futurist',
  };

  const isUser = message.role === 'user';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      marginBottom: '16px',
    }}>
      <div style={{
        fontSize: '11px',
        color: roleColors[message.role],
        marginBottom: '4px',
        fontWeight: 600,
      }}>
        {roleNames[message.role]}
      </div>
      <div style={{
        maxWidth: '80%',
        padding: '12px 16px',
        backgroundColor: isUser ? 'rgba(0, 180, 216, 0.2)' : 'rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        borderBottomRightRadius: isUser ? '4px' : '12px',
        borderBottomLeftRadius: isUser ? '12px' : '4px',
      }}>
        <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5 }}>{message.content}</p>
      </div>

      {message.suggestions && message.suggestions.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          {message.suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              style={{
                ...styles.button(suggestion.action === 'reject' || suggestion.action === 'revert' ? 'danger' : 'secondary'),
                fontSize: '11px',
                padding: '6px 12px',
              }}
            >
              {suggestion.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TimelinePanel({ build }: { build: BuildProgress }) {
  return (
    <div>
      <h3 style={{ margin: '0 0 20px', fontSize: '16px', color: '#fff' }}>Build Timeline</h3>

      <div style={{ position: 'relative', paddingLeft: '24px' }}>
        {/* Timeline line */}
        <div style={{
          position: 'absolute',
          left: '8px',
          top: '8px',
          bottom: '8px',
          width: '2px',
          backgroundColor: 'rgba(0, 180, 216, 0.2)',
        }} />

        {build.timeline.map((event, index) => (
          <div key={event.id} style={{ position: 'relative', marginBottom: '20px' }}>
            {/* Timeline dot */}
            <div style={{
              position: 'absolute',
              left: '-20px',
              top: '4px',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: getEventColor(event.type),
              border: '2px solid #0a0a0f',
            }} />

            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '14px', color: '#fff' }}>
                    {event.title}
                  </h4>
                  {event.description && (
                    <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#888' }}>
                      {event.description}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#666' }}>
                    {event.phase && <span>Phase: {formatPhaseName(event.phase)}</span>}
                    {event.actor && <span>By: {event.actor}</span>}
                  </div>
                </div>
                <span style={{ fontSize: '11px', color: '#666' }}>
                  {formatTime(event.timestamp)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function calculateOverallProgress(build: BuildProgress): number {
  const totalPhases = build.phases.length;
  const completedPhases = build.phases.filter((p) => p.status === 'completed').length;
  const inProgressPhase = build.phases.find((p) => p.status === 'in_progress');
  const inProgressContribution = inProgressPhase ? inProgressPhase.progress / 100 : 0;

  return ((completedPhases + inProgressContribution) / totalPhases) * 100;
}

function formatPhaseName(phase: BuildPhase): string {
  return phase
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatTopicName(topic: string): string {
  return topic
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getEventColor(type: string): string {
  const colors: Record<string, string> = {
    phase_started: '#00b4d8',
    phase_completed: '#00ff88',
    checkpoint_created: '#ffd700',
    evidence_captured: '#9b59b6',
    test_run: '#3498db',
    conversation_started: '#e74c3c',
    decision_made: '#00ff88',
    revert_performed: '#ff6b6b',
    error_occurred: '#ff3b30',
    deployment: '#2ecc71',
    approval: '#00ff88',
  };
  return colors[type] || '#666';
}
