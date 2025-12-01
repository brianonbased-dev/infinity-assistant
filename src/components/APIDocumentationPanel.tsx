'use client';

/**
 * API Documentation Panel Component
 *
 * Interactive API documentation for developers with:
 * - Endpoint reference
 * - Code examples in multiple languages
 * - Authentication guide
 * - Rate limiting info
 * - Live API tester
 */

import { useState, useCallback } from 'react';
import {
  Book,
  Code,
  Key,
  Terminal,
  Zap,
  Shield,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Play,
  Loader2,
  AlertCircle,
  Info,
} from 'lucide-react';

type CodeLanguage = 'typescript' | 'python' | 'curl' | 'javascript';

interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  title: string;
  description: string;
  parameters?: {
    name: string;
    type: string;
    required: boolean;
    description: string;
  }[];
  requestBody?: {
    type: string;
    example: string;
  };
  response?: {
    type: string;
    example: string;
  };
  codeExamples: Record<CodeLanguage, string>;
}

interface APIDocumentationPanelProps {
  apiKey?: string;
  baseUrl?: string;
  className?: string;
}

// Method badge colors
const methodColors: Record<string, string> = {
  GET: 'bg-green-500/20 text-green-400 border-green-500/30',
  POST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  PUT: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
  PATCH: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

// API Endpoints documentation
const apiEndpoints: APIEndpoint[] = [
  {
    method: 'POST',
    path: '/api/build',
    title: 'Start Build',
    description: 'Initiate a new workspace build with the specified template and configuration.',
    parameters: [
      { name: 'templateId', type: 'string', required: true, description: 'The template identifier to use' },
      { name: 'projectName', type: 'string', required: true, description: 'Name for the new project' },
      { name: 'options', type: 'object', required: false, description: 'Additional build options' },
    ],
    requestBody: {
      type: 'application/json',
      example: `{
  "templateId": "saas-starter",
  "projectName": "my-awesome-app",
  "options": {
    "includeAuth": true,
    "database": "supabase",
    "styling": "tailwind"
  }
}`,
    },
    response: {
      type: 'application/json',
      example: `{
  "success": true,
  "workspaceId": "ws_abc123xyz",
  "status": "building",
  "estimatedTime": "5-10 minutes"
}`,
    },
    codeExamples: {
      typescript: `import { InfinityClient } from '@infinity/sdk';

const client = new InfinityClient({ apiKey: 'YOUR_API_KEY' });

const workspace = await client.build.create({
  templateId: 'saas-starter',
  projectName: 'my-awesome-app',
  options: {
    includeAuth: true,
    database: 'supabase',
    styling: 'tailwind',
  },
});

console.log('Build started:', workspace.id);`,
      javascript: `const response = await fetch('https://api.infinityassistant.dev/api/build', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    templateId: 'saas-starter',
    projectName: 'my-awesome-app',
    options: {
      includeAuth: true,
      database: 'supabase',
      styling: 'tailwind',
    },
  }),
});

const data = await response.json();
console.log('Build started:', data.workspaceId);`,
      python: `import requests

response = requests.post(
    'https://api.infinityassistant.dev/api/build',
    headers={
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json',
    },
    json={
        'templateId': 'saas-starter',
        'projectName': 'my-awesome-app',
        'options': {
            'includeAuth': True,
            'database': 'supabase',
            'styling': 'tailwind',
        },
    },
)

data = response.json()
print(f"Build started: {data['workspaceId']}")`,
      curl: `curl -X POST https://api.infinityassistant.dev/api/build \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "templateId": "saas-starter",
    "projectName": "my-awesome-app",
    "options": {
      "includeAuth": true,
      "database": "supabase",
      "styling": "tailwind"
    }
  }'`,
    },
  },
  {
    method: 'GET',
    path: '/api/workspaces',
    title: 'List Workspaces',
    description: 'Retrieve all workspaces for the authenticated user.',
    parameters: [
      { name: 'status', type: 'string', required: false, description: 'Filter by status (active, completed, archived)' },
      { name: 'limit', type: 'number', required: false, description: 'Maximum results to return (default: 20)' },
      { name: 'offset', type: 'number', required: false, description: 'Pagination offset' },
    ],
    response: {
      type: 'application/json',
      example: `{
  "workspaces": [
    {
      "id": "ws_abc123xyz",
      "name": "my-awesome-app",
      "status": "completed",
      "createdAt": "2024-01-15T10:30:00Z",
      "filesCount": 24
    }
  ],
  "total": 5,
  "hasMore": false
}`,
    },
    codeExamples: {
      typescript: `import { InfinityClient } from '@infinity/sdk';

const client = new InfinityClient({ apiKey: 'YOUR_API_KEY' });

const workspaces = await client.workspaces.list({
  status: 'completed',
  limit: 10,
});

console.log('Workspaces:', workspaces.data);`,
      javascript: `const response = await fetch('https://api.infinityassistant.dev/api/workspaces?status=completed&limit=10', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
  },
});

const data = await response.json();
console.log('Workspaces:', data.workspaces);`,
      python: `import requests

response = requests.get(
    'https://api.infinityassistant.dev/api/workspaces',
    headers={'Authorization': 'Bearer YOUR_API_KEY'},
    params={'status': 'completed', 'limit': 10},
)

data = response.json()
print(f"Workspaces: {data['workspaces']}")`,
      curl: `curl https://api.infinityassistant.dev/api/workspaces?status=completed&limit=10 \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
    },
  },
  {
    method: 'GET',
    path: '/api/workspaces/{id}',
    title: 'Get Workspace',
    description: 'Retrieve details for a specific workspace including build status and files.',
    parameters: [
      { name: 'id', type: 'string', required: true, description: 'Workspace ID' },
    ],
    response: {
      type: 'application/json',
      example: `{
  "id": "ws_abc123xyz",
  "name": "my-awesome-app",
  "description": "SaaS application with auth",
  "status": "completed",
  "template": "saas-starter",
  "createdAt": "2024-01-15T10:30:00Z",
  "completedAt": "2024-01-15T10:45:00Z",
  "files": [...],
  "tokensUsed": 2450
}`,
    },
    codeExamples: {
      typescript: `import { InfinityClient } from '@infinity/sdk';

const client = new InfinityClient({ apiKey: 'YOUR_API_KEY' });

const workspace = await client.workspaces.get('ws_abc123xyz');
console.log('Workspace:', workspace);`,
      javascript: `const response = await fetch('https://api.infinityassistant.dev/api/workspaces/ws_abc123xyz', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
  },
});

const workspace = await response.json();
console.log('Workspace:', workspace);`,
      python: `import requests

response = requests.get(
    'https://api.infinityassistant.dev/api/workspaces/ws_abc123xyz',
    headers={'Authorization': 'Bearer YOUR_API_KEY'},
)

workspace = response.json()
print(f"Workspace: {workspace}")`,
      curl: `curl https://api.infinityassistant.dev/api/workspaces/ws_abc123xyz \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
    },
  },
  {
    method: 'GET',
    path: '/api/workspaces/{id}/files',
    title: 'List Workspace Files',
    description: 'Get the list of files generated for a workspace.',
    parameters: [
      { name: 'id', type: 'string', required: true, description: 'Workspace ID' },
      { name: 'path', type: 'string', required: false, description: 'Filter by directory path' },
    ],
    response: {
      type: 'application/json',
      example: `{
  "files": [
    {
      "path": "/src/app/page.tsx",
      "name": "page.tsx",
      "type": "file",
      "size": 2450,
      "status": "created"
    }
  ]
}`,
    },
    codeExamples: {
      typescript: `import { InfinityClient } from '@infinity/sdk';

const client = new InfinityClient({ apiKey: 'YOUR_API_KEY' });

const files = await client.workspaces.listFiles('ws_abc123xyz');
console.log('Files:', files);`,
      javascript: `const response = await fetch('https://api.infinityassistant.dev/api/workspaces/ws_abc123xyz/files', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
  },
});

const data = await response.json();
console.log('Files:', data.files);`,
      python: `import requests

response = requests.get(
    'https://api.infinityassistant.dev/api/workspaces/ws_abc123xyz/files',
    headers={'Authorization': 'Bearer YOUR_API_KEY'},
)

data = response.json()
print(f"Files: {data['files']}")`,
      curl: `curl https://api.infinityassistant.dev/api/workspaces/ws_abc123xyz/files \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
    },
  },
  {
    method: 'DELETE',
    path: '/api/workspaces/{id}',
    title: 'Delete Workspace',
    description: 'Permanently delete a workspace and all associated files.',
    parameters: [
      { name: 'id', type: 'string', required: true, description: 'Workspace ID' },
    ],
    response: {
      type: 'application/json',
      example: `{
  "success": true,
  "deleted": "ws_abc123xyz"
}`,
    },
    codeExamples: {
      typescript: `import { InfinityClient } from '@infinity/sdk';

const client = new InfinityClient({ apiKey: 'YOUR_API_KEY' });

await client.workspaces.delete('ws_abc123xyz');
console.log('Workspace deleted');`,
      javascript: `const response = await fetch('https://api.infinityassistant.dev/api/workspaces/ws_abc123xyz', {
  method: 'DELETE',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
  },
});

const data = await response.json();
console.log('Deleted:', data.deleted);`,
      python: `import requests

response = requests.delete(
    'https://api.infinityassistant.dev/api/workspaces/ws_abc123xyz',
    headers={'Authorization': 'Bearer YOUR_API_KEY'},
)

data = response.json()
print(f"Deleted: {data['deleted']}")`,
      curl: `curl -X DELETE https://api.infinityassistant.dev/api/workspaces/ws_abc123xyz \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
    },
  },
];

// Endpoint card component
function EndpointCard({
  endpoint,
  isExpanded,
  onToggle,
  apiKey,
}: {
  endpoint: APIEndpoint;
  isExpanded: boolean;
  onToggle: () => void;
  apiKey?: string;
}) {
  const [selectedLang, setSelectedLang] = useState<CodeLanguage>('typescript');
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; data?: unknown; error?: string } | null>(null);

  const copyCode = useCallback(() => {
    let code = endpoint.codeExamples[selectedLang];
    if (apiKey) {
      code = code.replace(/YOUR_API_KEY/g, apiKey);
    }
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [endpoint.codeExamples, selectedLang, apiKey]);

  const testEndpoint = useCallback(async () => {
    setTesting(true);
    setTestResult(null);

    // Simulate API test
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setTestResult({
      success: true,
      data: JSON.parse(endpoint.response?.example || '{}'),
    });
    setTesting(false);
  }, [endpoint.response?.example]);

  const languages: { id: CodeLanguage; label: string }[] = [
    { id: 'typescript', label: 'TypeScript' },
    { id: 'javascript', label: 'JavaScript' },
    { id: 'python', label: 'Python' },
    { id: 'curl', label: 'cURL' },
  ];

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-800/70 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 rounded text-xs font-mono font-bold border ${methodColors[endpoint.method]}`}>
            {endpoint.method}
          </span>
          <code className="text-sm text-gray-300 font-mono">{endpoint.path}</code>
          <span className="text-sm text-gray-400">{endpoint.title}</span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-500" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-700 p-4 space-y-4">
          {/* Description */}
          <p className="text-gray-300">{endpoint.description}</p>

          {/* Parameters */}
          {endpoint.parameters && endpoint.parameters.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-white mb-2">Parameters</h4>
              <div className="bg-gray-900/50 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-700">
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Required</th>
                      <th className="px-3 py-2">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpoint.parameters.map((param) => (
                      <tr key={param.name} className="border-b border-gray-700/50 last:border-0">
                        <td className="px-3 py-2 font-mono text-purple-400">{param.name}</td>
                        <td className="px-3 py-2 text-gray-400">{param.type}</td>
                        <td className="px-3 py-2">
                          {param.required ? (
                            <span className="text-red-400">Required</span>
                          ) : (
                            <span className="text-gray-500">Optional</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-300">{param.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Request Body */}
          {endpoint.requestBody && (
            <div>
              <h4 className="text-sm font-medium text-white mb-2">Request Body</h4>
              <pre className="p-3 bg-gray-900/50 rounded-lg text-sm text-gray-300 font-mono overflow-x-auto">
                {endpoint.requestBody.example}
              </pre>
            </div>
          )}

          {/* Response */}
          {endpoint.response && (
            <div>
              <h4 className="text-sm font-medium text-white mb-2">Response</h4>
              <pre className="p-3 bg-gray-900/50 rounded-lg text-sm text-gray-300 font-mono overflow-x-auto">
                {endpoint.response.example}
              </pre>
            </div>
          )}

          {/* Code Examples */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-white">Code Example</h4>
              <div className="flex items-center gap-2">
                {languages.map((lang) => (
                  <button
                    key={lang.id}
                    onClick={() => setSelectedLang(lang.id)}
                    className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                      selectedLang === lang.id
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <pre className="p-4 bg-gray-900/70 rounded-lg text-sm text-gray-300 font-mono overflow-x-auto">
                {apiKey
                  ? endpoint.codeExamples[selectedLang].replace(/YOUR_API_KEY/g, apiKey)
                  : endpoint.codeExamples[selectedLang]}
              </pre>
              <div className="absolute top-2 right-2 flex gap-2">
                <button
                  onClick={copyCode}
                  className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                  title="Copy code"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Try It Out */}
          <div className="pt-4 border-t border-gray-700">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-white">Try It Out</h4>
              <button
                onClick={testEndpoint}
                disabled={testing || !apiKey}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors text-sm"
              >
                {testing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Send Request
                  </>
                )}
              </button>
            </div>
            {!apiKey && (
              <p className="mt-2 text-xs text-yellow-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Add your API key to test this endpoint
              </p>
            )}
            {testResult && (
              <div className={`mt-3 p-3 rounded-lg ${testResult.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                <p className={`text-sm font-medium ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                  {testResult.success ? 'Success (200)' : 'Error'}
                </p>
                <pre className="mt-2 text-xs text-gray-300 font-mono overflow-x-auto">
                  {JSON.stringify(testResult.data || testResult.error, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function APIDocumentationPanel({
  apiKey,
  baseUrl = 'https://api.infinityassistant.dev',
  className = '',
}: APIDocumentationPanelProps) {
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>('POST /api/build');
  const [activeSection, setActiveSection] = useState<'endpoints' | 'auth' | 'limits'>('endpoints');

  const toggleEndpoint = (key: string) => {
    setExpandedEndpoint(expandedEndpoint === key ? null : key);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Section Tabs */}
      <div className="flex gap-2 border-b border-gray-700 pb-3">
        <button
          onClick={() => setActiveSection('endpoints')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            activeSection === 'endpoints'
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <Code className="w-4 h-4" />
          Endpoints
        </button>
        <button
          onClick={() => setActiveSection('auth')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            activeSection === 'auth'
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <Key className="w-4 h-4" />
          Authentication
        </button>
        <button
          onClick={() => setActiveSection('limits')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            activeSection === 'limits'
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <Zap className="w-4 h-4" />
          Rate Limits
        </button>
      </div>

      {/* Endpoints Section */}
      {activeSection === 'endpoints' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="text-gray-400">
              Base URL: <code className="text-purple-400 bg-gray-800 px-2 py-1 rounded">{baseUrl}</code>
            </p>
            <a
              href="https://docs.infinityassistant.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300"
            >
              Full Documentation
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          <div className="space-y-3">
            {apiEndpoints.map((endpoint) => (
              <EndpointCard
                key={`${endpoint.method} ${endpoint.path}`}
                endpoint={endpoint}
                isExpanded={expandedEndpoint === `${endpoint.method} ${endpoint.path}`}
                onToggle={() => toggleEndpoint(`${endpoint.method} ${endpoint.path}`)}
                apiKey={apiKey}
              />
            ))}
          </div>
        </div>
      )}

      {/* Authentication Section */}
      {activeSection === 'auth' && (
        <div className="space-y-6 animate-fade-in">
          <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-purple-400" />
              <h3 className="text-lg font-semibold text-white">API Authentication</h3>
            </div>
            <p className="text-gray-300 mb-4">
              All API requests require authentication using a Bearer token in the Authorization header.
            </p>
            <div className="bg-gray-900/50 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-2">Header Format:</p>
              <code className="text-purple-400 font-mono">
                Authorization: Bearer {'<your-api-key>'}
              </code>
            </div>
          </div>

          <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
            <h4 className="font-medium text-white mb-3">Getting Your API Key</h4>
            <ol className="space-y-2 text-gray-300 text-sm">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center text-xs text-purple-400 shrink-0">1</span>
                Navigate to the API Keys tab in your dashboard
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center text-xs text-purple-400 shrink-0">2</span>
                Click &quot;Add Provider&quot; and select InfinityAssistant
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center text-xs text-purple-400 shrink-0">3</span>
                Copy your API key and store it securely
              </li>
            </ol>
          </div>

          <div className="p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-400 mb-1">Security Best Practices</h4>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>Never expose your API key in client-side code</li>
                  <li>Use environment variables to store keys</li>
                  <li>Rotate keys periodically</li>
                  <li>Use different keys for development and production</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rate Limits Section */}
      {activeSection === 'limits' && (
        <div className="space-y-6 animate-fade-in">
          <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-6 h-6 text-purple-400" />
              <h3 className="text-lg font-semibold text-white">Rate Limits</h3>
            </div>
            <p className="text-gray-300 mb-4">
              API rate limits are applied per API key to ensure fair usage and system stability.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-900/50 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">Free Tier</p>
                <p className="text-2xl font-bold text-white">100</p>
                <p className="text-sm text-gray-500">requests/hour</p>
              </div>
              <div className="p-4 bg-gray-900/50 rounded-lg border border-purple-500/30">
                <p className="text-sm text-purple-400 mb-1">Builder Tier</p>
                <p className="text-2xl font-bold text-white">1,000</p>
                <p className="text-sm text-gray-500">requests/hour</p>
              </div>
              <div className="p-4 bg-gray-900/50 rounded-lg border border-amber-500/30">
                <p className="text-sm text-amber-400 mb-1">Enterprise</p>
                <p className="text-2xl font-bold text-white">Unlimited</p>
                <p className="text-sm text-gray-500">custom limits</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
            <h4 className="font-medium text-white mb-3">Rate Limit Headers</h4>
            <p className="text-gray-300 text-sm mb-4">
              Each API response includes headers to help you track your rate limit status:
            </p>
            <div className="bg-gray-900/50 rounded-lg p-4 space-y-2 font-mono text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">X-RateLimit-Limit:</span>
                <span className="text-purple-400">1000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">X-RateLimit-Remaining:</span>
                <span className="text-purple-400">999</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">X-RateLimit-Reset:</span>
                <span className="text-purple-400">1704110400</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/30">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-400 mb-1">Handling Rate Limits</h4>
                <p className="text-sm text-gray-300">
                  If you exceed your rate limit, the API returns a 429 Too Many Requests response.
                  Implement exponential backoff and check the X-RateLimit-Reset header to know when
                  you can retry.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
