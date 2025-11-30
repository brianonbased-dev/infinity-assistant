/**
 * Error Recovery Service
 *
 * Intelligent error detection, diagnosis, and automated recovery suggestions.
 * Analyzes stack traces, logs, and code patterns to provide actionable fixes.
 */

// =============================================================================
// TYPES
// =============================================================================

export type ErrorCategory =
  | 'syntax'
  | 'type'
  | 'runtime'
  | 'network'
  | 'database'
  | 'authentication'
  | 'permission'
  | 'configuration'
  | 'dependency'
  | 'build'
  | 'deployment'
  | 'memory'
  | 'timeout'
  | 'unknown';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ErrorAnalysis {
  id: string;
  error: ParsedError;
  category: ErrorCategory;
  severity: ErrorSeverity;
  rootCause: RootCause;
  suggestions: RecoverySuggestion[];
  relatedErrors: string[];
  documentation?: DocumentationLink[];
  autoFixAvailable: boolean;
  createdAt: string;
}

export interface ParsedError {
  name: string;
  message: string;
  stack?: StackFrame[];
  code?: string;
  originalError: string;
  file?: string;
  line?: number;
  column?: number;
}

export interface StackFrame {
  function: string;
  file: string;
  line: number;
  column: number;
  isInternal: boolean;
  isNodeModule: boolean;
  source?: string;
}

export interface RootCause {
  description: string;
  confidence: number;
  evidence: string[];
  pattern?: ErrorPattern;
}

export interface ErrorPattern {
  id: string;
  name: string;
  regex: RegExp;
  category: ErrorCategory;
  commonCauses: string[];
  solutions: string[];
}

export interface RecoverySuggestion {
  id: string;
  title: string;
  description: string;
  priority: number;
  type: 'code_fix' | 'config_change' | 'dependency_update' | 'manual_action';
  autoFixable: boolean;
  fix?: CodeFix;
  commands?: string[];
  steps?: string[];
  confidence: number;
}

export interface CodeFix {
  file: string;
  line: number;
  oldCode: string;
  newCode: string;
  explanation: string;
}

export interface DocumentationLink {
  title: string;
  url: string;
  type: 'official' | 'stackoverflow' | 'github' | 'blog';
  relevance: number;
}

export interface ErrorLog {
  id: string;
  projectId: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info';
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  resolved: boolean;
  analysis?: ErrorAnalysis;
}

export interface DiagnosticReport {
  id: string;
  projectId: string;
  timestamp: string;
  errors: ErrorAnalysis[];
  warnings: string[];
  healthScore: number;
  recommendations: string[];
}

// =============================================================================
// ERROR PATTERNS
// =============================================================================

const ERROR_PATTERNS: ErrorPattern[] = [
  // TypeScript/JavaScript Errors
  {
    id: 'ts_type_error',
    name: 'TypeScript Type Error',
    regex: /Type '(.+)' is not assignable to type '(.+)'/,
    category: 'type',
    commonCauses: [
      'Incorrect type annotation',
      'Missing type conversion',
      'Incompatible interface',
    ],
    solutions: [
      'Add proper type assertion',
      'Update type definition',
      'Use type guard',
    ],
  },
  {
    id: 'ts_property_error',
    name: 'Property Does Not Exist',
    regex: /Property '(.+)' does not exist on type '(.+)'/,
    category: 'type',
    commonCauses: [
      'Typo in property name',
      'Missing interface property',
      'Incorrect object shape',
    ],
    solutions: [
      'Check property spelling',
      'Add property to interface',
      'Use optional chaining',
    ],
  },
  {
    id: 'js_undefined',
    name: 'Undefined Reference',
    regex: /Cannot read propert(?:y|ies) '?(.+)'? of (undefined|null)/,
    category: 'runtime',
    commonCauses: [
      'Accessing property before initialization',
      'Missing null check',
      'Async data not loaded',
    ],
    solutions: [
      'Add null/undefined check',
      'Use optional chaining (?.',
      'Initialize with default value',
    ],
  },
  {
    id: 'js_not_function',
    name: 'Not a Function',
    regex: /(.+) is not a function/,
    category: 'runtime',
    commonCauses: [
      'Incorrect import',
      'Wrong variable type',
      'Missing method definition',
    ],
    solutions: [
      'Check import statement',
      'Verify function exists',
      'Check for typos in function name',
    ],
  },
  {
    id: 'module_not_found',
    name: 'Module Not Found',
    regex: /Cannot find module '(.+)'/,
    category: 'dependency',
    commonCauses: [
      'Missing npm package',
      'Incorrect import path',
      'Package not installed',
    ],
    solutions: [
      'Run npm install',
      'Check import path',
      'Install missing package',
    ],
  },
  // React Errors
  {
    id: 'react_hooks',
    name: 'Invalid Hook Call',
    regex: /Invalid hook call/,
    category: 'runtime',
    commonCauses: [
      'Hook called outside component',
      'Hook called conditionally',
      'Multiple React versions',
    ],
    solutions: [
      'Move hook to top level of component',
      'Remove conditional hook call',
      'Check for duplicate React',
    ],
  },
  {
    id: 'react_key',
    name: 'Missing Key Prop',
    regex: /Each child in a list should have a unique "key" prop/,
    category: 'runtime',
    commonCauses: [
      'Missing key in array map',
      'Using index as key incorrectly',
    ],
    solutions: [
      'Add unique key prop',
      'Use stable ID instead of index',
    ],
  },
  // Network Errors
  {
    id: 'network_fetch',
    name: 'Fetch Failed',
    regex: /fetch failed|NetworkError|Failed to fetch/i,
    category: 'network',
    commonCauses: [
      'Server unreachable',
      'CORS issue',
      'Network timeout',
    ],
    solutions: [
      'Check server status',
      'Configure CORS headers',
      'Add error handling',
    ],
  },
  {
    id: 'cors_error',
    name: 'CORS Error',
    regex: /CORS|Cross-Origin|blocked by CORS policy/i,
    category: 'network',
    commonCauses: [
      'Missing CORS headers',
      'Incorrect origin',
      'Preflight failure',
    ],
    solutions: [
      'Add Access-Control-Allow-Origin header',
      'Configure server CORS',
      'Use proxy in development',
    ],
  },
  // Database Errors
  {
    id: 'db_connection',
    name: 'Database Connection Error',
    regex: /ECONNREFUSED|Connection refused|connect ETIMEDOUT/i,
    category: 'database',
    commonCauses: [
      'Database server down',
      'Wrong connection string',
      'Network issue',
    ],
    solutions: [
      'Check database server status',
      'Verify connection string',
      'Check network/firewall',
    ],
  },
  {
    id: 'db_query',
    name: 'Query Error',
    regex: /relation "(.+)" does not exist|table.*doesn't exist/i,
    category: 'database',
    commonCauses: [
      'Table not created',
      'Migration not run',
      'Wrong schema',
    ],
    solutions: [
      'Run migrations',
      'Create missing table',
      'Check schema name',
    ],
  },
  // Authentication Errors
  {
    id: 'auth_unauthorized',
    name: 'Unauthorized',
    regex: /401|Unauthorized|Invalid token|JWT expired/i,
    category: 'authentication',
    commonCauses: [
      'Token expired',
      'Invalid credentials',
      'Missing auth header',
    ],
    solutions: [
      'Refresh token',
      'Re-authenticate user',
      'Check Authorization header',
    ],
  },
  {
    id: 'auth_forbidden',
    name: 'Forbidden',
    regex: /403|Forbidden|Permission denied|Access denied/i,
    category: 'permission',
    commonCauses: [
      'Insufficient permissions',
      'Wrong user role',
      'Resource access denied',
    ],
    solutions: [
      'Check user permissions',
      'Update role',
      'Verify access policy',
    ],
  },
  // Build Errors
  {
    id: 'build_syntax',
    name: 'Syntax Error',
    regex: /SyntaxError|Unexpected token|Parse error/i,
    category: 'syntax',
    commonCauses: [
      'Missing bracket/parenthesis',
      'Invalid syntax',
      'Unescaped character',
    ],
    solutions: [
      'Check for missing brackets',
      'Validate JSON/JS syntax',
      'Use linter',
    ],
  },
  {
    id: 'build_memory',
    name: 'Out of Memory',
    regex: /FATAL ERROR.*heap|JavaScript heap out of memory/i,
    category: 'memory',
    commonCauses: [
      'Large bundle size',
      'Memory leak',
      'Too many files',
    ],
    solutions: [
      'Increase Node memory limit',
      'Optimize bundle',
      'Use code splitting',
    ],
  },
];

// =============================================================================
// ERROR RECOVERY SERVICE
// =============================================================================

export class ErrorRecoveryService {
  private static instance: ErrorRecoveryService;
  private errorLogs: Map<string, ErrorLog> = new Map();
  private analysisCache: Map<string, ErrorAnalysis> = new Map();

  private constructor() {}

  static getInstance(): ErrorRecoveryService {
    if (!ErrorRecoveryService.instance) {
      ErrorRecoveryService.instance = new ErrorRecoveryService();
    }
    return ErrorRecoveryService.instance;
  }

  // ===========================================================================
  // ERROR ANALYSIS
  // ===========================================================================

  async analyzeError(
    errorInput: string | Error,
    context?: {
      file?: string;
      code?: string;
      projectId?: string;
    }
  ): Promise<ErrorAnalysis> {
    const analysisId = this.generateId();
    const now = new Date().toISOString();

    // Parse the error
    const parsedError = this.parseError(errorInput, context);

    // Identify category and pattern
    const { category, pattern } = this.categorizeError(parsedError);

    // Determine severity
    const severity = this.assessSeverity(category, parsedError);

    // Identify root cause
    const rootCause = this.identifyRootCause(parsedError, pattern, context?.code);

    // Generate recovery suggestions
    const suggestions = this.generateSuggestions(parsedError, pattern, category, context);

    // Find related documentation
    const documentation = await this.findDocumentation(parsedError, category);

    // Check if auto-fix is available
    const autoFixAvailable = suggestions.some((s) => s.autoFixable);

    const analysis: ErrorAnalysis = {
      id: analysisId,
      error: parsedError,
      category,
      severity,
      rootCause,
      suggestions,
      relatedErrors: this.findRelatedErrors(parsedError),
      documentation,
      autoFixAvailable,
      createdAt: now,
    };

    // Cache the analysis
    this.analysisCache.set(analysisId, analysis);

    // Log the error
    if (context?.projectId) {
      this.logError(context.projectId, parsedError, analysis);
    }

    return analysis;
  }

  private parseError(
    errorInput: string | Error,
    context?: { file?: string }
  ): ParsedError {
    const errorString = errorInput instanceof Error
      ? `${errorInput.name}: ${errorInput.message}\n${errorInput.stack}`
      : errorInput;

    const lines = errorString.split('\n');
    const firstLine = lines[0] || '';

    // Extract error name and message
    const match = firstLine.match(/^(\w+Error?):\s*(.+)$/);
    const name = match?.[1] || 'Error';
    const message = match?.[2] || firstLine;

    // Parse stack trace
    const stack = this.parseStackTrace(errorString);

    // Extract file and line from first stack frame or context
    const firstFrame = stack[0];
    const file = context?.file || firstFrame?.file;
    const line = firstFrame?.line;
    const column = firstFrame?.column;

    return {
      name,
      message,
      stack,
      originalError: errorString,
      file,
      line,
      column,
    };
  }

  private parseStackTrace(errorString: string): StackFrame[] {
    const frames: StackFrame[] = [];
    const stackRegex = /at\s+(?:(.+?)\s+)?\(?(.+):(\d+):(\d+)\)?/g;

    let match;
    while ((match = stackRegex.exec(errorString)) !== null) {
      const file = match[2];
      const isNodeModule = file.includes('node_modules');
      const isInternal = file.startsWith('internal/') || file.startsWith('node:');

      frames.push({
        function: match[1] || '<anonymous>',
        file,
        line: parseInt(match[3], 10),
        column: parseInt(match[4], 10),
        isInternal,
        isNodeModule,
      });
    }

    return frames;
  }

  private categorizeError(error: ParsedError): { category: ErrorCategory; pattern?: ErrorPattern } {
    // Check against known patterns
    for (const pattern of ERROR_PATTERNS) {
      if (pattern.regex.test(error.message) || pattern.regex.test(error.originalError)) {
        return { category: pattern.category, pattern };
      }
    }

    // Fallback categorization based on error name
    const nameCategories: Record<string, ErrorCategory> = {
      SyntaxError: 'syntax',
      TypeError: 'type',
      ReferenceError: 'runtime',
      RangeError: 'runtime',
      NetworkError: 'network',
      AuthenticationError: 'authentication',
      PermissionError: 'permission',
      TimeoutError: 'timeout',
    };

    if (nameCategories[error.name]) {
      return { category: nameCategories[error.name] };
    }

    // Check message for clues
    const messageClues: [RegExp, ErrorCategory][] = [
      [/syntax|parse|token/i, 'syntax'],
      [/type|undefined|null|property/i, 'type'],
      [/network|fetch|request|cors/i, 'network'],
      [/database|query|sql|connection/i, 'database'],
      [/auth|token|login|password/i, 'authentication'],
      [/permission|forbidden|access/i, 'permission'],
      [/timeout|timed out/i, 'timeout'],
      [/memory|heap|leak/i, 'memory'],
      [/build|compile|bundle/i, 'build'],
      [/deploy|server|host/i, 'deployment'],
      [/config|env|environment/i, 'configuration'],
      [/package|module|import|require/i, 'dependency'],
    ];

    for (const [regex, category] of messageClues) {
      if (regex.test(error.message)) {
        return { category };
      }
    }

    return { category: 'unknown' };
  }

  private assessSeverity(category: ErrorCategory, error: ParsedError): ErrorSeverity {
    // Critical errors
    if (
      category === 'authentication' ||
      category === 'permission' ||
      category === 'database' ||
      error.message.includes('security') ||
      error.message.includes('credential')
    ) {
      return 'critical';
    }

    // High severity
    if (
      category === 'build' ||
      category === 'deployment' ||
      category === 'memory' ||
      error.name === 'TypeError'
    ) {
      return 'high';
    }

    // Medium severity
    if (
      category === 'runtime' ||
      category === 'network' ||
      category === 'type'
    ) {
      return 'medium';
    }

    // Low severity
    return 'low';
  }

  private identifyRootCause(
    error: ParsedError,
    pattern?: ErrorPattern,
    code?: string
  ): RootCause {
    const evidence: string[] = [];
    let description = 'Unable to determine root cause';
    let confidence = 0.3;

    // Use pattern information
    if (pattern) {
      description = pattern.commonCauses[0];
      confidence = 0.7;
      evidence.push(`Matched error pattern: ${pattern.name}`);
    }

    // Analyze stack trace
    if (error.stack && error.stack.length > 0) {
      const userFrame = error.stack.find((f) => !f.isInternal && !f.isNodeModule);
      if (userFrame) {
        evidence.push(`Error originated in ${userFrame.file} at line ${userFrame.line}`);
        confidence += 0.1;
      }
    }

    // Analyze code context
    if (code && error.line) {
      const lines = code.split('\n');
      const errorLine = lines[error.line - 1];
      if (errorLine) {
        evidence.push(`Code at error location: ${errorLine.trim()}`);

        // Look for common issues
        if (errorLine.includes('await') && !errorLine.includes('async')) {
          description = 'Await used outside async function';
          confidence = 0.9;
        }
        if (errorLine.includes('.') && !errorLine.includes('?.')) {
          description = 'Potential null/undefined access - consider optional chaining';
          confidence = 0.6;
        }
      }
    }

    // Analyze error message
    if (error.message.includes("'")) {
      const match = error.message.match(/'([^']+)'/);
      if (match) {
        evidence.push(`Key identifier: ${match[1]}`);
      }
    }

    return {
      description,
      confidence: Math.min(confidence, 1),
      evidence,
      pattern,
    };
  }

  private generateSuggestions(
    error: ParsedError,
    pattern: ErrorPattern | undefined,
    category: ErrorCategory,
    context?: { file?: string; code?: string }
  ): RecoverySuggestion[] {
    const suggestions: RecoverySuggestion[] = [];

    // Add pattern-based suggestions
    if (pattern) {
      pattern.solutions.forEach((solution, index) => {
        suggestions.push({
          id: this.generateId(),
          title: solution,
          description: `Based on error pattern: ${pattern.name}`,
          priority: index + 1,
          type: 'manual_action',
          autoFixable: false,
          confidence: 0.7 - index * 0.1,
        });
      });
    }

    // Add category-specific suggestions
    const categorySuggestions = this.getCategorySuggestions(category, error, context);
    suggestions.push(...categorySuggestions);

    // Add specific code fixes if possible
    if (context?.code && context?.file && error.line) {
      const codeFix = this.generateCodeFix(error, context.code, context.file);
      if (codeFix) {
        suggestions.unshift({
          id: this.generateId(),
          title: 'Apply automatic fix',
          description: codeFix.explanation,
          priority: 0,
          type: 'code_fix',
          autoFixable: true,
          fix: codeFix,
          confidence: 0.8,
        });
      }
    }

    // Sort by priority
    return suggestions.sort((a, b) => a.priority - b.priority);
  }

  private getCategorySuggestions(
    category: ErrorCategory,
    error: ParsedError,
    context?: { file?: string; code?: string }
  ): RecoverySuggestion[] {
    const suggestions: RecoverySuggestion[] = [];

    switch (category) {
      case 'dependency':
        suggestions.push({
          id: this.generateId(),
          title: 'Install missing dependencies',
          description: 'Run npm install to ensure all dependencies are installed',
          priority: 1,
          type: 'dependency_update',
          autoFixable: true,
          commands: ['npm install'],
          confidence: 0.8,
        });

        // Extract module name if possible
        const moduleMatch = error.message.match(/Cannot find module '([^']+)'/);
        if (moduleMatch) {
          suggestions.push({
            id: this.generateId(),
            title: `Install ${moduleMatch[1]}`,
            description: `Specifically install the missing package: ${moduleMatch[1]}`,
            priority: 0,
            type: 'dependency_update',
            autoFixable: true,
            commands: [`npm install ${moduleMatch[1]}`],
            confidence: 0.9,
          });
        }
        break;

      case 'type':
        suggestions.push({
          id: this.generateId(),
          title: 'Add type assertion',
          description: 'Use type assertion or type guard to handle type mismatch',
          priority: 2,
          type: 'code_fix',
          autoFixable: false,
          steps: [
            'Identify the variable causing the type error',
            'Add appropriate type assertion: variable as Type',
            'Or use type guard: if (typeof x === "string")',
          ],
          confidence: 0.6,
        });
        break;

      case 'network':
        suggestions.push({
          id: this.generateId(),
          title: 'Add error handling',
          description: 'Wrap network calls in try-catch with proper error handling',
          priority: 2,
          type: 'code_fix',
          autoFixable: false,
          steps: [
            'Wrap fetch/axios calls in try-catch',
            'Handle specific error types',
            'Show user-friendly error messages',
            'Add retry logic for transient errors',
          ],
          confidence: 0.7,
        });
        break;

      case 'database':
        suggestions.push({
          id: this.generateId(),
          title: 'Check database connection',
          description: 'Verify database server is running and connection string is correct',
          priority: 1,
          type: 'manual_action',
          autoFixable: false,
          steps: [
            'Verify database server is running',
            'Check DATABASE_URL environment variable',
            'Test connection with database client',
            'Run pending migrations',
          ],
          confidence: 0.7,
        });
        break;

      case 'authentication':
        suggestions.push({
          id: this.generateId(),
          title: 'Refresh authentication',
          description: 'Token may have expired - try refreshing or re-authenticating',
          priority: 1,
          type: 'manual_action',
          autoFixable: false,
          steps: [
            'Check if token is expired',
            'Implement token refresh logic',
            'Clear stored credentials and re-login',
            'Verify API key is valid',
          ],
          confidence: 0.7,
        });
        break;

      case 'build':
        suggestions.push({
          id: this.generateId(),
          title: 'Clean and rebuild',
          description: 'Clear build cache and rebuild the project',
          priority: 1,
          type: 'dependency_update',
          autoFixable: true,
          commands: [
            'rm -rf node_modules/.cache',
            'rm -rf .next',
            'npm run build',
          ],
          confidence: 0.6,
        });
        break;

      case 'memory':
        suggestions.push({
          id: this.generateId(),
          title: 'Increase Node memory',
          description: 'Increase Node.js memory limit for build process',
          priority: 1,
          type: 'config_change',
          autoFixable: true,
          commands: ['export NODE_OPTIONS="--max-old-space-size=4096"'],
          confidence: 0.7,
        });
        break;
    }

    return suggestions;
  }

  private generateCodeFix(
    error: ParsedError,
    code: string,
    file: string
  ): CodeFix | null {
    if (!error.line) return null;

    const lines = code.split('\n');
    const errorLine = lines[error.line - 1];
    if (!errorLine) return null;

    // Common fixes based on error patterns
    // Fix: Optional chaining for undefined access
    if (error.message.includes("Cannot read propert")) {
      const match = errorLine.match(/(\w+)\.(\w+)/);
      if (match) {
        const newCode = errorLine.replace(`${match[1]}.${match[2]}`, `${match[1]}?.${match[2]}`);
        return {
          file,
          line: error.line,
          oldCode: errorLine,
          newCode,
          explanation: `Add optional chaining to prevent undefined access on ${match[1]}`,
        };
      }
    }

    // Fix: Add missing await
    if (error.message.includes('Promise') && !errorLine.includes('await')) {
      if (errorLine.includes('.then(')) {
        // Already using .then(), suggest async/await instead
        return null;
      }

      const asyncCallMatch = errorLine.match(/(\w+)\s*\([^)]*\)/);
      if (asyncCallMatch) {
        const newCode = errorLine.replace(asyncCallMatch[0], `await ${asyncCallMatch[0]}`);
        return {
          file,
          line: error.line,
          oldCode: errorLine,
          newCode,
          explanation: 'Add await keyword to handle Promise',
        };
      }
    }

    // Fix: Add type assertion
    if (error.message.includes('Type') && error.message.includes('is not assignable')) {
      const typeMatch = error.message.match(/to type '([^']+)'/);
      if (typeMatch) {
        const varMatch = errorLine.match(/(\w+)\s*=/);
        if (varMatch) {
          const newCode = errorLine.replace(`= `, `= (`) + `) as ${typeMatch[1]}`;
          return {
            file,
            line: error.line,
            oldCode: errorLine,
            newCode,
            explanation: `Add type assertion to satisfy TypeScript`,
          };
        }
      }
    }

    return null;
  }

  private async findDocumentation(
    error: ParsedError,
    category: ErrorCategory
  ): Promise<DocumentationLink[]> {
    const docs: DocumentationLink[] = [];

    // Add relevant documentation based on category
    const docSources: Record<ErrorCategory, DocumentationLink[]> = {
      type: [
        {
          title: 'TypeScript Handbook - Everyday Types',
          url: 'https://www.typescriptlang.org/docs/handbook/2/everyday-types.html',
          type: 'official',
          relevance: 0.8,
        },
      ],
      runtime: [
        {
          title: 'MDN - JavaScript Reference',
          url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference',
          type: 'official',
          relevance: 0.7,
        },
      ],
      network: [
        {
          title: 'MDN - Using Fetch',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch',
          type: 'official',
          relevance: 0.8,
        },
      ],
      database: [
        {
          title: 'Supabase Documentation',
          url: 'https://supabase.com/docs',
          type: 'official',
          relevance: 0.7,
        },
      ],
      authentication: [
        {
          title: 'Auth0 Documentation',
          url: 'https://auth0.com/docs',
          type: 'official',
          relevance: 0.7,
        },
      ],
      build: [
        {
          title: 'Vite Troubleshooting',
          url: 'https://vitejs.dev/guide/troubleshooting',
          type: 'official',
          relevance: 0.7,
        },
      ],
      dependency: [
        {
          title: 'npm Documentation',
          url: 'https://docs.npmjs.com/',
          type: 'official',
          relevance: 0.7,
        },
      ],
      syntax: [],
      permission: [],
      configuration: [],
      deployment: [],
      memory: [],
      timeout: [],
      unknown: [],
    };

    if (docSources[category]) {
      docs.push(...docSources[category]);
    }

    return docs;
  }

  private findRelatedErrors(error: ParsedError): string[] {
    const related: string[] = [];

    // Find cached analyses with similar errors
    for (const [id, analysis] of this.analysisCache) {
      if (analysis.error.name === error.name && analysis.id !== error.name) {
        related.push(id);
      }
    }

    return related.slice(0, 5);
  }

  // ===========================================================================
  // ERROR LOGGING
  // ===========================================================================

  private logError(projectId: string, error: ParsedError, analysis: ErrorAnalysis): void {
    const logId = this.generateId();

    const log: ErrorLog = {
      id: logId,
      projectId,
      timestamp: new Date().toISOString(),
      level: 'error',
      message: error.message,
      stack: error.originalError,
      resolved: false,
      analysis,
    };

    this.errorLogs.set(logId, log);
  }

  async getErrorLogs(
    projectId: string,
    options?: { resolved?: boolean; limit?: number }
  ): Promise<ErrorLog[]> {
    let logs = Array.from(this.errorLogs.values())
      .filter((log) => log.projectId === projectId);

    if (options?.resolved !== undefined) {
      logs = logs.filter((log) => log.resolved === options.resolved);
    }

    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (options?.limit) {
      logs = logs.slice(0, options.limit);
    }

    return logs;
  }

  async resolveError(errorId: string): Promise<void> {
    const log = this.errorLogs.get(errorId);
    if (log) {
      log.resolved = true;
    }
  }

  // ===========================================================================
  // DIAGNOSTICS
  // ===========================================================================

  async runDiagnostics(
    projectId: string,
    code: string,
    files: string[]
  ): Promise<DiagnosticReport> {
    const reportId = this.generateId();
    const errors: ErrorAnalysis[] = [];
    const warnings: string[] = [];
    let healthScore = 100;

    // Analyze code for potential issues
    const issues = this.detectPotentialIssues(code);
    for (const issue of issues) {
      if (issue.severity === 'error') {
        const analysis = await this.analyzeError(issue.message, { projectId, code });
        errors.push(analysis);
        healthScore -= 10;
      } else {
        warnings.push(issue.message);
        healthScore -= 2;
      }
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(errors, warnings);

    return {
      id: reportId,
      projectId,
      timestamp: new Date().toISOString(),
      errors,
      warnings,
      healthScore: Math.max(0, healthScore),
      recommendations,
    };
  }

  private detectPotentialIssues(code: string): Array<{ message: string; severity: 'error' | 'warning' }> {
    const issues: Array<{ message: string; severity: 'error' | 'warning' }> = [];

    // Check for console.log statements
    if (code.includes('console.log')) {
      issues.push({
        message: 'Console.log statements found - consider removing for production',
        severity: 'warning',
      });
    }

    // Check for TODO comments
    if (code.includes('TODO')) {
      issues.push({
        message: 'TODO comments found - address before deployment',
        severity: 'warning',
      });
    }

    // Check for hardcoded secrets
    const secretPatterns = [
      /api[_-]?key\s*[=:]\s*['"][^'"]+['"]/i,
      /password\s*[=:]\s*['"][^'"]+['"]/i,
      /secret\s*[=:]\s*['"][^'"]+['"]/i,
    ];
    for (const pattern of secretPatterns) {
      if (pattern.test(code)) {
        issues.push({
          message: 'Potential hardcoded secret detected - use environment variables',
          severity: 'error',
        });
        break;
      }
    }

    // Check for any type
    if (code.includes(': any')) {
      issues.push({
        message: 'Usage of "any" type detected - consider using specific types',
        severity: 'warning',
      });
    }

    // Check for async without await
    const asyncFunctions = code.match(/async\s+(?:function\s+)?\w+\s*\([^)]*\)\s*{[^}]+}/g) || [];
    for (const func of asyncFunctions) {
      if (!func.includes('await')) {
        issues.push({
          message: 'Async function without await - may be unnecessary',
          severity: 'warning',
        });
        break;
      }
    }

    return issues;
  }

  private generateRecommendations(errors: ErrorAnalysis[], warnings: string[]): string[] {
    const recommendations: string[] = [];

    if (errors.length > 5) {
      recommendations.push('High error count detected - consider a comprehensive code review');
    }

    if (errors.some((e) => e.category === 'type')) {
      recommendations.push('Enable strict TypeScript checking for better type safety');
    }

    if (errors.some((e) => e.category === 'runtime')) {
      recommendations.push('Add comprehensive error boundaries and try-catch blocks');
    }

    if (warnings.some((w) => w.includes('console.log'))) {
      recommendations.push('Set up a proper logging solution (e.g., Pino, Winston)');
    }

    if (warnings.some((w) => w.includes('TODO'))) {
      recommendations.push('Create issues for TODO items to track technical debt');
    }

    return recommendations;
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  private generateId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getAnalysis(analysisId: string): Promise<ErrorAnalysis | null> {
    return this.analysisCache.get(analysisId) || null;
  }

  async applyFix(fix: CodeFix): Promise<boolean> {
    // In a real implementation, this would apply the fix to the file
    console.log(`Applying fix to ${fix.file}:${fix.line}`);
    console.log(`Old: ${fix.oldCode}`);
    console.log(`New: ${fix.newCode}`);
    return true;
  }
}

// Export singleton
export const errorRecovery = ErrorRecoveryService.getInstance();
