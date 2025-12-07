/**
 * Knowledge Analytics Dashboard
 * 
 * Admin dashboard for viewing knowledge collection and tracking analytics
 * Shows data from both professional (jobs) and companion (interests) modes
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { 
  Loader2, Shield, TrendingUp, AlertTriangle, 
  Briefcase, Heart, Search, Lightbulb, CheckCircle,
  ArrowLeft, Download, RefreshCw
} from 'lucide-react';

interface AnalyticsData {
  summary: {
    totalQueries: number;
    totalKnowledgeGaps: number;
    totalExperimentalKnowledge: number;
    totalCanonicalKnowledge: number;
  };
  professional: any;
  companion: any;
  topCategories: any[];
  knowledgeGaps: any[];
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export default function KnowledgeAnalyticsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [mode, setMode] = useState<'all' | 'professional' | 'companion'>('all');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (authorized) {
      fetchAnalytics();
    }
  }, [authorized, mode]);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/email');
      const data = await response.json();

      if (!data.authenticated || data.user?.tier !== 'master') {
        setError('Master access required');
        setLoading(false);
        return;
      }

      setAuthorized(true);
    } catch (err) {
      setError('Failed to verify authorization');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`/api/analytics/knowledge?mode=${mode}`);
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
        setLastRefresh(new Date());
      } else {
        setError('Failed to load analytics data');
      }
    } catch (err) {
      setError('Failed to fetch analytics');
    }
  };

  const exportData = () => {
    if (!data) return;
    
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `knowledge-analytics-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          <p className="text-gray-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !authorized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="max-w-md p-8 bg-gray-900 rounded-xl border border-gray-800 text-center">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h1 className="text-xl font-semibold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400 mb-6">{error || 'You do not have permission to access this area.'}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <p className="text-gray-400">No data available</p>
      </div>
    );
  }

  // Prepare chart data
  const topCategoriesData = data.topCategories.slice(0, 10).map((cat: any) => ({
    name: cat.displayName,
    queries: cat.totalQueries,
    gaps: cat.knowledgeGaps,
    experimental: cat.experimentalKnowledge,
    canonical: cat.canonicalKnowledge
  }));

  const knowledgeGapData = data.knowledgeGaps.slice(0, 10).map((gap: any) => ({
    name: gap.displayName,
    gaps: gap.knowledgeGaps,
    ratio: (gap.gapRatio * 100).toFixed(1),
    priority: gap.priority
  }));

  const modeDistribution = [
    {
      name: 'Professional',
      value: data.professional?.summary.totalQueries || 0,
      color: '#8b5cf6'
    },
    {
      name: 'Companion',
      value: data.companion?.summary.totalQueries || 0,
      color: '#ec4899'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gradient-to-r from-gray-900 to-gray-950">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/admin/master')}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <Shield className="w-6 h-6 text-purple-400" />
              <h1 className="text-2xl font-bold">Knowledge Analytics</h1>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">All Modes</option>
                <option value="professional">Professional</option>
                <option value="companion">Companion</option>
              </select>
              <button
                onClick={fetchAnalytics}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={exportData}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                title="Export Data"
              >
                <Download className="w-5 h-5" />
              </button>
              <span className="text-xs text-gray-500">
                Updated: {lastRefresh.toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <Search className="w-5 h-5 text-blue-400" />
              <span className="text-2xl font-bold">{data.summary.totalQueries.toLocaleString()}</span>
            </div>
            <p className="text-sm text-gray-400">Total Queries</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <span className="text-2xl font-bold">{data.summary.totalKnowledgeGaps.toLocaleString()}</span>
            </div>
            <p className="text-sm text-gray-400">Knowledge Gaps</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <Lightbulb className="w-5 h-5 text-purple-400" />
              <span className="text-2xl font-bold">{data.summary.totalExperimentalKnowledge.toLocaleString()}</span>
            </div>
            <p className="text-sm text-gray-400">Experimental Knowledge</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-2xl font-bold">{data.summary.totalCanonicalKnowledge.toLocaleString()}</span>
            </div>
            <p className="text-sm text-gray-400">Canonical Knowledge</p>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Categories */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Top Categories by Queries</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topCategoriesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                />
                <YAxis tick={{ fill: '#9ca3af' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                />
                <Legend />
                <Bar dataKey="queries" fill="#8b5cf6" name="Total Queries" />
                <Bar dataKey="gaps" fill="#f59e0b" name="Knowledge Gaps" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Mode Distribution */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Mode Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={modeDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {modeDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Knowledge Gaps */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Top Knowledge Gaps (Priority)</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left p-3 text-sm font-semibold text-gray-400">Category</th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-400">Type</th>
                  <th className="text-right p-3 text-sm font-semibold text-gray-400">Total Queries</th>
                  <th className="text-right p-3 text-sm font-semibold text-gray-400">Gaps</th>
                  <th className="text-right p-3 text-sm font-semibold text-gray-400">Gap Ratio</th>
                  <th className="text-center p-3 text-sm font-semibold text-gray-400">Priority</th>
                </tr>
              </thead>
              <tbody>
                {data.knowledgeGaps.slice(0, 15).map((gap: any, idx: number) => (
                  <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-800/50">
                    <td className="p-3">{gap.displayName}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                        gap.type === 'professional' 
                          ? 'bg-purple-500/20 text-purple-300' 
                          : 'bg-pink-500/20 text-pink-300'
                      }`}>
                        {gap.type === 'professional' ? <Briefcase className="w-3 h-3" /> : <Heart className="w-3 h-3" />}
                        {gap.type}
                      </span>
                    </td>
                    <td className="p-3 text-right">{gap.totalQueries.toLocaleString()}</td>
                    <td className="p-3 text-right">{gap.knowledgeGaps.toLocaleString()}</td>
                    <td className="p-3 text-right">{(gap.gapRatio * 100).toFixed(1)}%</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        gap.priority === 'high' 
                          ? 'bg-red-500/20 text-red-300' 
                          : gap.priority === 'medium'
                          ? 'bg-yellow-500/20 text-yellow-300'
                          : 'bg-gray-500/20 text-gray-300'
                      }`}>
                        {gap.priority}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Professional Details */}
        {data.professional && (mode === 'all' || mode === 'professional') && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-semibold">Professional Mode Analytics</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-400">Total Queries</p>
                <p className="text-2xl font-bold">{data.professional.summary.totalQueries.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Knowledge Gaps</p>
                <p className="text-2xl font-bold">{data.professional.summary.totalKnowledgeGaps.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Experimental</p>
                <p className="text-2xl font-bold">{data.professional.summary.totalExperimentalKnowledge.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Canonical</p>
                <p className="text-2xl font-bold">{data.professional.summary.totalCanonicalKnowledge.toLocaleString()}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left p-2 text-gray-400">Category</th>
                    <th className="text-right p-2 text-gray-400">Queries</th>
                    <th className="text-right p-2 text-gray-400">Gaps</th>
                    <th className="text-right p-2 text-gray-400">Experimental</th>
                    <th className="text-right p-2 text-gray-400">Canonical</th>
                  </tr>
                </thead>
                <tbody>
                  {data.professional.topCategories.slice(0, 10).map((cat: any, idx: number) => (
                    <tr key={idx} className="border-b border-gray-800/50">
                      <td className="p-2">{cat.displayName}</td>
                      <td className="p-2 text-right">{cat.totalQueries.toLocaleString()}</td>
                      <td className="p-2 text-right">{cat.knowledgeGaps.toLocaleString()}</td>
                      <td className="p-2 text-right">{cat.experimentalKnowledge.toLocaleString()}</td>
                      <td className="p-2 text-right">{cat.canonicalKnowledge.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Companion Details */}
        {data.companion && (mode === 'all' || mode === 'companion') && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Heart className="w-5 h-5 text-pink-400" />
              <h2 className="text-lg font-semibold">Companion Mode Analytics</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-400">Total Queries</p>
                <p className="text-2xl font-bold">{data.companion.summary.totalQueries.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Knowledge Gaps</p>
                <p className="text-2xl font-bold">{data.companion.summary.totalKnowledgeGaps.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Experimental</p>
                <p className="text-2xl font-bold">{data.companion.summary.totalExperimentalKnowledge.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Canonical</p>
                <p className="text-2xl font-bold">{data.companion.summary.totalCanonicalKnowledge.toLocaleString()}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left p-2 text-gray-400">Interest</th>
                    <th className="text-right p-2 text-gray-400">Queries</th>
                    <th className="text-right p-2 text-gray-400">Gaps</th>
                    <th className="text-right p-2 text-gray-400">Experimental</th>
                    <th className="text-right p-2 text-gray-400">Canonical</th>
                  </tr>
                </thead>
                <tbody>
                  {data.companion.topInterests.slice(0, 10).map((interest: any, idx: number) => (
                    <tr key={idx} className="border-b border-gray-800/50">
                      <td className="p-2">{interest.displayName}</td>
                      <td className="p-2 text-right">{interest.totalQueries.toLocaleString()}</td>
                      <td className="p-2 text-right">{interest.knowledgeGaps.toLocaleString()}</td>
                      <td className="p-2 text-right">{interest.experimentalKnowledge.toLocaleString()}</td>
                      <td className="p-2 text-right">{interest.canonicalKnowledge.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

