'use client';

/**
 * MessageRenderer Component
 *
 * Renders chat messages with proper formatting:
 * - Code blocks with horizontal scrolling and visible scrollbar
 * - Syntax highlighting for common languages
 * - Copy-to-clipboard functionality
 * - Inline code styling
 * - Markdown-style bold/italic
 *
 * @since 2025-12-02
 */

import { useState, useCallback, useMemo } from 'react';
import { Copy, Check, Code } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface MessageRendererProps {
  content: string;
  className?: string;
}

interface CodeBlockProps {
  code: string;
  language?: string;
}

// ============================================================================
// LANGUAGE DETECTION
// ============================================================================

const LANGUAGE_ALIASES: Record<string, string> = {
  'js': 'javascript',
  'ts': 'typescript',
  'tsx': 'typescript',
  'jsx': 'javascript',
  'py': 'python',
  'rb': 'ruby',
  'sh': 'bash',
  'shell': 'bash',
  'yml': 'yaml',
  'md': 'markdown',
};

const LANGUAGE_LABELS: Record<string, string> = {
  'javascript': 'JavaScript',
  'typescript': 'TypeScript',
  'python': 'Python',
  'bash': 'Bash',
  'json': 'JSON',
  'html': 'HTML',
  'css': 'CSS',
  'sql': 'SQL',
  'yaml': 'YAML',
  'markdown': 'Markdown',
  'rust': 'Rust',
  'go': 'Go',
  'java': 'Java',
  'csharp': 'C#',
  'cpp': 'C++',
  'ruby': 'Ruby',
  'php': 'PHP',
  'swift': 'Swift',
  'kotlin': 'Kotlin',
};

function normalizeLanguage(lang: string): string {
  const lower = lang.toLowerCase().trim();
  return LANGUAGE_ALIASES[lower] || lower;
}

function getLanguageLabel(lang: string): string {
  const normalized = normalizeLanguage(lang);
  return LANGUAGE_LABELS[normalized] || lang.toUpperCase();
}

// ============================================================================
// CODE BLOCK COMPONENT
// ============================================================================

function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('[CodeBlock] Failed to copy:', err);
    }
  }, [code]);

  const langLabel = language ? getLanguageLabel(language) : null;

  return (
    <div className="code-block-container my-3 rounded-lg overflow-hidden border border-gray-700 bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-gray-400" />
          {langLabel && (
            <span className="text-xs text-gray-400 font-medium">{langLabel}</span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          title={copied ? 'Copied!' : 'Copy code'}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content with Scrollbar */}
      <div className="code-block-scroll overflow-x-auto overflow-y-auto max-h-96">
        <pre className="p-4 text-sm leading-relaxed">
          <code className={`language-${language || 'plaintext'} text-gray-100`}>
            {code}
          </code>
        </pre>
      </div>
    </div>
  );
}

// ============================================================================
// INLINE CODE COMPONENT
// ============================================================================

function InlineCode({ code }: { code: string }) {
  return (
    <code className="inline-code px-1.5 py-0.5 mx-0.5 bg-gray-800 text-purple-300 rounded text-[0.9em] font-mono">
      {code}
    </code>
  );
}

// ============================================================================
// CONTENT PARSER
// ============================================================================

interface ParsedSegment {
  type: 'text' | 'code_block' | 'inline_code';
  content: string;
  language?: string;
}

function parseContent(content: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];

  // Regex for code blocks: ```language\ncode\n``` or ```code```
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;

  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index);
      segments.push(...parseInlineCode(textBefore));
    }

    // Add code block
    segments.push({
      type: 'code_block',
      content: match[2].trim(),
      language: match[1] || undefined,
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex);
    segments.push(...parseInlineCode(remaining));
  }

  return segments;
}

function parseInlineCode(text: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];

  // Regex for inline code: `code`
  const inlineCodeRegex = /`([^`]+)`/g;

  let lastIndex = 0;
  let match;

  while ((match = inlineCodeRegex.exec(text)) !== null) {
    // Add text before inline code
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }

    // Add inline code
    segments.push({
      type: 'inline_code',
      content: match[1],
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return segments;
}

// ============================================================================
// TEXT RENDERER (with bold/italic support)
// ============================================================================

function TextRenderer({ text }: { text: string }) {
  // Parse bold (**text**) and italic (*text* or _text_)
  const parts = useMemo(() => {
    const result: React.ReactNode[] = [];

    // Combined regex for bold and italic
    const formatRegex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(_(.+?)_)/g;

    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = formatRegex.exec(text)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        result.push(text.slice(lastIndex, match.index));
      }

      // Determine format type and add styled text
      if (match[2]) {
        // Bold: **text**
        result.push(<strong key={key++} className="font-semibold">{match[2]}</strong>);
      } else if (match[4]) {
        // Italic: *text*
        result.push(<em key={key++} className="italic">{match[4]}</em>);
      } else if (match[6]) {
        // Italic: _text_
        result.push(<em key={key++} className="italic">{match[6]}</em>);
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      result.push(text.slice(lastIndex));
    }

    return result.length > 0 ? result : [text];
  }, [text]);

  return <>{parts}</>;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MessageRenderer({ content, className = '' }: MessageRendererProps) {
  const segments = useMemo(() => parseContent(content), [content]);

  return (
    <div className={`message-renderer text-sm leading-relaxed ${className}`}>
      {segments.map((segment, index) => {
        switch (segment.type) {
          case 'code_block':
            return (
              <CodeBlock
                key={index}
                code={segment.content}
                language={segment.language}
              />
            );
          case 'inline_code':
            return <InlineCode key={index} code={segment.content} />;
          case 'text':
            return (
              <span key={index} className="whitespace-pre-wrap">
                <TextRenderer text={segment.content} />
              </span>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

// ============================================================================
// EXPORTED UTILITIES
// ============================================================================

export { CodeBlock, InlineCode, TextRenderer };
