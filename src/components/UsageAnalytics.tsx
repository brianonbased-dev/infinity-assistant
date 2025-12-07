/**
 * Usage Analytics Component
 * 
 * Visual dashboard for user usage analytics
 */

'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  Zap,
  Calendar,
  Loader2,
  AlertCircle,
  Download,
  Upload,
} from 'lucide-react';

interface UsageDataPoint {
  date: string;
  requests: number;
  tokens: number;
  cost: number;
}

interface UsageAnalytics {
  summary: {
    today: { requests: number; tokens: number; cost: number };
    thisWeek: { requests: number; tokens: number; cost: number };
    thisMonth: { requests: number; tokens: number; cost: number };
    allTime: { requests: number; tokens: number; cost: number };
  };
  trends: {
    daily: UsageDataPoint[];
    weekly: UsageDataPoint[];
    monthly: UsageDataPoint[];
  };
  predictions: {
    estimatedMonthlyCost: number;
    projectedUsage: { requests: number; tokens: number };
  };
}

export function UsageAnalytics() {
  const [analytics, setAnalytics] = useState<UsageAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/analytics/usage');
      const data = await response.json();

      if (data.success) {
        setAnalytics(data.analytics);
      } else {
        setError(data.error || 'Failed to load analytics');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
    return num.toFixed(0);
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string, range: string): string => {
    const date = new Date(dateStr);
    if (range === 'daily') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (range === 'weekly') {
      return `Week ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
  };

  const exportUsageData = async (format: 'json' | 'csv') => {
    try {
      const response = await fetch(`/api/export/usage?format=${format}`);
      
      if (format === 'csv') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `usage-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `usage-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to export usage data:', error);
      alert('Failed to export usage data');
    }
  };

  const importUsageData = async (file: File, format: 'json' | 'csv') => {
    try {
      setImporting(true);
      setImportError(null);
      setImportSuccess(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('format', format);

      const response = await fetch('/api/import/usage', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setImportSuccess(`Successfully imported ${data.imported} records${data.errors > 0 ? ` (${data.errors} failed)` : ''}`);
        // Refresh analytics
        await fetchAnalytics();
        // Clear success message after 5 seconds
        setTimeout(() => setImportSuccess(null), 5000);
      } else {
        setImportError(data.error || 'Failed to import usage data');
      }
    } catch (error: any) {
      setImportError(error.message || 'Failed to import usage data');
    } finally {
      setImporting(false);
    }
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const format = fileName.endsWith('.csv') ? 'csv' : 'json';
    
    importUsageData(file, format);
    
    // Reset input
    event.target.value = '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-xl">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  const currentTrend = analytics.trends[timeRange];
  const summary = analytics.summary;

  return (
    <div className="space-y-6">
      {/* Import Status Messages */}
      {importError && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span>{importError}</span>
            </div>
            <button
              onClick={() => setImportError(null)}
              className="text-red-400 hover:text-red-300"
            >
              ×
            </button>
          </div>
        </div>
      )}
      {importSuccess && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-400">
              <Activity className="w-5 h-5" />
              <span>{importSuccess}</span>
            </div>
            <button
              onClick={() => setImportSuccess(null)}
              className="text-green-400 hover:text-green-300"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Usage Analytics</h2>
          <p className="text-sm text-gray-400 mt-1">
            Track your API usage, tokens, and costs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors text-sm cursor-pointer">
            <Upload className="w-4 h-4" />
            Import
            <input
              type="file"
              accept=".csv,.json"
              onChange={handleFileImport}
              className="hidden"
              disabled={importing}
            />
          </label>
          <button
            onClick={() => exportUsageData('csv')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors text-sm"
            title="Export to CSV"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => exportUsageData('json')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors text-sm"
            title="Export to JSON"
          >
            <Download className="w-4 h-4" />
            Export JSON
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTimeRange('daily')}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              timeRange === 'daily'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Daily
          </button>
          <button
            onClick={() => setTimeRange('weekly')}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              timeRange === 'weekly'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setTimeRange('monthly')}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              timeRange === 'monthly'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Today</span>
            <Calendar className="w-4 h-4 text-gray-500" />
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-white">
              {formatNumber(summary.today.requests)} requests
            </div>
            <div className="text-sm text-gray-400">
              {formatNumber(summary.today.tokens)} tokens
            </div>
            <div className="text-sm text-purple-400">
              {formatCurrency(summary.today.cost)}
            </div>
          </div>
        </div>

        {/* This Week */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">This Week</span>
            <Activity className="w-4 h-4 text-gray-500" />
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-white">
              {formatNumber(summary.thisWeek.requests)} requests
            </div>
            <div className="text-sm text-gray-400">
              {formatNumber(summary.thisWeek.tokens)} tokens
            </div>
            <div className="text-sm text-purple-400">
              {formatCurrency(summary.thisWeek.cost)}
            </div>
          </div>
        </div>

        {/* This Month */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">This Month</span>
            <TrendingUp className="w-4 h-4 text-gray-500" />
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-white">
              {formatNumber(summary.thisMonth.requests)} requests
            </div>
            <div className="text-sm text-gray-400">
              {formatNumber(summary.thisMonth.tokens)} tokens
            </div>
            <div className="text-sm text-purple-400">
              {formatCurrency(summary.thisMonth.cost)}
            </div>
          </div>
        </div>

        {/* All Time */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">All Time</span>
            <Zap className="w-4 h-4 text-gray-500" />
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-white">
              {formatNumber(summary.allTime.requests)} requests
            </div>
            <div className="text-sm text-gray-400">
              {formatNumber(summary.allTime.tokens)} tokens
            </div>
            <div className="text-sm text-purple-400">
              {formatCurrency(summary.allTime.cost)}
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Usage Trends */}
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">
            Usage Trends ({timeRange === 'daily' ? 'Last 30 Days' : timeRange === 'weekly' ? 'Last 12 Weeks' : 'Last 12 Months'})
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={currentTrend}>
              <defs>
                <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#9333ea" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#9333ea" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="date"
                tickFormatter={(date) => formatDate(date, timeRange)}
                stroke="#9ca3af"
                fontSize={12}
              />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
                labelFormatter={(date) => formatDate(date, timeRange)}
                formatter={(value: number, name: string) => {
                  if (name === 'requests') return [formatNumber(value), 'Requests'];
                  if (name === 'tokens') return [formatNumber(value), 'Tokens'];
                  return [value, name];
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="requests"
                stroke="#9333ea"
                fillOpacity={1}
                fill="url(#colorRequests)"
                name="Requests"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Token Usage */}
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Token Usage</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={currentTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="date"
                tickFormatter={(date) => formatDate(date, timeRange)}
                stroke="#9ca3af"
                fontSize={12}
              />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
                labelFormatter={(date) => formatDate(date, timeRange)}
                formatter={(value: number) => formatNumber(value)}
              />
              <Bar dataKey="tokens" fill="#9333ea" name="Tokens" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cost Analysis */}
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Cost Analysis</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={currentTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              tickFormatter={(date) => formatDate(date, timeRange)}
              stroke="#9ca3af"
              fontSize={12}
            />
            <YAxis
              stroke="#9ca3af"
              fontSize={12}
              tickFormatter={(value) => formatCurrency(value)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
              }}
              labelFormatter={(date) => formatDate(date, timeRange)}
              formatter={(value: number) => formatCurrency(value)}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="cost"
              stroke="#10b981"
              strokeWidth={2}
              name="Cost"
              dot={{ fill: '#10b981', r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Predictions */}
      <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-xl p-6 border border-purple-500/30">
        <div className="flex items-center gap-3 mb-4">
          <DollarSign className="w-6 h-6 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Monthly Projection</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-gray-400 mb-1">Estimated Monthly Cost</div>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(analytics.predictions.estimatedMonthlyCost)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">Projected Requests</div>
            <div className="text-2xl font-bold text-white">
              {formatNumber(analytics.predictions.projectedUsage.requests)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">Projected Tokens</div>
            <div className="text-2xl font-bold text-white">
              {formatNumber(analytics.predictions.projectedUsage.tokens)}
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          Based on current usage patterns. Actual costs may vary.
        </p>
      </div>
    </div>
  );
}

