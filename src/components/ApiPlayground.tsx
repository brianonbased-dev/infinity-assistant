/**
 * API Playground Component
 * 
 * Interactive API explorer for testing Infinity Assistant APIs
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Play,
  Code,
  Copy,
  Check,
  Loader2,
  Settings,
  Key,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Globe,
  MessageSquare,
  Search,
  Database,
  Webhook,
  Heart,
} from 'lucide-react';

interface ApiEndpoint {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  category: 'chat' | 'knowledge' | 'memory' | 'research' | 'webhooks' | 'health';
  icon: React.ElementType;
  requiresAuth: boolean;
  requestBody?: {
    type: 'json';
    schema: Record<string, any>;
    example: any;
  };
  queryParams?: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
}

const API_ENDPOINTS: ApiEndpoint[] = [
  {
    id: 'chat',
    name: 'Chat',
    method: 'POST',
    path: '/chat',
    description: 'Send a message to Infinity Assistant',
    category: 'chat',
    icon: MessageSquare,
    requiresAuth: true,
    requestBody: {
      type: 'json',
      schema: {
        message: { type: 'string', required: true },
        conversationId: { type: 'string', required: false },
        mode: { type: 'string', enum: ['search', 'assist', 'build'], required: false },
        preferences: { type: 'object', required: false },
      },
      example: {
        message: 'Hello! How can you help me?',
        mode: 'assist',
      },
    },
  },
  {
    id: 'knowledge-search',
    name: 'Search Knowledge',
    method: 'POST',
    path: '/knowledge/search',
    description: 'Search the knowledge base for wisdom, patterns, and gotchas',
    category: 'knowledge',
    icon: Search,
    requiresAuth: true,
    requestBody: {
      type: 'json',
      schema: {
        query: { type: 'string', required: true },
        limit: { type: 'number', required: false },
        filters: { type: 'object', required: false },
      },
      example: {
        query: 'TypeScript best practices',
        limit: 10,
      },
    },
  },
  {
    id: 'memory-store',
    name: 'Store Memory',
    method: 'POST',
    path: '/memory/store',
    description: 'Store user memory with optional TTL',
    category: 'memory',
    icon: Database,
    requiresAuth: true,
    requestBody: {
      type: 'json',
      schema: {
        key: { type: 'string', required: true },
        value: { type: 'any', required: true },
        ttl: { type: 'number', required: false },
      },
      example: {
        key: 'user_preference',
        value: { theme: 'dark', language: 'en' },
        ttl: 3600,
      },
    },
  },
  {
    id: 'memory-retrieve',
    name: 'Retrieve Memory',
    method: 'GET',
    path: '/memory/retrieve',
    description: 'Retrieve stored memory by key',
    category: 'memory',
    icon: Database,
    requiresAuth: true,
    queryParams: [
      {
        name: 'key',
        type: 'string',
        required: true,
        description: 'Memory key to retrieve',
      },
    ],
  },
  {
    id: 'research',
    name: 'Research',
    method: 'POST',
    path: '/research',
    description: 'Perform web research on a topic',
    category: 'research',
    icon: Globe,
    requiresAuth: true,
    requestBody: {
      type: 'json',
      schema: {
        query: { type: 'string', required: true },
        depth: { type: 'string', enum: ['shallow', 'medium', 'deep'], required: false },
        sources: { type: 'number', required: false },
      },
      example: {
        query: 'latest developments in AI',
        depth: 'medium',
        sources: 5,
      },
    },
  },
  {
    id: 'health',
    name: 'Health Check',
    method: 'GET',
    path: '/health',
    description: 'Check API health status',
    category: 'health',
    icon: Heart,
    requiresAuth: false,
  },
  {
    id: 'api-keys-list',
    name: 'List API Keys',
    method: 'GET',
    path: '/api-keys',
    description: 'List all API keys for the authenticated user',
    category: 'webhooks',
    icon: Key,
    requiresAuth: true,
  },
  {
    id: 'webhooks-list',
    name: 'List Webhooks',
    method: 'GET',
    path: '/webhooks',
    description: 'List all registered webhooks',
    category: 'webhooks',
    icon: Webhook,
    requiresAuth: true,
  },
];

const CATEGORIES = [
  { id: 'all', name: 'All Endpoints', icon: Globe },
  { id: 'chat', name: 'Chat', icon: MessageSquare },
  { id: 'knowledge', name: 'Knowledge', icon: Search },
  { id: 'memory', name: 'Memory', icon: Database },
  { id: 'research', name: 'Research', icon: Globe },
  { id: 'webhooks', name: 'Webhooks', icon: Webhook },
  { id: 'health', name: 'Health', icon: Heart },
];

export function ApiPlayground() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [apiKey, setApiKey] = useState<string>('');
  const [baseUrl, setBaseUrl] = useState<string>('https://infinityassistant.io/api');
  const [requestBody, setRequestBody] = useState<string>('{}');
  const [queryParams, setQueryParams] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [codeLanguage, setCodeLanguage] = useState<'javascript' | 'python' | 'curl'>('javascript');

  // Load API key from localStorage
  useEffect(() => {
    const savedApiKey = localStorage.getItem('infinity_assistant_api_key');
    const savedBaseUrl = localStorage.getItem('infinity_assistant_base_url');
    if (savedApiKey) setApiKey(savedApiKey);
    if (savedBaseUrl) setBaseUrl(savedBaseUrl);
  }, []);

  // Save API key to localStorage
  const saveApiKey = (key: string) => {
    localStorage.setItem('infinity_assistant_api_key', key);
    setApiKey(key);
  };

  // Select endpoint and populate defaults
  const handleSelectEndpoint = (endpoint: ApiEndpoint) => {
    setSelectedEndpoint(endpoint);
    setError(null);
    setResponse(null);
    
    if (endpoint.requestBody?.example) {
      setRequestBody(JSON.stringify(endpoint.requestBody.example, null, 2));
    } else {
      setRequestBody('{}');
    }

    if (endpoint.queryParams) {
      const params: Record<string, string> = {};
      endpoint.queryParams.forEach(param => {
        params[param.name] = '';
      });
      setQueryParams(params);
    } else {
      setQueryParams({});
    }
  };

  // Send request
  const handleSendRequest = async () => {
    if (!selectedEndpoint) return;

    if (selectedEndpoint.requiresAuth && !apiKey) {
      setError('API key is required for this endpoint');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      let url = `${baseUrl}${selectedEndpoint.path}`;
      
      // Add query parameters
      if (selectedEndpoint.queryParams && Object.keys(queryParams).length > 0) {
        const params = new URLSearchParams();
        Object.entries(queryParams).forEach(([key, value]) => {
          if (value) params.append(key, value);
        });
        if (params.toString()) {
          url += `?${params.toString()}`;
        }
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (apiKey) {
        headers['X-API-Key'] = apiKey;
      }

      const options: RequestInit = {
        method: selectedEndpoint.method,
        headers,
      };

      if (selectedEndpoint.method !== 'GET' && requestBody) {
        try {
          JSON.parse(requestBody); // Validate JSON
          options.body = requestBody;
        } catch (e) {
          setError('Invalid JSON in request body');
          setLoading(false);
          return;
        }
      }

      const res = await fetch(url, options);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || data.message || 'Request failed');
        setResponse({ status: res.status, ...data });
      } else {
        setResponse({ status: res.status, ...data });
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
      setResponse(null);
    } finally {
      setLoading(false);
    }
  };

  // Generate code example
  const generateCode = () => {
    if (!selectedEndpoint) return '';

    const url = `${baseUrl}${selectedEndpoint.path}`;
    let code = '';

    if (codeLanguage === 'javascript') {
      code = `const response = await fetch('${url}', {\n`;
      code += `  method: '${selectedEndpoint.method}',\n`;
      code += `  headers: {\n`;
      code += `    'Content-Type': 'application/json',\n`;
      if (apiKey) {
        code += `    'X-API-Key': '${apiKey}',\n`;
      }
      code += `  },\n`;
      if (selectedEndpoint.method !== 'GET' && requestBody) {
        code += `  body: JSON.stringify(${requestBody}),\n`;
      }
      code += `});\n\n`;
      code += `const data = await response.json();\n`;
      code += `console.log(data);`;
    } else if (codeLanguage === 'python') {
      code = `import requests\n\n`;
      code += `headers = {\n`;
      code += `    'Content-Type': 'application/json',\n`;
      if (apiKey) {
        code += `    'X-API-Key': '${apiKey}',\n`;
      }
      code += `}\n\n`;
      if (selectedEndpoint.method !== 'GET' && requestBody) {
        code += `data = ${requestBody}\n\n`;
      }
      code += `response = requests.${selectedEndpoint.method.toLowerCase()}('${url}', `;
      if (selectedEndpoint.method !== 'GET' && requestBody) {
        code += `json=data, `;
      }
      code += `headers=headers)\n`;
      code += `print(response.json())`;
    } else if (codeLanguage === 'curl') {
      code = `curl -X ${selectedEndpoint.method} '${url}' \\\n`;
      code += `  -H 'Content-Type: application/json' \\\n`;
      if (apiKey) {
        code += `  -H 'X-API-Key: ${apiKey}' \\\n`;
      }
      if (selectedEndpoint.method !== 'GET' && requestBody) {
        code += `  -d '${requestBody.replace(/\n/g, ' ')}'`;
      }
    }

    return code;
  };

  // Copy to clipboard
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter endpoints by category
  const filteredEndpoints = selectedCategory === 'all'
    ? API_ENDPOINTS
    : API_ENDPOINTS.filter(e => e.category === selectedCategory);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Sidebar - Endpoint Selector */}
      <div className="lg:col-span-1 space-y-4">
        {/* Settings */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center justify-between text-white mb-2"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              <span className="font-medium">Settings</span>
            </div>
            {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {showSettings && (
            <div className="space-y-3 mt-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Base URL</label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => {
                    setBaseUrl(e.target.value);
                    localStorage.setItem('infinity_assistant_base_url', e.target.value);
                  }}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => saveApiKey(e.target.value)}
                  placeholder="ia_your_api_key_here"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Get your API key from{' '}
                  <a href="/dashboard" className="text-purple-400 hover:text-purple-300">
                    Dashboard
                  </a>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Category Filter */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <h3 className="text-white font-medium mb-3">Categories</h3>
          <div className="space-y-1">
            {CATEGORIES.map(category => {
              const Icon = category.icon;
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedCategory === category.id
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{category.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Endpoints List */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <h3 className="text-white font-medium mb-3">Endpoints</h3>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {filteredEndpoints.map(endpoint => {
              const Icon = endpoint.icon;
              return (
                <button
                  key={endpoint.id}
                  onClick={() => handleSelectEndpoint(endpoint)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                    selectedEndpoint?.id === endpoint.id
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{endpoint.name}</div>
                    <div className="text-xs opacity-75 truncate">{endpoint.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content - Request/Response */}
      <div className="lg:col-span-2 space-y-4">
        {selectedEndpoint ? (
          <>
            {/* Endpoint Info */}
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  {(() => {
                    const Icon = selectedEndpoint.icon;
                    return <Icon className="w-5 h-5 text-purple-400" />;
                  })()}
                  <div>
                    <h3 className="text-white font-semibold">{selectedEndpoint.name}</h3>
                    <p className="text-sm text-gray-400">{selectedEndpoint.description}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-mono ${
                  selectedEndpoint.method === 'GET' ? 'bg-green-500/20 text-green-400' :
                  selectedEndpoint.method === 'POST' ? 'bg-blue-500/20 text-blue-400' :
                  selectedEndpoint.method === 'PUT' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {selectedEndpoint.method}
                </span>
              </div>
              <code className="text-sm text-gray-300 font-mono">{selectedEndpoint.path}</code>
            </div>

            {/* Query Parameters */}
            {selectedEndpoint.queryParams && selectedEndpoint.queryParams.length > 0 && (
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <h4 className="text-white font-medium mb-3">Query Parameters</h4>
                <div className="space-y-2">
                  {selectedEndpoint.queryParams.map(param => (
                    <div key={param.name}>
                      <label className="block text-sm text-gray-400 mb-1">
                        {param.name} {param.required && <span className="text-red-400">*</span>}
                      </label>
                      <input
                        type="text"
                        value={queryParams[param.name] || ''}
                        onChange={(e) => setQueryParams({ ...queryParams, [param.name]: e.target.value })}
                        placeholder={param.description}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Request Body */}
            {selectedEndpoint.requestBody && (
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-white font-medium">Request Body</h4>
                  <button
                    onClick={() => {
                      try {
                        const parsed = JSON.parse(requestBody);
                        setRequestBody(JSON.stringify(parsed, null, 2));
                      } catch (e) {
                        // Invalid JSON, ignore
                      }
                    }}
                    className="text-xs text-purple-400 hover:text-purple-300"
                  >
                    Format JSON
                  </button>
                </div>
                <textarea
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  className="w-full h-48 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-purple-500 resize-none"
                  spellCheck={false}
                />
              </div>
            )}

            {/* Send Button */}
            <button
              onClick={handleSendRequest}
              disabled={loading || (selectedEndpoint.requiresAuth && !apiKey)}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  <span>Send Request</span>
                </>
              )}
            </button>

            {/* Response */}
            {(response || error) && (
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {error ? (
                      <>
                        <AlertCircle className="w-5 h-5 text-red-400" />
                        <h4 className="text-white font-medium">Error</h4>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                        <h4 className="text-white font-medium">Response</h4>
                      </>
                    )}
                  </div>
                  {response && (
                    <button
                      onClick={() => handleCopy(JSON.stringify(response, null, 2))}
                      className="flex items-center gap-1 text-sm text-gray-400 hover:text-white"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto text-sm text-gray-300 font-mono">
                  {error ? error : JSON.stringify(response, null, 2)}
                </pre>
              </div>
            )}

            {/* Code Generation */}
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-white font-medium">Code Example</h4>
                <div className="flex items-center gap-2">
                  <select
                    value={codeLanguage}
                    onChange={(e) => setCodeLanguage(e.target.value as any)}
                    className="px-2 py-1 bg-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-purple-500"
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                    <option value="curl">cURL</option>
                  </select>
                  <button
                    onClick={() => handleCopy(generateCode())}
                    className="flex items-center gap-1 px-3 py-1 bg-gray-900 border border-gray-700 rounded text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto text-sm text-gray-300 font-mono">
                {generateCode()}
              </pre>
            </div>
          </>
        ) : (
          <div className="bg-gray-800/50 rounded-xl p-8 border border-gray-700 text-center">
            <Globe className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-white text-xl font-semibold mb-2">Select an Endpoint</h3>
            <p className="text-gray-400">
              Choose an API endpoint from the sidebar to start testing
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

