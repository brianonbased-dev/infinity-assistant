/**
 * Analytics Dashboard Service
 *
 * Provides comprehensive analytics including build metrics, user engagement,
 * cost tracking, performance monitoring, and business intelligence.
 */

// ============================================================================
// Types
// ============================================================================

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  widgets: DashboardWidget[];
  layout: DashboardLayout;
  filters: DashboardFilter[];
  refreshInterval?: number; // seconds
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  dataSource: DataSource;
  config: WidgetConfig;
  position: { x: number; y: number; w: number; h: number };
}

export type WidgetType =
  | 'metric'
  | 'line-chart'
  | 'bar-chart'
  | 'pie-chart'
  | 'area-chart'
  | 'table'
  | 'heatmap'
  | 'funnel'
  | 'gauge'
  | 'map'
  | 'text';

export interface DataSource {
  type: 'builds' | 'users' | 'costs' | 'performance' | 'errors' | 'agents' | 'custom';
  query?: string;
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max';
  groupBy?: string;
  timeRange?: TimeRange;
  filters?: Record<string, unknown>;
}

export interface TimeRange {
  type: 'relative' | 'absolute';
  value?: string; // '7d', '30d', '1y', etc.
  start?: Date;
  end?: Date;
}

export interface WidgetConfig {
  colors?: string[];
  showLegend?: boolean;
  showLabels?: boolean;
  showGrid?: boolean;
  format?: string;
  threshold?: { warning: number; critical: number };
  comparison?: 'previous_period' | 'previous_year' | 'none';
  stacked?: boolean;
  showTrend?: boolean;
}

export interface DashboardLayout {
  columns: number;
  rowHeight: number;
  margin: [number, number];
}

export interface DashboardFilter {
  id: string;
  field: string;
  type: 'select' | 'date-range' | 'search' | 'multi-select';
  label: string;
  options?: { value: string; label: string }[];
  defaultValue?: unknown;
}

// Analytics data types
export interface AnalyticsEvent {
  id: string;
  type: EventType;
  userId?: string;
  projectId?: string;
  sessionId?: string;
  properties: Record<string, unknown>;
  timestamp: Date;
  source: string;
}

export type EventType =
  | 'page_view'
  | 'build_started'
  | 'build_completed'
  | 'build_failed'
  | 'deployment_started'
  | 'deployment_completed'
  | 'user_signup'
  | 'user_login'
  | 'subscription_created'
  | 'subscription_cancelled'
  | 'feature_used'
  | 'error_occurred'
  | 'agent_spawned'
  | 'agent_completed'
  | 'template_cloned'
  | 'api_called';

export interface BuildMetrics {
  totalBuilds: number;
  successfulBuilds: number;
  failedBuilds: number;
  averageDuration: number;
  buildsByDay: { date: string; count: number; success: number; failed: number }[];
  buildsByProject: { projectId: string; projectName: string; count: number }[];
  topErrors: { error: string; count: number }[];
}

export interface UserMetrics {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  churnedUsers: number;
  usersByPlan: { plan: string; count: number }[];
  userActivity: { date: string; dau: number; wau: number; mau: number }[];
  retentionCohorts: RetentionCohort[];
  topUsers: { userId: string; activity: number }[];
}

export interface RetentionCohort {
  cohort: string; // 'Jan 2024', etc.
  size: number;
  retention: number[]; // Percentage retained in weeks 1, 2, 3, etc.
}

export interface CostMetrics {
  totalCost: number;
  costByCategory: { category: string; amount: number }[];
  costByProject: { projectId: string; projectName: string; amount: number }[];
  costTrend: { date: string; amount: number }[];
  projectedCost: number;
  costPerBuild: number;
  costPerUser: number;
  budget: { allocated: number; used: number; remaining: number };
}

export interface PerformanceMetrics {
  averageResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  uptimePercentage: number;
  responseTimeByEndpoint: { endpoint: string; avg: number; p95: number; count: number }[];
  performanceTrend: { date: string; avgResponse: number; errorRate: number }[];
}

export interface AgentMetrics {
  totalAgentRuns: number;
  activeAgents: number;
  successRate: number;
  averageTaskDuration: number;
  agentsByType: { type: string; count: number; successRate: number }[];
  tasksByStatus: { status: string; count: number }[];
  agentPerformance: { agentId: string; name: string; runs: number; success: number; avgDuration: number }[];
}

export interface Report {
  id: string;
  name: string;
  type: ReportType;
  description?: string;
  schedule?: ReportSchedule;
  recipients: string[];
  format: 'pdf' | 'csv' | 'excel' | 'json';
  filters: Record<string, unknown>;
  lastGenerated?: Date;
  createdAt: Date;
}

export type ReportType = 'builds' | 'users' | 'costs' | 'performance' | 'agents' | 'executive' | 'custom';

export interface ReportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  time: string; // HH:MM
  timezone: string;
}

export interface Alert {
  id: string;
  name: string;
  condition: AlertCondition;
  severity: 'info' | 'warning' | 'critical';
  channels: AlertChannel[];
  isActive: boolean;
  lastTriggered?: Date;
  createdAt: Date;
}

export interface AlertCondition {
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  threshold: number;
  duration?: number; // seconds
  aggregation?: 'avg' | 'sum' | 'count' | 'max' | 'min';
}

export interface AlertChannel {
  type: 'email' | 'slack' | 'discord' | 'webhook';
  config: Record<string, string>;
}

// ============================================================================
// Data Store
// ============================================================================

class AnalyticsDataStore {
  private events: AnalyticsEvent[] = [];
  private builds: Map<string, BuildRecord> = new Map();
  private users: Map<string, UserRecord> = new Map();
  private costs: CostRecord[] = [];
  private requests: RequestRecord[] = [];
  private agents: Map<string, AgentRecord> = new Map();

  constructor() {
    this.seedSampleData();
  }

  private seedSampleData(): void {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    // Generate 90 days of sample build data
    for (let i = 0; i < 90; i++) {
      const date = new Date(now - i * day);
      const buildsPerDay = Math.floor(Math.random() * 50) + 20;

      for (let j = 0; j < buildsPerDay; j++) {
        const buildId = `build-${i}-${j}`;
        const success = Math.random() > 0.15;

        this.builds.set(buildId, {
          id: buildId,
          projectId: `project-${Math.floor(Math.random() * 10)}`,
          status: success ? 'success' : 'failed',
          duration: Math.floor(Math.random() * 300) + 30,
          error: success ? undefined : 'Build failed: ' + ['TypeScript error', 'Test failure', 'Lint error', 'Timeout'][Math.floor(Math.random() * 4)],
          timestamp: date
        });
      }
    }

    // Generate sample user data
    for (let i = 0; i < 500; i++) {
      const userId = `user-${i}`;
      const createdDaysAgo = Math.floor(Math.random() * 180);
      const plans = ['free', 'starter', 'growth', 'scale', 'enterprise'];

      this.users.set(userId, {
        id: userId,
        plan: plans[Math.floor(Math.random() * 5)],
        createdAt: new Date(now - createdDaysAgo * day),
        lastActive: new Date(now - Math.floor(Math.random() * 30) * day),
        totalBuilds: Math.floor(Math.random() * 100),
        isActive: Math.random() > 0.3
      });
    }

    // Generate sample cost data
    for (let i = 0; i < 90; i++) {
      const date = new Date(now - i * day);
      this.costs.push({
        date,
        compute: Math.random() * 50 + 20,
        storage: Math.random() * 10 + 5,
        bandwidth: Math.random() * 15 + 5,
        ai: Math.random() * 30 + 10,
        other: Math.random() * 5
      });
    }

    // Generate sample request data
    for (let i = 0; i < 1000; i++) {
      const endpoints = ['/api/builds', '/api/projects', '/api/users', '/api/deploy', '/api/templates'];
      this.requests.push({
        endpoint: endpoints[Math.floor(Math.random() * endpoints.length)],
        method: ['GET', 'POST', 'PUT', 'DELETE'][Math.floor(Math.random() * 4)],
        responseTime: Math.random() * 500 + 50,
        statusCode: Math.random() > 0.05 ? 200 : [400, 404, 500][Math.floor(Math.random() * 3)],
        timestamp: new Date(now - Math.random() * 7 * day)
      });
    }

    // Generate sample agent data
    const agentTypes = ['builder', 'tester', 'deployer', 'researcher', 'optimizer'];
    for (let i = 0; i < 20; i++) {
      const agentId = `agent-${i}`;
      this.agents.set(agentId, {
        id: agentId,
        type: agentTypes[Math.floor(Math.random() * agentTypes.length)],
        name: `Agent ${i}`,
        totalRuns: Math.floor(Math.random() * 200) + 10,
        successfulRuns: 0,
        averageDuration: Math.random() * 120 + 30,
        lastRun: new Date(now - Math.random() * 7 * day)
      });

      const agent = this.agents.get(agentId)!;
      agent.successfulRuns = Math.floor(agent.totalRuns * (0.7 + Math.random() * 0.25));
    }
  }

  trackEvent(event: Omit<AnalyticsEvent, 'id' | 'timestamp'>): AnalyticsEvent {
    const newEvent: AnalyticsEvent = {
      ...event,
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };
    this.events.push(newEvent);

    // Keep only last 100k events in memory
    if (this.events.length > 100000) {
      this.events = this.events.slice(-100000);
    }

    return newEvent;
  }

  getEvents(filters: { type?: EventType; userId?: string; projectId?: string; timeRange?: TimeRange }): AnalyticsEvent[] {
    let results = [...this.events];

    if (filters.type) {
      results = results.filter(e => e.type === filters.type);
    }

    if (filters.userId) {
      results = results.filter(e => e.userId === filters.userId);
    }

    if (filters.projectId) {
      results = results.filter(e => e.projectId === filters.projectId);
    }

    if (filters.timeRange) {
      const { start, end } = this.resolveTimeRange(filters.timeRange);
      results = results.filter(e => e.timestamp >= start && e.timestamp <= end);
    }

    return results;
  }

  getBuildMetrics(timeRange: TimeRange): BuildMetrics {
    const { start, end } = this.resolveTimeRange(timeRange);
    const builds = Array.from(this.builds.values()).filter(
      b => b.timestamp >= start && b.timestamp <= end
    );

    const successful = builds.filter(b => b.status === 'success');
    const failed = builds.filter(b => b.status === 'failed');

    // Group by day
    const byDay = new Map<string, { count: number; success: number; failed: number }>();
    for (const build of builds) {
      const day = build.timestamp.toISOString().split('T')[0];
      const existing = byDay.get(day) || { count: 0, success: 0, failed: 0 };
      existing.count++;
      if (build.status === 'success') existing.success++;
      else existing.failed++;
      byDay.set(day, existing);
    }

    // Group by project
    const byProject = new Map<string, number>();
    for (const build of builds) {
      byProject.set(build.projectId, (byProject.get(build.projectId) || 0) + 1);
    }

    // Count errors
    const errorCounts = new Map<string, number>();
    for (const build of failed) {
      if (build.error) {
        errorCounts.set(build.error, (errorCounts.get(build.error) || 0) + 1);
      }
    }

    return {
      totalBuilds: builds.length,
      successfulBuilds: successful.length,
      failedBuilds: failed.length,
      averageDuration: builds.length > 0
        ? builds.reduce((sum, b) => sum + b.duration, 0) / builds.length
        : 0,
      buildsByDay: Array.from(byDay.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      buildsByProject: Array.from(byProject.entries())
        .map(([projectId, count]) => ({ projectId, projectName: projectId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      topErrors: Array.from(errorCounts.entries())
        .map(([error, count]) => ({ error, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    };
  }

  getUserMetrics(timeRange: TimeRange): UserMetrics {
    const { start, end } = this.resolveTimeRange(timeRange);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const allUsers = Array.from(this.users.values());
    const usersInRange = allUsers.filter(u => u.createdAt >= start && u.createdAt <= end);
    const activeUsers = allUsers.filter(u => u.lastActive >= thirtyDaysAgo);
    const newUsers = allUsers.filter(u => u.createdAt >= start);
    const churnedUsers = allUsers.filter(u => !u.isActive && u.lastActive < thirtyDaysAgo);

    // Group by plan
    const byPlan = new Map<string, number>();
    for (const user of allUsers) {
      byPlan.set(user.plan, (byPlan.get(user.plan) || 0) + 1);
    }

    // Generate activity trend (mock)
    const activityTrend: { date: string; dau: number; wau: number; mau: number }[] = [];
    for (let i = 30; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      activityTrend.push({
        date: date.toISOString().split('T')[0],
        dau: Math.floor(Math.random() * 100) + 50,
        wau: Math.floor(Math.random() * 300) + 150,
        mau: Math.floor(Math.random() * 400) + 200
      });
    }

    // Mock retention cohorts
    const cohorts: RetentionCohort[] = [
      { cohort: 'Week 1', size: 100, retention: [100, 60, 45, 35, 30, 28, 25, 24] },
      { cohort: 'Week 2', size: 120, retention: [100, 65, 50, 40, 35, 32] },
      { cohort: 'Week 3', size: 90, retention: [100, 55, 42, 33] },
      { cohort: 'Week 4', size: 110, retention: [100, 62] }
    ];

    return {
      totalUsers: allUsers.length,
      activeUsers: activeUsers.length,
      newUsers: newUsers.length,
      churnedUsers: churnedUsers.length,
      usersByPlan: Array.from(byPlan.entries()).map(([plan, count]) => ({ plan, count })),
      userActivity: activityTrend,
      retentionCohorts: cohorts,
      topUsers: allUsers
        .sort((a, b) => b.totalBuilds - a.totalBuilds)
        .slice(0, 10)
        .map(u => ({ userId: u.id, activity: u.totalBuilds }))
    };
  }

  getCostMetrics(timeRange: TimeRange): CostMetrics {
    const { start, end } = this.resolveTimeRange(timeRange);
    const costsInRange = this.costs.filter(c => c.date >= start && c.date <= end);

    const totalCost = costsInRange.reduce(
      (sum, c) => sum + c.compute + c.storage + c.bandwidth + c.ai + c.other,
      0
    );

    const costByCategory = [
      { category: 'Compute', amount: costsInRange.reduce((s, c) => s + c.compute, 0) },
      { category: 'Storage', amount: costsInRange.reduce((s, c) => s + c.storage, 0) },
      { category: 'Bandwidth', amount: costsInRange.reduce((s, c) => s + c.bandwidth, 0) },
      { category: 'AI/ML', amount: costsInRange.reduce((s, c) => s + c.ai, 0) },
      { category: 'Other', amount: costsInRange.reduce((s, c) => s + c.other, 0) }
    ];

    const costTrend = costsInRange.map(c => ({
      date: c.date.toISOString().split('T')[0],
      amount: c.compute + c.storage + c.bandwidth + c.ai + c.other
    })).sort((a, b) => a.date.localeCompare(b.date));

    const daysInRange = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    const avgDailyCost = totalCost / daysInRange;
    const projectedCost = avgDailyCost * 30;

    const builds = Array.from(this.builds.values()).filter(
      b => b.timestamp >= start && b.timestamp <= end
    );

    const users = Array.from(this.users.values());

    return {
      totalCost,
      costByCategory,
      costByProject: [], // Would need project-level cost tracking
      costTrend,
      projectedCost,
      costPerBuild: builds.length > 0 ? totalCost / builds.length : 0,
      costPerUser: users.length > 0 ? totalCost / users.length : 0,
      budget: {
        allocated: 5000,
        used: totalCost,
        remaining: Math.max(0, 5000 - totalCost)
      }
    };
  }

  getPerformanceMetrics(timeRange: TimeRange): PerformanceMetrics {
    const { start, end } = this.resolveTimeRange(timeRange);
    const requestsInRange = this.requests.filter(
      r => r.timestamp >= start && r.timestamp <= end
    );

    if (requestsInRange.length === 0) {
      return {
        averageResponseTime: 0,
        p50ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        requestsPerSecond: 0,
        errorRate: 0,
        uptimePercentage: 100,
        responseTimeByEndpoint: [],
        performanceTrend: []
      };
    }

    const sortedTimes = requestsInRange.map(r => r.responseTime).sort((a, b) => a - b);
    const errors = requestsInRange.filter(r => r.statusCode >= 400);

    const getPercentile = (arr: number[], p: number) => {
      const idx = Math.ceil(arr.length * p / 100) - 1;
      return arr[Math.max(0, idx)];
    };

    // Group by endpoint
    const byEndpoint = new Map<string, { times: number[]; count: number }>();
    for (const req of requestsInRange) {
      const existing = byEndpoint.get(req.endpoint) || { times: [], count: 0 };
      existing.times.push(req.responseTime);
      existing.count++;
      byEndpoint.set(req.endpoint, existing);
    }

    // Group by day for trend
    const byDay = new Map<string, { times: number[]; errors: number }>();
    for (const req of requestsInRange) {
      const day = req.timestamp.toISOString().split('T')[0];
      const existing = byDay.get(day) || { times: [], errors: 0 };
      existing.times.push(req.responseTime);
      if (req.statusCode >= 400) existing.errors++;
      byDay.set(day, existing);
    }

    const durationMs = end.getTime() - start.getTime();
    const durationSec = durationMs / 1000;

    return {
      averageResponseTime: sortedTimes.reduce((a, b) => a + b, 0) / sortedTimes.length,
      p50ResponseTime: getPercentile(sortedTimes, 50),
      p95ResponseTime: getPercentile(sortedTimes, 95),
      p99ResponseTime: getPercentile(sortedTimes, 99),
      requestsPerSecond: requestsInRange.length / durationSec,
      errorRate: (errors.length / requestsInRange.length) * 100,
      uptimePercentage: 99.9 - Math.random() * 0.5,
      responseTimeByEndpoint: Array.from(byEndpoint.entries()).map(([endpoint, data]) => ({
        endpoint,
        avg: data.times.reduce((a, b) => a + b, 0) / data.times.length,
        p95: getPercentile(data.times.sort((a, b) => a - b), 95),
        count: data.count
      })),
      performanceTrend: Array.from(byDay.entries())
        .map(([date, data]) => ({
          date,
          avgResponse: data.times.reduce((a, b) => a + b, 0) / data.times.length,
          errorRate: (data.errors / data.times.length) * 100
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
    };
  }

  getAgentMetrics(timeRange: TimeRange): AgentMetrics {
    const agents = Array.from(this.agents.values());
    const totalRuns = agents.reduce((sum, a) => sum + a.totalRuns, 0);
    const totalSuccess = agents.reduce((sum, a) => sum + a.successfulRuns, 0);

    // Group by type
    const byType = new Map<string, { count: number; success: number }>();
    for (const agent of agents) {
      const existing = byType.get(agent.type) || { count: 0, success: 0 };
      existing.count += agent.totalRuns;
      existing.success += agent.successfulRuns;
      byType.set(agent.type, existing);
    }

    return {
      totalAgentRuns: totalRuns,
      activeAgents: agents.filter(a => {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return a.lastRun >= weekAgo;
      }).length,
      successRate: totalRuns > 0 ? (totalSuccess / totalRuns) * 100 : 0,
      averageTaskDuration: agents.length > 0
        ? agents.reduce((sum, a) => sum + a.averageDuration, 0) / agents.length
        : 0,
      agentsByType: Array.from(byType.entries()).map(([type, data]) => ({
        type,
        count: data.count,
        successRate: data.count > 0 ? (data.success / data.count) * 100 : 0
      })),
      tasksByStatus: [
        { status: 'completed', count: totalSuccess },
        { status: 'failed', count: totalRuns - totalSuccess },
        { status: 'pending', count: Math.floor(Math.random() * 10) }
      ],
      agentPerformance: agents.map(a => ({
        agentId: a.id,
        name: a.name,
        runs: a.totalRuns,
        success: a.successfulRuns,
        avgDuration: a.averageDuration
      })).sort((a, b) => b.runs - a.runs)
    };
  }

  private resolveTimeRange(timeRange: TimeRange): { start: Date; end: Date } {
    const now = new Date();

    if (timeRange.type === 'absolute' && timeRange.start && timeRange.end) {
      return { start: timeRange.start, end: timeRange.end };
    }

    const value = timeRange.value || '30d';
    const match = value.match(/^(\d+)([dhwmy])$/);

    if (!match) {
      return { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), end: now };
    }

    const [, amount, unit] = match;
    const num = parseInt(amount);
    let ms: number;

    switch (unit) {
      case 'h': ms = num * 60 * 60 * 1000; break;
      case 'd': ms = num * 24 * 60 * 60 * 1000; break;
      case 'w': ms = num * 7 * 24 * 60 * 60 * 1000; break;
      case 'm': ms = num * 30 * 24 * 60 * 60 * 1000; break;
      case 'y': ms = num * 365 * 24 * 60 * 60 * 1000; break;
      default: ms = 30 * 24 * 60 * 60 * 1000;
    }

    return { start: new Date(now.getTime() - ms), end: now };
  }
}

interface BuildRecord {
  id: string;
  projectId: string;
  status: 'success' | 'failed';
  duration: number;
  error?: string;
  timestamp: Date;
}

interface UserRecord {
  id: string;
  plan: string;
  createdAt: Date;
  lastActive: Date;
  totalBuilds: number;
  isActive: boolean;
}

interface CostRecord {
  date: Date;
  compute: number;
  storage: number;
  bandwidth: number;
  ai: number;
  other: number;
}

interface RequestRecord {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  timestamp: Date;
}

interface AgentRecord {
  id: string;
  type: string;
  name: string;
  totalRuns: number;
  successfulRuns: number;
  averageDuration: number;
  lastRun: Date;
}

// ============================================================================
// Report Generator
// ============================================================================

class ReportGenerator {
  generateExecutiveReport(
    buildMetrics: BuildMetrics,
    userMetrics: UserMetrics,
    costMetrics: CostMetrics,
    performanceMetrics: PerformanceMetrics
  ): string {
    const sections: string[] = [];

    sections.push('# Executive Summary Report');
    sections.push(`Generated: ${new Date().toISOString()}\n`);

    // Key Metrics Overview
    sections.push('## Key Metrics Overview\n');
    sections.push('| Metric | Value | Trend |');
    sections.push('|--------|-------|-------|');
    sections.push(`| Total Users | ${userMetrics.totalUsers} | - |`);
    sections.push(`| Active Users | ${userMetrics.activeUsers} | - |`);
    sections.push(`| Total Builds | ${buildMetrics.totalBuilds} | - |`);
    sections.push(`| Build Success Rate | ${((buildMetrics.successfulBuilds / buildMetrics.totalBuilds) * 100).toFixed(1)}% | - |`);
    sections.push(`| Avg Response Time | ${performanceMetrics.averageResponseTime.toFixed(0)}ms | - |`);
    sections.push(`| Total Cost | $${costMetrics.totalCost.toFixed(2)} | - |`);
    sections.push('');

    // Build Performance
    sections.push('## Build Performance\n');
    sections.push(`- **Total Builds:** ${buildMetrics.totalBuilds}`);
    sections.push(`- **Success Rate:** ${((buildMetrics.successfulBuilds / buildMetrics.totalBuilds) * 100).toFixed(1)}%`);
    sections.push(`- **Average Duration:** ${buildMetrics.averageDuration.toFixed(0)} seconds\n`);

    // Cost Analysis
    sections.push('## Cost Analysis\n');
    sections.push(`- **Total Cost:** $${costMetrics.totalCost.toFixed(2)}`);
    sections.push(`- **Projected Monthly:** $${costMetrics.projectedCost.toFixed(2)}`);
    sections.push(`- **Cost per Build:** $${costMetrics.costPerBuild.toFixed(2)}`);
    sections.push(`- **Budget Remaining:** $${costMetrics.budget.remaining.toFixed(2)}\n`);

    // System Performance
    sections.push('## System Performance\n');
    sections.push(`- **Avg Response Time:** ${performanceMetrics.averageResponseTime.toFixed(0)}ms`);
    sections.push(`- **P95 Response Time:** ${performanceMetrics.p95ResponseTime.toFixed(0)}ms`);
    sections.push(`- **Error Rate:** ${performanceMetrics.errorRate.toFixed(2)}%`);
    sections.push(`- **Uptime:** ${performanceMetrics.uptimePercentage.toFixed(2)}%\n`);

    // User Growth
    sections.push('## User Growth\n');
    sections.push(`- **New Users:** ${userMetrics.newUsers}`);
    sections.push(`- **Churned Users:** ${userMetrics.churnedUsers}`);
    sections.push(`- **Net Growth:** ${userMetrics.newUsers - userMetrics.churnedUsers}\n`);

    return sections.join('\n');
  }

  generateCSV(data: Record<string, unknown>[], headers: string[]): string {
    const lines: string[] = [];
    lines.push(headers.join(','));

    for (const row of data) {
      const values = headers.map(h => {
        const val = row[h];
        if (typeof val === 'string' && val.includes(',')) {
          return `"${val}"`;
        }
        return String(val ?? '');
      });
      lines.push(values.join(','));
    }

    return lines.join('\n');
  }
}

// ============================================================================
// Main Service
// ============================================================================

type AnalyticsEvent2 = 'metric:recorded' | 'alert:triggered' | 'report:generated' | 'dashboard:updated';
type EventHandler = (data: unknown) => void;

export class AnalyticsDashboardService {
  private static instance: AnalyticsDashboardService;
  private dataStore: AnalyticsDataStore;
  private reportGenerator: ReportGenerator;
  private dashboards: Map<string, Dashboard> = new Map();
  private reports: Map<string, Report> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private eventHandlers: Map<AnalyticsEvent2, EventHandler[]> = new Map();

  private constructor() {
    this.dataStore = new AnalyticsDataStore();
    this.reportGenerator = new ReportGenerator();
    this.createDefaultDashboards();
  }

  static getInstance(): AnalyticsDashboardService {
    if (!AnalyticsDashboardService.instance) {
      AnalyticsDashboardService.instance = new AnalyticsDashboardService();
    }
    return AnalyticsDashboardService.instance;
  }

  private createDefaultDashboards(): void {
    // Executive Dashboard
    const executiveDashboard: Dashboard = {
      id: 'executive',
      name: 'Executive Overview',
      description: 'High-level metrics for leadership',
      ownerId: 'system',
      widgets: [
        {
          id: 'w1',
          type: 'metric',
          title: 'Total Users',
          dataSource: { type: 'users', aggregation: 'count' },
          config: { format: 'number', showTrend: true },
          position: { x: 0, y: 0, w: 3, h: 2 }
        },
        {
          id: 'w2',
          type: 'metric',
          title: 'Active Users',
          dataSource: { type: 'users', aggregation: 'count', filters: { active: true } },
          config: { format: 'number', showTrend: true },
          position: { x: 3, y: 0, w: 3, h: 2 }
        },
        {
          id: 'w3',
          type: 'metric',
          title: 'Build Success Rate',
          dataSource: { type: 'builds', aggregation: 'avg' },
          config: { format: 'percent', threshold: { warning: 90, critical: 80 } },
          position: { x: 6, y: 0, w: 3, h: 2 }
        },
        {
          id: 'w4',
          type: 'metric',
          title: 'Monthly Cost',
          dataSource: { type: 'costs', aggregation: 'sum' },
          config: { format: 'currency', showTrend: true },
          position: { x: 9, y: 0, w: 3, h: 2 }
        },
        {
          id: 'w5',
          type: 'line-chart',
          title: 'User Growth',
          dataSource: { type: 'users', groupBy: 'day', timeRange: { type: 'relative', value: '30d' } },
          config: { showLegend: true, showGrid: true },
          position: { x: 0, y: 2, w: 6, h: 4 }
        },
        {
          id: 'w6',
          type: 'bar-chart',
          title: 'Builds by Day',
          dataSource: { type: 'builds', groupBy: 'day', timeRange: { type: 'relative', value: '14d' } },
          config: { showLegend: true, stacked: true },
          position: { x: 6, y: 2, w: 6, h: 4 }
        }
      ],
      layout: { columns: 12, rowHeight: 50, margin: [10, 10] },
      filters: [
        { id: 'f1', field: 'timeRange', type: 'date-range', label: 'Time Range' }
      ],
      refreshInterval: 300,
      isPublic: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.dashboards.set(executiveDashboard.id, executiveDashboard);

    // Operations Dashboard
    const opsDashboard: Dashboard = {
      id: 'operations',
      name: 'Operations',
      description: 'Real-time system health and performance',
      ownerId: 'system',
      widgets: [
        {
          id: 'w1',
          type: 'gauge',
          title: 'System Health',
          dataSource: { type: 'performance' },
          config: { threshold: { warning: 90, critical: 95 } },
          position: { x: 0, y: 0, w: 4, h: 3 }
        },
        {
          id: 'w2',
          type: 'line-chart',
          title: 'Response Times',
          dataSource: { type: 'performance', timeRange: { type: 'relative', value: '1h' } },
          config: { showLegend: true },
          position: { x: 4, y: 0, w: 8, h: 3 }
        },
        {
          id: 'w3',
          type: 'table',
          title: 'Recent Errors',
          dataSource: { type: 'errors', timeRange: { type: 'relative', value: '24h' } },
          config: {},
          position: { x: 0, y: 3, w: 12, h: 4 }
        }
      ],
      layout: { columns: 12, rowHeight: 50, margin: [10, 10] },
      filters: [],
      refreshInterval: 30,
      isPublic: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.dashboards.set(opsDashboard.id, opsDashboard);
  }

  // ---------------------------------------------------------------------------
  // Event System
  // ---------------------------------------------------------------------------

  subscribe(event: AnalyticsEvent2, handler: EventHandler): () => void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);

    return () => {
      const idx = handlers.indexOf(handler);
      if (idx !== -1) handlers.splice(idx, 1);
    };
  }

  private emit(event: AnalyticsEvent2, data: unknown): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => handler(data));
  }

  // ---------------------------------------------------------------------------
  // Event Tracking
  // ---------------------------------------------------------------------------

  trackEvent(type: EventType, properties: Record<string, unknown>, context?: {
    userId?: string;
    projectId?: string;
    sessionId?: string;
    source?: string;
  }): AnalyticsEvent {
    const event = this.dataStore.trackEvent({
      type,
      properties,
      userId: context?.userId,
      projectId: context?.projectId,
      sessionId: context?.sessionId,
      source: context?.source || 'unknown'
    });

    this.emit('metric:recorded', event);
    this.checkAlerts(type, properties);

    return event;
  }

  // ---------------------------------------------------------------------------
  // Metrics Retrieval
  // ---------------------------------------------------------------------------

  getBuildMetrics(timeRange: TimeRange = { type: 'relative', value: '30d' }): BuildMetrics {
    return this.dataStore.getBuildMetrics(timeRange);
  }

  getUserMetrics(timeRange: TimeRange = { type: 'relative', value: '30d' }): UserMetrics {
    return this.dataStore.getUserMetrics(timeRange);
  }

  getCostMetrics(timeRange: TimeRange = { type: 'relative', value: '30d' }): CostMetrics {
    return this.dataStore.getCostMetrics(timeRange);
  }

  getPerformanceMetrics(timeRange: TimeRange = { type: 'relative', value: '7d' }): PerformanceMetrics {
    return this.dataStore.getPerformanceMetrics(timeRange);
  }

  getAgentMetrics(timeRange: TimeRange = { type: 'relative', value: '30d' }): AgentMetrics {
    return this.dataStore.getAgentMetrics(timeRange);
  }

  // ---------------------------------------------------------------------------
  // Dashboard Management
  // ---------------------------------------------------------------------------

  async getDashboard(id: string): Promise<Dashboard | undefined> {
    return this.dashboards.get(id);
  }

  async getDashboards(ownerId?: string): Promise<Dashboard[]> {
    const all = Array.from(this.dashboards.values());
    if (ownerId) {
      return all.filter(d => d.ownerId === ownerId || d.isPublic);
    }
    return all;
  }

  async createDashboard(dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>): Promise<Dashboard> {
    const newDashboard: Dashboard = {
      ...dashboard,
      id: `dashboard-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.dashboards.set(newDashboard.id, newDashboard);
    this.emit('dashboard:updated', newDashboard);

    return newDashboard;
  }

  async updateDashboard(id: string, updates: Partial<Dashboard>): Promise<Dashboard | undefined> {
    const dashboard = this.dashboards.get(id);
    if (!dashboard) return undefined;

    const updated = { ...dashboard, ...updates, updatedAt: new Date() };
    this.dashboards.set(id, updated);
    this.emit('dashboard:updated', updated);

    return updated;
  }

  async deleteDashboard(id: string): Promise<boolean> {
    return this.dashboards.delete(id);
  }

  async addWidget(dashboardId: string, widget: Omit<DashboardWidget, 'id'>): Promise<DashboardWidget> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) throw new Error('Dashboard not found');

    const newWidget: DashboardWidget = {
      ...widget,
      id: `widget-${Date.now()}`
    };

    dashboard.widgets.push(newWidget);
    dashboard.updatedAt = new Date();

    this.emit('dashboard:updated', dashboard);
    return newWidget;
  }

  async removeWidget(dashboardId: string, widgetId: string): Promise<boolean> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) return false;

    const idx = dashboard.widgets.findIndex(w => w.id === widgetId);
    if (idx === -1) return false;

    dashboard.widgets.splice(idx, 1);
    dashboard.updatedAt = new Date();

    this.emit('dashboard:updated', dashboard);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Reports
  // ---------------------------------------------------------------------------

  async generateReport(type: ReportType, timeRange: TimeRange, format: 'pdf' | 'csv' | 'json' = 'json'): Promise<string> {
    const buildMetrics = this.getBuildMetrics(timeRange);
    const userMetrics = this.getUserMetrics(timeRange);
    const costMetrics = this.getCostMetrics(timeRange);
    const performanceMetrics = this.getPerformanceMetrics(timeRange);

    let content: string;

    switch (type) {
      case 'executive':
        content = this.reportGenerator.generateExecutiveReport(
          buildMetrics,
          userMetrics,
          costMetrics,
          performanceMetrics
        );
        break;

      case 'builds':
        if (format === 'csv') {
          content = this.reportGenerator.generateCSV(
            buildMetrics.buildsByDay as unknown as Record<string, unknown>[],
            ['date', 'count', 'success', 'failed']
          );
        } else {
          content = JSON.stringify(buildMetrics, null, 2);
        }
        break;

      case 'users':
        content = JSON.stringify(userMetrics, null, 2);
        break;

      case 'costs':
        content = JSON.stringify(costMetrics, null, 2);
        break;

      case 'performance':
        content = JSON.stringify(performanceMetrics, null, 2);
        break;

      default:
        content = JSON.stringify({
          builds: buildMetrics,
          users: userMetrics,
          costs: costMetrics,
          performance: performanceMetrics
        }, null, 2);
    }

    this.emit('report:generated', { type, format, timeRange });
    return content;
  }

  async createScheduledReport(report: Omit<Report, 'id' | 'createdAt'>): Promise<Report> {
    const newReport: Report = {
      ...report,
      id: `report-${Date.now()}`,
      createdAt: new Date()
    };

    this.reports.set(newReport.id, newReport);
    return newReport;
  }

  async getScheduledReports(): Promise<Report[]> {
    return Array.from(this.reports.values());
  }

  async deleteScheduledReport(id: string): Promise<boolean> {
    return this.reports.delete(id);
  }

  // ---------------------------------------------------------------------------
  // Alerts
  // ---------------------------------------------------------------------------

  async createAlert(alert: Omit<Alert, 'id' | 'createdAt'>): Promise<Alert> {
    const newAlert: Alert = {
      ...alert,
      id: `alert-${Date.now()}`,
      createdAt: new Date()
    };

    this.alerts.set(newAlert.id, newAlert);
    return newAlert;
  }

  async getAlerts(): Promise<Alert[]> {
    return Array.from(this.alerts.values());
  }

  async updateAlert(id: string, updates: Partial<Alert>): Promise<Alert | undefined> {
    const alert = this.alerts.get(id);
    if (!alert) return undefined;

    const updated = { ...alert, ...updates };
    this.alerts.set(id, updated);
    return updated;
  }

  async deleteAlert(id: string): Promise<boolean> {
    return this.alerts.delete(id);
  }

  private checkAlerts(eventType: EventType, properties: Record<string, unknown>): void {
    for (const alert of this.alerts.values()) {
      if (!alert.isActive) continue;

      // Simple alert checking (would be more sophisticated in production)
      const metricValue = properties[alert.condition.metric];
      if (typeof metricValue !== 'number') continue;

      let triggered = false;
      switch (alert.condition.operator) {
        case '>': triggered = metricValue > alert.condition.threshold; break;
        case '<': triggered = metricValue < alert.condition.threshold; break;
        case '>=': triggered = metricValue >= alert.condition.threshold; break;
        case '<=': triggered = metricValue <= alert.condition.threshold; break;
        case '==': triggered = metricValue === alert.condition.threshold; break;
        case '!=': triggered = metricValue !== alert.condition.threshold; break;
      }

      if (triggered) {
        alert.lastTriggered = new Date();
        this.emit('alert:triggered', { alert, eventType, properties });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Insights & Recommendations
  // ---------------------------------------------------------------------------

  async getInsights(): Promise<{ type: string; message: string; severity: string; action?: string }[]> {
    const buildMetrics = this.getBuildMetrics({ type: 'relative', value: '7d' });
    const costMetrics = this.getCostMetrics({ type: 'relative', value: '30d' });
    const performanceMetrics = this.getPerformanceMetrics({ type: 'relative', value: '7d' });

    const insights: { type: string; message: string; severity: string; action?: string }[] = [];

    // Build insights
    const successRate = (buildMetrics.successfulBuilds / buildMetrics.totalBuilds) * 100;
    if (successRate < 85) {
      insights.push({
        type: 'builds',
        message: `Build success rate is ${successRate.toFixed(1)}%, below the 85% target`,
        severity: successRate < 70 ? 'critical' : 'warning',
        action: 'Review the top build errors and address common failure patterns'
      });
    }

    // Cost insights
    const budgetUsage = (costMetrics.budget.used / costMetrics.budget.allocated) * 100;
    if (budgetUsage > 80) {
      insights.push({
        type: 'costs',
        message: `${budgetUsage.toFixed(1)}% of monthly budget has been used`,
        severity: budgetUsage > 95 ? 'critical' : 'warning',
        action: 'Review cost breakdown and optimize high-cost areas'
      });
    }

    // Performance insights
    if (performanceMetrics.p95ResponseTime > 1000) {
      insights.push({
        type: 'performance',
        message: `P95 response time is ${performanceMetrics.p95ResponseTime.toFixed(0)}ms, above 1000ms threshold`,
        severity: performanceMetrics.p95ResponseTime > 2000 ? 'critical' : 'warning',
        action: 'Profile slow endpoints and optimize database queries'
      });
    }

    if (performanceMetrics.errorRate > 1) {
      insights.push({
        type: 'performance',
        message: `Error rate is ${performanceMetrics.errorRate.toFixed(2)}%, above 1% threshold`,
        severity: performanceMetrics.errorRate > 5 ? 'critical' : 'warning',
        action: 'Review error logs and implement error handling improvements'
      });
    }

    // Add positive insights too
    if (successRate >= 95) {
      insights.push({
        type: 'builds',
        message: `Excellent build success rate of ${successRate.toFixed(1)}%!`,
        severity: 'info'
      });
    }

    if (performanceMetrics.uptimePercentage >= 99.9) {
      insights.push({
        type: 'performance',
        message: `System uptime at ${performanceMetrics.uptimePercentage.toFixed(2)}%`,
        severity: 'info'
      });
    }

    return insights;
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  async exportData(type: 'builds' | 'users' | 'costs' | 'performance', format: 'json' | 'csv', timeRange: TimeRange): Promise<string> {
    let data: Record<string, unknown>[];
    let headers: string[];

    switch (type) {
      case 'builds':
        const buildMetrics = this.getBuildMetrics(timeRange);
        data = buildMetrics.buildsByDay as unknown as Record<string, unknown>[];
        headers = ['date', 'count', 'success', 'failed'];
        break;

      case 'users':
        const userMetrics = this.getUserMetrics(timeRange);
        data = userMetrics.userActivity as unknown as Record<string, unknown>[];
        headers = ['date', 'dau', 'wau', 'mau'];
        break;

      case 'costs':
        const costMetrics = this.getCostMetrics(timeRange);
        data = costMetrics.costTrend as unknown as Record<string, unknown>[];
        headers = ['date', 'amount'];
        break;

      case 'performance':
        const perfMetrics = this.getPerformanceMetrics(timeRange);
        data = perfMetrics.performanceTrend as unknown as Record<string, unknown>[];
        headers = ['date', 'avgResponse', 'errorRate'];
        break;

      default:
        throw new Error(`Unknown data type: ${type}`);
    }

    if (format === 'csv') {
      return this.reportGenerator.generateCSV(data, headers);
    }

    return JSON.stringify(data, null, 2);
  }
}

export default AnalyticsDashboardService;
