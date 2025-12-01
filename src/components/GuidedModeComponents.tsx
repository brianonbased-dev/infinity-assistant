'use client';

/**
 * Guided Mode Components
 *
 * Learning-focused UI components for the Guided Mode experience:
 * - CodeAnnotations: Inline explanations in generated code
 * - PreviewChanges: See diffs before applying changes
 * - CheckpointManager: Save/restore progress points
 * - ArchitectureDiagram: Visual system overview
 * - InteractiveTutorial: Step-by-step walkthroughs
 * - APIExplorer: Visual API testing interface
 *
 * These components bridge the gap between Companion Mode (full automation)
 * and Developer Mode (full control), providing a "learn as you build" experience.
 *
 * @since 2025-12-01
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Code,
  Eye,
  Undo2,
  Save,
  ChevronRight,
  ChevronDown,
  Lightbulb,
  Play,
  CheckCircle,
  Circle,
  AlertTriangle,
  Info,
  Copy,
  Check,
  X,
  RefreshCw,
  Layers,
  ArrowRight,
  MessageCircle,
  Zap,
  BookOpen,
  Terminal,
  GitBranch,
} from 'lucide-react';

// ============================================================================
// CODE ANNOTATIONS
// ============================================================================

interface CodeAnnotation {
  lineNumber: number;
  type: 'explanation' | 'tip' | 'warning' | 'best-practice';
  title: string;
  content: string;
  learnMoreUrl?: string;
}

interface CodeAnnotationsProps {
  code: string;
  language: string;
  annotations: CodeAnnotation[];
  fileName: string;
  onCopy?: () => void;
}

export function CodeAnnotations({
  code,
  language,
  annotations,
  fileName,
  onCopy,
}: CodeAnnotationsProps) {
  const [expandedAnnotations, setExpandedAnnotations] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);

  const lines = code.split('\n');
  const annotationsByLine = useMemo(() => {
    const map = new Map<number, CodeAnnotation[]>();
    annotations.forEach((a) => {
      if (!map.has(a.lineNumber)) {
        map.set(a.lineNumber, []);
      }
      map.get(a.lineNumber)!.push(a);
    });
    return map;
  }, [annotations]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.();
  }, [code, onCopy]);

  const toggleAnnotation = useCallback((lineNumber: number) => {
    setExpandedAnnotations((prev) => {
      const next = new Set(prev);
      if (next.has(lineNumber)) {
        next.delete(lineNumber);
      } else {
        next.add(lineNumber);
      }
      return next;
    });
  }, []);

  const getAnnotationIcon = (type: CodeAnnotation['type']) => {
    switch (type) {
      case 'explanation':
        return <Info className="w-3 h-3" />;
      case 'tip':
        return <Lightbulb className="w-3 h-3" />;
      case 'warning':
        return <AlertTriangle className="w-3 h-3" />;
      case 'best-practice':
        return <CheckCircle className="w-3 h-3" />;
    }
  };

  const getAnnotationColor = (type: CodeAnnotation['type']) => {
    switch (type) {
      case 'explanation':
        return 'bg-blue-500/20 border-blue-500/30 text-blue-300';
      case 'tip':
        return 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300';
      case 'warning':
        return 'bg-orange-500/20 border-orange-500/30 text-orange-300';
      case 'best-practice':
        return 'bg-green-500/20 border-green-500/30 text-green-300';
    }
  };

  return (
    <div className="rounded-xl overflow-hidden border border-gray-700 bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-300 font-mono">{fileName}</span>
          <span className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-400">{language}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-blue-400 flex items-center gap-1">
            <BookOpen className="w-3 h-3" />
            {annotations.length} explanations
          </span>
          <button
            onClick={handleCopy}
            className="p-1.5 hover:bg-gray-700 rounded transition-colors"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Code with annotations */}
      <div className="overflow-x-auto">
        <div className="min-w-full">
          {lines.map((line, index) => {
            const lineNum = index + 1;
            const lineAnnotations = annotationsByLine.get(lineNum);
            const hasAnnotation = lineAnnotations && lineAnnotations.length > 0;
            const isExpanded = expandedAnnotations.has(lineNum);

            return (
              <div key={index}>
                <div
                  className={`flex group ${hasAnnotation ? 'bg-blue-500/5 hover:bg-blue-500/10 cursor-pointer' : 'hover:bg-gray-800/50'}`}
                  onClick={hasAnnotation ? () => toggleAnnotation(lineNum) : undefined}
                >
                  {/* Line number */}
                  <div className="w-12 px-3 py-1 text-right text-xs text-gray-500 select-none border-r border-gray-800 shrink-0">
                    {lineNum}
                  </div>

                  {/* Annotation indicator */}
                  <div className="w-6 flex items-center justify-center shrink-0">
                    {hasAnnotation && (
                      <span className="text-blue-400 opacity-70 group-hover:opacity-100">
                        {isExpanded ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                      </span>
                    )}
                  </div>

                  {/* Code */}
                  <pre className="flex-1 px-2 py-1 text-sm font-mono text-gray-300 whitespace-pre">
                    {line || ' '}
                  </pre>

                  {/* Annotation badge */}
                  {hasAnnotation && !isExpanded && (
                    <div className="pr-3 py-1 flex items-center gap-1">
                      {lineAnnotations.map((a, i) => (
                        <span
                          key={i}
                          className={`px-1.5 py-0.5 rounded text-[10px] ${getAnnotationColor(a.type)}`}
                        >
                          {getAnnotationIcon(a.type)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Expanded annotation */}
                {hasAnnotation && isExpanded && (
                  <div className="border-l-4 border-blue-500/50 bg-blue-500/10 px-4 py-3 mx-12 my-1 rounded-r">
                    {lineAnnotations.map((annotation, i) => (
                      <div key={i} className={`${i > 0 ? 'mt-3 pt-3 border-t border-blue-500/20' : ''}`}>
                        <div className={`flex items-center gap-2 mb-2 ${getAnnotationColor(annotation.type).replace('bg-', 'text-').replace('/20', '')}`}>
                          {getAnnotationIcon(annotation.type)}
                          <span className="font-medium text-sm">{annotation.title}</span>
                        </div>
                        <p className="text-sm text-gray-300">{annotation.content}</p>
                        {annotation.learnMoreUrl && (
                          <a
                            href={annotation.learnMoreUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-2 text-xs text-blue-400 hover:text-blue-300"
                          >
                            Learn more
                            <ArrowRight className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PREVIEW CHANGES
// ============================================================================

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

interface PreviewChangesProps {
  fileName: string;
  oldContent: string;
  newContent: string;
  explanation?: string;
  onApply: () => void;
  onCancel: () => void;
  isApplying?: boolean;
}

export function PreviewChanges({
  fileName,
  oldContent,
  newContent,
  explanation,
  onApply,
  onCancel,
  isApplying = false,
}: PreviewChangesProps) {
  // Simple diff - in production use a proper diff library
  const diffLines = useMemo((): DiffLine[] => {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const result: DiffLine[] = [];

    let oldIdx = 0;
    let newIdx = 0;

    while (oldIdx < oldLines.length || newIdx < newLines.length) {
      const oldLine = oldLines[oldIdx];
      const newLine = newLines[newIdx];

      if (oldLine === newLine) {
        result.push({
          type: 'unchanged',
          content: oldLine || '',
          oldLineNumber: oldIdx + 1,
          newLineNumber: newIdx + 1,
        });
        oldIdx++;
        newIdx++;
      } else if (oldLine !== undefined && newLines.indexOf(oldLine, newIdx) === -1) {
        result.push({
          type: 'removed',
          content: oldLine,
          oldLineNumber: oldIdx + 1,
        });
        oldIdx++;
      } else {
        result.push({
          type: 'added',
          content: newLine || '',
          newLineNumber: newIdx + 1,
        });
        newIdx++;
      }
    }

    return result;
  }, [oldContent, newContent]);

  const stats = useMemo(() => {
    const added = diffLines.filter((l) => l.type === 'added').length;
    const removed = diffLines.filter((l) => l.type === 'removed').length;
    return { added, removed };
  }, [diffLines]);

  return (
    <div className="rounded-xl overflow-hidden border border-gray-700 bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="font-medium text-white">Preview Changes</h3>
              <p className="text-sm text-gray-400">{fileName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-green-400">+{stats.added}</span>
            <span className="text-red-400">-{stats.removed}</span>
          </div>
        </div>

        {explanation && (
          <div className="mt-3 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <p className="text-sm text-blue-200">{explanation}</p>
            </div>
          </div>
        )}
      </div>

      {/* Diff view */}
      <div className="max-h-96 overflow-auto">
        {diffLines.map((line, index) => (
          <div
            key={index}
            className={`flex text-sm font-mono ${
              line.type === 'added'
                ? 'bg-green-500/10 text-green-300'
                : line.type === 'removed'
                  ? 'bg-red-500/10 text-red-300'
                  : 'text-gray-400'
            }`}
          >
            <div className="w-12 px-2 py-0.5 text-right text-xs opacity-50 border-r border-gray-800 shrink-0">
              {line.oldLineNumber || ''}
            </div>
            <div className="w-12 px-2 py-0.5 text-right text-xs opacity-50 border-r border-gray-800 shrink-0">
              {line.newLineNumber || ''}
            </div>
            <div className="w-6 text-center py-0.5 shrink-0">
              {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
            </div>
            <pre className="flex-1 px-2 py-0.5 whitespace-pre">{line.content || ' '}</pre>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-gray-800 border-t border-gray-700 flex items-center justify-end gap-3">
        <button
          onClick={onCancel}
          disabled={isApplying}
          className="px-4 py-2 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onApply}
          disabled={isApplying}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {isApplying ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Applying...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Apply Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// CHECKPOINT MANAGER
// ============================================================================

interface Checkpoint {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  filesChanged: number;
  phase: string;
}

interface CheckpointManagerProps {
  checkpoints: Checkpoint[];
  currentCheckpoint?: string;
  onCreateCheckpoint: (name: string, description: string) => void;
  onRestoreCheckpoint: (id: string) => void;
  isCreating?: boolean;
  isRestoring?: boolean;
}

export function CheckpointManager({
  checkpoints,
  currentCheckpoint,
  onCreateCheckpoint,
  onRestoreCheckpoint,
  isCreating = false,
  isRestoring = false,
}: CheckpointManagerProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const handleCreate = useCallback(() => {
    if (newName.trim()) {
      onCreateCheckpoint(newName.trim(), newDescription.trim());
      setNewName('');
      setNewDescription('');
      setShowCreateForm(false);
    }
  }, [newName, newDescription, onCreateCheckpoint]);

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-purple-400" />
          <h3 className="font-medium text-white">Checkpoints</h3>
          <span className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-400">
            {checkpoints.length} saved
          </span>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors"
        >
          <Save className="w-4 h-4" />
          Save Checkpoint
        </button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="p-4 bg-purple-500/10 border-b border-gray-700">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Checkpoint name (e.g., 'Before adding auth')"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 mb-2"
          />
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Optional description..."
            rows={2}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 mb-3 resize-none"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-3 py-1.5 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || isCreating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
            >
              {isCreating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Create
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Checkpoint list */}
      <div className="max-h-64 overflow-y-auto">
        {checkpoints.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No checkpoints yet</p>
            <p className="text-sm mt-1">Create one to save your progress</p>
          </div>
        ) : (
          checkpoints.map((checkpoint) => (
            <div
              key={checkpoint.id}
              className={`p-4 border-b border-gray-800 last:border-b-0 ${
                currentCheckpoint === checkpoint.id ? 'bg-purple-500/10' : 'hover:bg-gray-800/50'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {currentCheckpoint === checkpoint.id ? (
                      <CheckCircle className="w-4 h-4 text-purple-400 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-gray-600 shrink-0" />
                    )}
                    <h4 className="font-medium text-white truncate">{checkpoint.name}</h4>
                  </div>
                  {checkpoint.description && (
                    <p className="text-sm text-gray-400 mt-1 ml-6">{checkpoint.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 ml-6 text-xs text-gray-500">
                    <span>{checkpoint.phase}</span>
                    <span>{checkpoint.filesChanged} files</span>
                    <span>{formatRelativeTime(checkpoint.createdAt)}</span>
                  </div>
                </div>
                {currentCheckpoint !== checkpoint.id && (
                  <button
                    onClick={() => onRestoreCheckpoint(checkpoint.id)}
                    disabled={isRestoring}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors shrink-0"
                  >
                    <Undo2 className="w-4 h-4" />
                    <span className="text-sm">Restore</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// INTERACTIVE TUTORIAL
// ============================================================================

interface TutorialStep {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'action' | 'code';
  codeExample?: string;
  actionLabel?: string;
  completed?: boolean;
}

interface InteractiveTutorialProps {
  title: string;
  description: string;
  steps: TutorialStep[];
  currentStep: number;
  onStepComplete: (stepId: string) => void;
  onClose: () => void;
}

export function InteractiveTutorial({
  title,
  description,
  steps,
  currentStep,
  onStepComplete,
  onClose,
}: InteractiveTutorialProps) {
  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-purple-500/10 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-blue-500/10 border-b border-blue-500/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-medium text-white">{title}</h3>
            <p className="text-sm text-gray-400">{description}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress */}
      <div className="px-4 py-2 bg-gray-800/30 border-b border-gray-700/50">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
          <span>Step {currentStep + 1} of {steps.length}</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      {step && (
        <div className="p-4">
          <div className="flex items-start gap-3 mb-4">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                step.type === 'info'
                  ? 'bg-blue-500/20 text-blue-400'
                  : step.type === 'action'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-purple-500/20 text-purple-400'
              }`}
            >
              {step.type === 'info' ? (
                <Info className="w-4 h-4" />
              ) : step.type === 'action' ? (
                <Zap className="w-4 h-4" />
              ) : (
                <Code className="w-4 h-4" />
              )}
            </div>
            <div>
              <h4 className="font-medium text-white mb-1">{step.title}</h4>
              <p className="text-sm text-gray-300">{step.content}</p>
            </div>
          </div>

          {step.codeExample && (
            <pre className="p-4 bg-gray-900 rounded-lg text-sm font-mono text-gray-300 overflow-x-auto mb-4">
              {step.codeExample}
            </pre>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-gray-700/50">
            {currentStep > 0 && (
              <span className="text-sm text-gray-500">
                {steps.filter((s) => s.completed).length} steps completed
              </span>
            )}
            <button
              onClick={() => onStepComplete(step.id)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              {step.actionLabel || (currentStep < steps.length - 1 ? 'Next' : 'Complete')}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// API EXPLORER
// ============================================================================

interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  parameters?: {
    name: string;
    type: string;
    required: boolean;
    description: string;
  }[];
  exampleResponse?: string;
}

interface APIExplorerProps {
  endpoints: APIEndpoint[];
  baseUrl: string;
  onTryEndpoint?: (endpoint: APIEndpoint, params: Record<string, string>) => void;
}

export function APIExplorer({ endpoints, baseUrl, onTryEndpoint }: APIExplorerProps) {
  const [selectedEndpoint, setSelectedEndpoint] = useState<APIEndpoint | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleTry = useCallback(async () => {
    if (!selectedEndpoint) return;
    setIsLoading(true);
    try {
      onTryEndpoint?.(selectedEndpoint, params);
      // Simulate response
      await new Promise((resolve) => setTimeout(resolve, 500));
      setResponse(selectedEndpoint.exampleResponse || '{ "success": true }');
    } finally {
      setIsLoading(false);
    }
  }, [selectedEndpoint, params, onTryEndpoint]);

  const methodColors = {
    GET: 'bg-green-500/20 text-green-400',
    POST: 'bg-blue-500/20 text-blue-400',
    PUT: 'bg-yellow-500/20 text-yellow-400',
    DELETE: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-800 border-b border-gray-700 flex items-center gap-2">
        <Terminal className="w-5 h-5 text-green-400" />
        <h3 className="font-medium text-white">API Explorer</h3>
        <span className="text-xs text-gray-500 ml-auto">{baseUrl}</span>
      </div>

      <div className="flex">
        {/* Endpoint list */}
        <div className="w-72 border-r border-gray-800 max-h-96 overflow-y-auto">
          {endpoints.map((endpoint, i) => (
            <button
              key={i}
              onClick={() => {
                setSelectedEndpoint(endpoint);
                setParams({});
                setResponse(null);
              }}
              className={`w-full px-4 py-3 text-left border-b border-gray-800 last:border-b-0 ${
                selectedEndpoint === endpoint
                  ? 'bg-gray-800'
                  : 'hover:bg-gray-800/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${methodColors[endpoint.method]}`}>
                  {endpoint.method}
                </span>
                <span className="text-sm text-gray-300 font-mono truncate">{endpoint.path}</span>
              </div>
              <p className="text-xs text-gray-500 truncate">{endpoint.description}</p>
            </button>
          ))}
        </div>

        {/* Endpoint details */}
        <div className="flex-1 p-4">
          {selectedEndpoint ? (
            <>
              <div className="flex items-center gap-2 mb-4">
                <span className={`px-2 py-1 rounded text-sm font-mono ${methodColors[selectedEndpoint.method]}`}>
                  {selectedEndpoint.method}
                </span>
                <span className="text-white font-mono">{selectedEndpoint.path}</span>
              </div>

              <p className="text-sm text-gray-400 mb-4">{selectedEndpoint.description}</p>

              {selectedEndpoint.parameters && selectedEndpoint.parameters.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-white mb-2">Parameters</h4>
                  <div className="space-y-2">
                    {selectedEndpoint.parameters.map((param) => (
                      <div key={param.name}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm text-gray-300">{param.name}</span>
                          <span className="text-xs text-gray-500">{param.type}</span>
                          {param.required && (
                            <span className="text-xs text-red-400">required</span>
                          )}
                        </div>
                        <input
                          type="text"
                          value={params[param.name] || ''}
                          onChange={(e) =>
                            setParams({ ...params, [param.name]: e.target.value })
                          }
                          placeholder={param.description}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleTry}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg transition-colors mb-4"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Try It
                  </>
                )}
              </button>

              {response && (
                <div>
                  <h4 className="text-sm font-medium text-white mb-2">Response</h4>
                  <pre className="p-4 bg-gray-800 rounded-lg text-sm font-mono text-green-300 overflow-x-auto">
                    {response}
                  </pre>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <div className="text-center">
                <Terminal className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Select an endpoint to explore</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  CodeAnnotations,
  PreviewChanges,
  CheckpointManager,
  InteractiveTutorial,
  APIExplorer,
};
