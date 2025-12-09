/'use client';

/**
 * Developer Dashboard
 *
 * Main hub for experienced users after workspace creation.
 * Provides:
 * - Workspace overview and file browser
 * - API key management
 * - Documentation and guides
 * - Deployment options
 * - Build history and metrics
 *
 * @since 2025-12-01
 */

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';
import {
  LayoutDashboard,
  FolderOpen,
  Key,
  Book,
  Rocket,
  Settings,
  Terminal,
  Code,
  GitBranch,
  Database,
  Cloud,
  ExternalLink,
  Copy,
  Check,
  ChevronRight,
  Plus,
  Clock,
  Zap,
  ArrowLeft,
  Loader2,
  FileCode,
  Folder,
  Download,
  Eye,
  EyeOff,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Play,
  Sparkles,
  Webhook,
  BarChart3,
} from 'lucide-react';
import WorkspaceFileBrowser, { type WorkspaceFile } from '@/components/WorkspaceFileBrowser';
import APIDocumentationPanel from '@/components/APIDocumentationPanel';
import { ApiKeyManager } from '@/components/ApiKeyManager';
import { WebhookManager } from '@/components/WebhookManager';
import { UsageAnalytics } from '@/components/UsageAnalytics';
import { ProviderKeyManager } from '@/components/ProviderKeyManager';

// Types
interface Workspace {
  id: string;
  name: string;
  description: string;
  template: string;
  status: 'active' | 'building' | 'completed' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  tokensUsed: number;
  filesGenerated: number;
}

interface APIKey {
  id: string;
  provider: string;
  name: string;
  maskedKey: string;
  lastUsed: Date | null;
  status: 'active' | 'expired' | 'revoked';
}

type DashboardTab = 'overview' | 'files' | 'api-keys' | 'provider-keys' | 'webhooks' | 'usage' | 'docs' | 'deploy' | 'settings';

// Dashboard content component (uses searchParams)
function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get('workspace');

  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [filesLoading, setFilesLoading] = useState(false);

  // Mock workspace files - in production, fetch from API
  const workspaceFiles: WorkspaceFile[] = useMemo(() => workspace ? [
    {
      id: 'root',
      name: workspace.name,
      path: '/',
      type: 'folder' as const,
      children: [
        {
          id: 'src',
          name: 'src',
          path: '/src',
          type: 'folder' as const,
          children: [
            {
              id: 'app',
              name: 'app',
              path: '/src/app',
              type: 'folder' as const,
              children: [
                {
                  id: 'page',
                  name: 'page.tsx',
                  path: '/src/app/page.tsx',
                  type: 'file' as const,
                  status: 'created' as const,
                  size: 2450,
                  content: `'use client';

import { useState } from 'react';

export default function HomePage() {
  const [count, setCount] = useState(0);

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 to-purple-900 p-8">
      <h1 className="text-4xl font-bold text-white mb-4">
        Welcome to ${workspace.name}
      </h1>
      <p className="text-gray-300 mb-8">
        ${workspace.description}
      </p>
      <button
        onClick={() => setCount(c => c + 1)}
        className="px-4 py-2 bg-purple-600 text-white rounded-lg"
      >
        Count: {count}
      </button>
    </main>
  );
}`,
                },
                {
                  id: 'layout',
                  name: 'layout.tsx',
                  path: '/src/app/layout.tsx',
                  type: 'file' as const,
                  status: 'created' as const,
                  size: 890,
                  content: `import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '${workspace.name}',
  description: '${workspace.description}',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}`,
                },
                {
                  id: 'globals',
                  name: 'globals.css',
                  path: '/src/app/globals.css',
                  type: 'file' as const,
                  status: 'created' as const,
                  size: 320,
                  content: `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 255, 255, 255;
  --background-start-rgb: 17, 24, 39;
  --background-end-rgb: 88, 28, 135;
}

body {
  color: rgb(var(--foreground-rgb));
  background: linear-gradient(
    to bottom right,
    rgb(var(--background-start-rgb)),
    rgb(var(--background-end-rgb))
  );
}`,
                },
              ],
            },
            {
              id: 'components',
              name: 'components',
              path: '/src/components',
              type: 'folder' as const,
              children: [
                {
                  id: 'button',
                  name: 'Button.tsx',
                  path: '/src/components/Button.tsx',
                  type: 'file' as const,
                  status: 'created' as const,
                  size: 1200,
                  content: `interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export default function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
}: ButtonProps) {
  const baseStyles = 'font-medium rounded-lg transition-colors';

  const variantStyles = {
    primary: 'bg-purple-600 text-white hover:bg-purple-500',
    secondary: 'bg-gray-600 text-white hover:bg-gray-500',
    outline: 'border border-purple-500 text-purple-400 hover:bg-purple-500/10',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={\`\${baseStyles} \${variantStyles[variant]} \${sizeStyles[size]} \${disabled ? 'opacity-50 cursor-not-allowed' : ''}\`}
    >
      {children}
    </button>
  );
}`,
                },
              ],
            },
            {
              id: 'lib',
              name: 'lib',
              path: '/src/lib',
              type: 'folder' as const,
              children: [
                {
                  id: 'utils',
                  name: 'utils.ts',
                  path: '/src/lib/utils.ts',
                  type: 'file' as const,
                  status: 'created' as const,
                  size: 450,
                  content: `import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}`,
                },
              ],
            },
          ],
        },
        {
          id: 'package',
          name: 'package.json',
          path: '/package.json',
          type: 'file' as const,
          status: 'created' as const,
          size: 1850,
          content: `{
  "name": "${workspace.name}",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.0.4",
    "react": "^18",
    "react-dom": "^18",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.2.0"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "autoprefixer": "^10.0.1",
    "postcss": "^8",
    "tailwindcss": "^3.3.0",
    "eslint": "^8",
    "eslint-config-next": "14.0.4"
  }
}`,
        },
        {
          id: 'tsconfig',
          name: 'tsconfig.json',
          path: '/tsconfig.json',
          type: 'file' as const,
          status: 'created' as const,
          size: 680,
          content: `{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}`,
        },
        {
          id: 'tailwind',
          name: 'tailwind.config.ts',
          path: '/tailwind.config.ts',
          type: 'file' as const,
          status: 'created' as const,
          size: 420,
          content: `import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;`,
        },
        {
          id: 'readme',
          name: 'README.md',
          path: '/README.md',
          type: 'file' as const,
          status: 'created' as const,
          size: 1200,
          content: `# ${workspace.name}

${workspace.description}

## Getting Started

First, install dependencies:

\`\`\`bash
npm install
\`\`\`

Then, run the development server:

\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Built With

- [Next.js](https://nextjs.org/) - React framework
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [TypeScript](https://www.typescriptlang.org/) - Type safety

## Generated by InfinityAssistant

This project was generated by InfinityAssistant Builder.`,
        },
        {
          id: 'env',
          name: '.env.example',
          path: '/.env.example',
          type: 'file' as const,
          status: 'created' as const,
          size: 180,
          content: `# Database
DATABASE_URL=your_database_url_here

# Authentication
NEXTAUTH_SECRET=your_secret_here
NEXTAUTH_URL=http://localhost:3000

# API Keys
OPENAI_API_KEY=your_api_key_here`,
        },
      ],
    },
  ] : [], [workspace]);

  useEffect(() => {
    setMounted(true);
    // Simulate loading workspace data
    setTimeout(() => {
      // Mock data - in production, fetch from API
      setWorkspaces([
        {
          id: 'ws-1',
          name: 'my-saas-app',
          description: 'SaaS application with auth and payments',
          template: 'saas-starter',
          status: 'completed',
          createdAt: new Date(Date.now() - 86400000),
          updatedAt: new Date(),
          tokensUsed: 2450,
          filesGenerated: 24,
        },
        {
          id: 'ws-2',
          name: 'api-backend',
          description: 'REST API with database',
          template: 'api-starter',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
          tokensUsed: 890,
          filesGenerated: 12,
        },
      ]);

      setApiKeys([
        {
          id: 'key-1',
          provider: 'Anthropic',
          name: 'Production Key',
          maskedKey: 'sk-ant-***...***4f2d',
          lastUsed: new Date(),
          status: 'active',
        },
        {
          id: 'key-2',
          provider: 'OpenAI',
          name: 'Development Key',
          maskedKey: 'sk-***...***8e3a',
          lastUsed: new Date(Date.now() - 3600000),
          status: 'active',
        },
        {
          id: 'key-3',
          provider: 'Supabase',
          name: 'Database Key',
          maskedKey: 'eyJ***...***zI1',
          lastUsed: null,
          status: 'active',
        },
      ]);

      if (workspaceId) {
        setWorkspace({
          id: workspaceId,
          name: 'my-saas-app',
          description: 'SaaS application with auth and payments',
          template: 'saas-starter',
          status: 'completed',
          createdAt: new Date(Date.now() - 86400000),
          updatedAt: new Date(),
          tokensUsed: 2450,
          filesGenerated: 24,
        });
      }

      setLoading(false);
    }, 500);
  }, [workspaceId]);

  const copyToClipboard = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleKeyVisibility = (keyId: string) => {
    setShowKeys(prev => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const tabs: { id: DashboardTab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'files', label: 'Files', icon: FolderOpen },
    { id: 'api-keys', label: 'API Keys', icon: Key },
    { id: 'provider-keys', label: 'LLM Providers', icon: Key },
    { id: 'webhooks', label: 'Webhooks', icon: Webhook },
    { id: 'usage', label: 'Usage', icon: BarChart3 },
    { id: 'docs', label: 'Documentation', icon: Book },
    { id: 'deploy', label: 'Deploy', icon: Rocket },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-purple-500/20 bg-black/40 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 text-gray-400 hover:text-purple-400 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm">Home</span>
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Terminal className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Developer Dashboard</h1>
                  <p className="text-xs text-gray-400">
                    {workspace ? workspace.name : 'Manage your workspaces'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/builder')}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                New Build
              </button>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-sm">
                    Sign In
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-64 border-r border-gray-800 bg-gray-900/50 p-4">
          {/* Workspace Selector */}
          <div className="mb-6">
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
              Workspace
            </label>
            <select
              aria-label="Select workspace"
              value={workspace?.id || ''}
              onChange={(e) => {
                if (e.target.value) {
                  router.push(`/dashboard?workspace=${e.target.value}`);
                } else {
                  router.push('/dashboard');
                }
              }}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Workspaces</option>
              {workspaces.map(ws => (
                <option key={ws.id} value={ws.id}>{ws.name}</option>
              ))}
            </select>
          </div>

          {/* Navigation */}
          <nav className="space-y-1">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Quick Stats */}
          <div className="mt-8 pt-6 border-t border-gray-800">
            <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Total Builds</span>
                <span className="text-white font-medium">{workspaces.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Tokens Used</span>
                <span className="text-white font-medium">
                  {workspaces.reduce((acc, ws) => acc + ws.tokensUsed, 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Active Keys</span>
                <span className="text-white font-medium">
                  {apiKeys.filter(k => k.status === 'active').length}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-2xl font-bold text-white">Overview</h2>

              {/* Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">System Status</p>
                      <p className="text-lg font-bold text-white">All Systems Go</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">API Calls Today</p>
                      <p className="text-lg font-bold text-white">127</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Last Build</p>
                      <p className="text-lg font-bold text-white">2 hours ago</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Workspaces */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Recent Workspaces</h3>
                  <button className="text-sm text-purple-400 hover:text-purple-300">
                    View All
                  </button>
                </div>
                <div className="space-y-3">
                  {workspaces.map(ws => (
                    <div
                      key={ws.id}
                      className="p-4 bg-gray-800/50 rounded-xl border border-gray-700 hover:border-purple-500/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/dashboard?workspace=${ws.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                            <Code className="w-5 h-5 text-purple-400" />
                          </div>
                          <div>
                            <h4 className="font-medium text-white">{ws.name}</h4>
                            <p className="text-sm text-gray-400">{ws.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            ws.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                            ws.status === 'active' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {ws.status}
                          </span>
                          <ChevronRight className="w-5 h-5 text-gray-500" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    onClick={() => router.push('/builder')}
                    className="p-4 bg-gray-800/50 rounded-xl border border-gray-700 hover:border-purple-500/50 transition-all hover:scale-[1.02] text-left"
                  >
                    <Plus className="w-6 h-6 text-purple-400 mb-2" />
                    <p className="font-medium text-white">New Build</p>
                    <p className="text-xs text-gray-400">Start a new project</p>
                  </button>
                  <button
                    onClick={() => setActiveTab('api-keys')}
                    className="p-4 bg-gray-800/50 rounded-xl border border-gray-700 hover:border-purple-500/50 transition-all hover:scale-[1.02] text-left"
                  >
                    <Key className="w-6 h-6 text-blue-400 mb-2" />
                    <p className="font-medium text-white">Manage Keys</p>
                    <p className="text-xs text-gray-400">API credentials</p>
                  </button>
                  <button
                    onClick={() => setActiveTab('docs')}
                    className="p-4 bg-gray-800/50 rounded-xl border border-gray-700 hover:border-purple-500/50 transition-all hover:scale-[1.02] text-left"
                  >
                    <Book className="w-6 h-6 text-green-400 mb-2" />
                    <p className="font-medium text-white">Documentation</p>
                    <p className="text-xs text-gray-400">Guides & API docs</p>
                  </button>
                  <button
                    onClick={() => setActiveTab('deploy')}
                    className="p-4 bg-gray-800/50 rounded-xl border border-gray-700 hover:border-purple-500/50 transition-all hover:scale-[1.02] text-left"
                  >
                    <Rocket className="w-6 h-6 text-orange-400 mb-2" />
                    <p className="font-medium text-white">Deploy</p>
                    <p className="text-xs text-gray-400">Ship to production</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Files Tab */}
          {activeTab === 'files' && (
            <div className="space-y-6 animate-fade-in h-full">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Generated Files</h2>
                <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors text-sm">
                  <Download className="w-4 h-4" />
                  Download All
                </button>
              </div>

              {workspace ? (
                <WorkspaceFileBrowser
                  files={workspaceFiles}
                  workspaceId={workspace.id}
                  onRefresh={() => {
                    setFilesLoading(true);
                    setTimeout(() => setFilesLoading(false), 1000);
                  }}
                  isLoading={filesLoading}
                  className="h-[calc(100vh-280px)]"
                />
              ) : (
                <div className="p-12 bg-gray-800/50 rounded-xl border border-gray-700 text-center">
                  <FolderOpen className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">Select a Workspace</h3>
                  <p className="text-gray-400 text-sm">Choose a workspace to view generated files</p>
                </div>
              )}
            </div>
          )}

          {/* API Keys Tab */}
          {activeTab === 'api-keys' && (
            <div className="space-y-6 animate-fade-in">
              <ApiKeyManager />
            </div>
          )}

          {/* Provider Keys Tab */}
          {activeTab === 'provider-keys' && (
            <div className="space-y-6 animate-fade-in">
              <ProviderKeyManager />
            </div>
          )}

          {/* Webhooks Tab */}
          {activeTab === 'webhooks' && (
            <div className="space-y-6 animate-fade-in">
              <WebhookManager />
            </div>
          )}

          {/* Usage Analytics Tab */}
          {activeTab === 'usage' && (
            <div className="space-y-6 animate-fade-in">
              <UsageAnalytics />
            </div>
          )}

          {/* Documentation Tab */}
          {activeTab === 'docs' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">API Documentation</h2>
                <a
                  href="https://docs.infinityassistant.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-sm text-gray-300"
                >
                  <Book className="w-4 h-4" />
                  Full Docs
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Quick Start */}
              <div className="p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/30">
                <div className="flex items-center gap-3 mb-4">
                  <Sparkles className="w-6 h-6 text-purple-400" />
                  <h3 className="text-lg font-semibold text-white">Quick Start Guide</h3>
                </div>
                <ol className="space-y-3 text-gray-300">
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-sm text-purple-400 shrink-0">1</span>
                    <span>Configure your API keys in the API Keys tab</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-sm text-purple-400 shrink-0">2</span>
                    <span>Create a new build or select an existing workspace</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-sm text-purple-400 shrink-0">3</span>
                    <span>Download your generated files and deploy</span>
                  </li>
                </ol>
              </div>

              {/* API Documentation Panel */}
              <APIDocumentationPanel
                apiKey={apiKeys.find(k => k.provider === 'InfinityAssistant')?.maskedKey}
                baseUrl="https://api.infinityassistant.dev"
              />
            </div>
          )}

          {/* Deploy Tab */}
          {activeTab === 'deploy' && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-2xl font-bold text-white">Deploy</h2>

              {workspace ? (
                <div className="space-y-4">
                  {/* Deployment Options */}
                  {[
                    { name: 'Vercel', icon: '▲', desc: 'Deploy to Vercel with one click', status: 'ready' },
                    { name: 'Railway', icon: '🚂', desc: 'Deploy to Railway infrastructure', status: 'ready' },
                    { name: 'GitHub', icon: '🐙', desc: 'Push to GitHub repository', status: 'ready' },
                    { name: 'Docker', icon: '🐳', desc: 'Deploy with Docker container', status: 'ready' },
                  ].map((platform, idx) => (
                    <div key={idx} className="p-4 bg-gray-800/50 rounded-xl border border-gray-700 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gray-700 flex items-center justify-center text-2xl">
                          {platform.icon}
                        </div>
                        <div>
                          <h4 className="font-medium text-white">{platform.name}</h4>
                          <p className="text-sm text-gray-400">{platform.desc}</p>
                        </div>
                      </div>
                      {platform.status === 'ready' ? (
                        <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors text-sm">
                          <Play className="w-4 h-4" />
                          Deploy
                        </button>
                      ) : (
                        <span className="px-3 py-1 bg-gray-700 rounded-full text-xs text-gray-400">
                          Coming Soon
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 bg-gray-800/50 rounded-xl border border-gray-700 text-center">
                  <Rocket className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">Select a Workspace</h3>
                  <p className="text-gray-400 text-sm">Choose a workspace to deploy</p>
                </div>
              )}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-2xl font-bold text-white">Settings</h2>

              <div className="space-y-6">
                {/* Developer Preferences */}
                <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700">
                  <h3 className="text-lg font-semibold text-white mb-4">Developer Preferences</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white">Auto-save generated files</p>
                        <p className="text-sm text-gray-400">Automatically save files to your workspace</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked="true"
                        aria-label="Toggle auto-save generated files"
                        className="w-12 h-6 rounded-full bg-purple-600 relative"
                      >
                        <span className="absolute right-1 top-1 w-4 h-4 rounded-full bg-white" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white">Git auto-commit</p>
                        <p className="text-sm text-gray-400">Automatically commit changes to git</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked="false"
                        aria-label="Toggle git auto-commit"
                        className="w-12 h-6 rounded-full bg-gray-600 relative"
                      >
                        <span className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white">Show terminal output</p>
                        <p className="text-sm text-gray-400">Display real-time terminal logs</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked="true"
                        aria-label="Toggle terminal output display"
                        className="w-12 h-6 rounded-full bg-purple-600 relative"
                      >
                        <span className="absolute right-1 top-1 w-4 h-4 rounded-full bg-white" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="p-6 bg-red-500/5 rounded-xl border border-red-500/20">
                  <h3 className="text-lg font-semibold text-red-400 mb-4">Danger Zone</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white">Delete all workspaces</p>
                      <p className="text-sm text-gray-400">Permanently delete all workspaces and files</p>
                    </div>
                    <button className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors text-sm">
                      Delete All
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// Main component with Suspense boundary
export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
