/**
 * Monitoring Service
 *
 * Real-time health monitoring, performance tracking, and alerting
 * for deployed applications and build processes.
 */

// =============================================================================
// TYPES
// =============================================================================

export type MetricType =
  | 'counter'
  | 'gauge'
  | 'histogram'
  | 'summary';

export type HealthStatus =
  | 'healthy'
  | 'degraded'
  | 'unhealthy'
  | 'unknown';

export type AlertSeverity =
  | 'info'
  | 'warning'
  | 'error'
  | 'critical';

export interface Metric {
  name: string;
  type: MetricType;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
  timestamp: string;
}

export interface MetricSeries {
  name: string;
  type: MetricType;
  unit?: string;
  dataPoints: DataPoint[];
  aggregation?: AggregatedMetrics;
}

export interface DataPoint {
  value: number;
  timestamp: string;
  tags?: Record<string, string>;
}

export interface AggregatedMetrics {
  min: number;
  max: number;
  avg: number;
  sum: number;
  count: number;
  p50?: number;
  p95?: number;
  p99?: number;
}

export interface HealthCheck {
  id: string;
  name: string;
  type: HealthCheckType;
  target: string;
  interval: number; // seconds
  timeout: number; // seconds
  config: HealthCheckConfig;
  status: HealthStatus;
  lastCheck?: HealthCheckResult;
  history: HealthCheckResult[];
}

export type HealthCheckType =
  | 'http'
  | 'tcp'
  | 'dns'
  | 'database'
  | 'redis'
  | 'custom';

export interface HealthCheckConfig {
  // HTTP specific
  method?: 'GET' | 'POST' | 'HEAD';
  path?: string;
  expectedStatus?: number;
  expectedBody?: string;

  // TCP specific
  port?: number;

  // Database specific
  query?: string;

  // Custom
  script?: string;
}

export interface HealthCheckResult {
  id: string;
  checkId: string;
  status: HealthStatus;
  responseTime: number; // milliseconds
  timestamp: string;
  message?: string;
  error?: string;
  details?: Record<string, unknown>;
}

export interface Alert {
  id: string;
  name: string;
  severity: AlertSeverity;
  condition: AlertCondition;
  status: 'active' | 'resolved' | 'acknowledged';
  triggeredAt: string;
  resolvedAt?: string;
  acknowledgedBy?: string;
  notifications: AlertNotification[];
  history: AlertEvent[];
}

export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  duration?: number; // seconds to sustain condition
  aggregation?: 'avg' | 'max' | 'min' | 'sum' | 'p95' | 'p99';
}

export interface AlertNotification {
  channel: NotificationChannel;
  sentAt?: string;
  status: 'pending' | 'sent' | 'failed';
  error?: string;
}

export type NotificationChannel =
  | { type: 'email'; address: string }
  | { type: 'slack'; webhook: string }
  | { type: 'discord'; webhook: string }
  | { type: 'webhook'; url: string };

export interface AlertEvent {
  type: 'triggered' | 'resolved' | 'acknowledged' | 'escalated';
  timestamp: string;
  details?: string;
  userId?: string;
}

export interface Dashboard {
  id: string;
  name: string;
  projectId: string;
  widgets: DashboardWidget[];
  layout: LayoutConfig;
  refreshInterval: number; // seconds
  createdAt: string;
  updatedAt: string;
}

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  config: WidgetConfig;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

export type WidgetType =
  | 'line_chart'
  | 'bar_chart'
  | 'gauge'
  | 'stat'
  | 'table'
  | 'logs'
  | 'health_status'
  | 'alert_list';

export interface WidgetConfig {
  metric?: string;
  metrics?: string[];
  timeRange?: TimeRange;
  aggregation?: 'avg' | 'max' | 'min' | 'sum' | 'count';
  groupBy?: string[];
  filter?: Record<string, string>;
  displayFormat?: string;
  thresholds?: ThresholdConfig[];
}

export interface TimeRange {
  start: string | 'now-1h' | 'now-24h' | 'now-7d' | 'now-30d';
  end: string | 'now';
}

export interface ThresholdConfig {
  value: number;
  color: string;
  label?: string;
}

export interface LayoutConfig {
  columns: number;
  rowHeight: number;
}

export interface PerformanceProfile {
  id: string;
  projectId: string;
  environment: string;
  timestamp: string;
  duration: number;

  // Resource usage
  cpu: ResourceUsage;
  memory: ResourceUsage;
  disk: ResourceUsage;
  network: NetworkUsage;

  // Application metrics
  requestsPerSecond: number;
  averageResponseTime: number;
  errorRate: number;
  activeConnections: number;

  // Breakdown
  endpoints: EndpointMetrics[];
  dependencies: DependencyMetrics[];
}

export interface ResourceUsage {
  used: number;
  total: number;
  percentage: number;
  unit: string;
}

export interface NetworkUsage {
  bytesIn: number;
  bytesOut: number;
  requestsIn: number;
  requestsOut: number;
}

export interface EndpointMetrics {
  path: string;
  method: string;
  requests: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  errorRate: number;
}

export interface DependencyMetrics {
  name: string;
  type: 'database' | 'cache' | 'api' | 'service';
  latency: number;
  errorRate: number;
  calls: number;
}

export interface LogEntry {
  id: string;
  projectId: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  service?: string;
  trace?: string;
  span?: string;
  context?: Record<string, unknown>;
}

export interface LogQuery {
  projectId: string;
  startTime: string;
  endTime: string;
  level?: LogEntry['level'][];
  search?: string;
  service?: string;
  limit?: number;
  offset?: number;
}

// =============================================================================
// MONITORING SERVICE
// =============================================================================

export class MonitoringService {
  private static instance: MonitoringService;
  private metrics: Map<string, MetricSeries> = new Map();
  private healthChecks: Map<string, HealthCheck> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private dashboards: Map<string, Dashboard> = new Map();
  private logs: LogEntry[] = [];
  private checkIntervals: Map<string, NodeJS.Timeout> = new Map();
  private alertEvaluationInterval?: NodeJS.Timeout;

  private constructor() {
    this.startAlertEvaluation();
  }

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  // ===========================================================================
  // METRICS
  // ===========================================================================

  recordMetric(metric: Omit<Metric, 'timestamp'>): void {
    const timestamp = new Date().toISOString();
    const fullMetric: Metric = { ...metric, timestamp };

    let series = this.metrics.get(metric.name);
    if (!series) {
      series = {
        name: metric.name,
        type: metric.type,
        unit: metric.unit,
        dataPoints: [],
      };
      this.metrics.set(metric.name, series);
    }

    series.dataPoints.push({
      value: metric.value,
      timestamp,
      tags: metric.tags,
    });

    // Keep last 1000 data points
    if (series.dataPoints.length > 1000) {
      series.dataPoints = series.dataPoints.slice(-1000);
    }

    // Update aggregation
    series.aggregation = this.calculateAggregation(series.dataPoints);
  }

  getMetric(name: string, timeRange?: TimeRange): MetricSeries | null {
    const series = this.metrics.get(name);
    if (!series) return null;

    if (timeRange) {
      const start = this.parseTimeRange(timeRange.start);
      const end = this.parseTimeRange(timeRange.end);

      const filteredPoints = series.dataPoints.filter((p) => {
        const time = new Date(p.timestamp).getTime();
        return time >= start && time <= end;
      });

      return {
        ...series,
        dataPoints: filteredPoints,
        aggregation: this.calculateAggregation(filteredPoints),
      };
    }

    return series;
  }

  listMetrics(): string[] {
    return Array.from(this.metrics.keys());
  }

  private calculateAggregation(dataPoints: DataPoint[]): AggregatedMetrics {
    if (dataPoints.length === 0) {
      return { min: 0, max: 0, avg: 0, sum: 0, count: 0 };
    }

    const values = dataPoints.map((p) => p.value);
    const sorted = [...values].sort((a, b) => a - b);

    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      sum: values.reduce((a, b) => a + b, 0),
      count: values.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  private parseTimeRange(time: string): number {
    if (time === 'now') {
      return Date.now();
    }

    const match = time.match(/^now-(\d+)([hdm])$/);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2];
      const multipliers: Record<string, number> = {
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
      };
      return Date.now() - value * multipliers[unit];
    }

    return new Date(time).getTime();
  }

  // ===========================================================================
  // HEALTH CHECKS
  // ===========================================================================

  async createHealthCheck(
    config: Omit<HealthCheck, 'id' | 'status' | 'history'>
  ): Promise<HealthCheck> {
    const checkId = this.generateId();

    const healthCheck: HealthCheck = {
      ...config,
      id: checkId,
      status: 'unknown',
      history: [],
    };

    this.healthChecks.set(checkId, healthCheck);

    // Start periodic checks
    this.startHealthCheck(healthCheck);

    // Run initial check
    await this.runHealthCheck(checkId);

    return healthCheck;
  }

  private startHealthCheck(check: HealthCheck): void {
    const interval = setInterval(async () => {
      await this.runHealthCheck(check.id);
    }, check.interval * 1000);

    this.checkIntervals.set(check.id, interval);
  }

  async runHealthCheck(checkId: string): Promise<HealthCheckResult> {
    const check = this.healthChecks.get(checkId);
    if (!check) {
      throw new Error(`Health check not found: ${checkId}`);
    }

    const resultId = this.generateId();
    const startTime = Date.now();

    let status: HealthStatus = 'healthy';
    let message: string | undefined;
    let error: string | undefined;
    let details: Record<string, unknown> | undefined;

    try {
      switch (check.type) {
        case 'http':
          await this.runHttpCheck(check);
          message = 'HTTP check passed';
          break;

        case 'tcp':
          await this.runTcpCheck(check);
          message = 'TCP check passed';
          break;

        case 'database':
          await this.runDatabaseCheck(check);
          message = 'Database check passed';
          break;

        case 'redis':
          await this.runRedisCheck(check);
          message = 'Redis check passed';
          break;

        case 'dns':
          await this.runDnsCheck(check);
          message = 'DNS check passed';
          break;

        default:
          message = 'Check completed';
      }
    } catch (e) {
      status = 'unhealthy';
      error = e instanceof Error ? e.message : 'Unknown error';
    }

    const responseTime = Date.now() - startTime;

    // Determine status based on response time thresholds
    if (status === 'healthy') {
      if (responseTime > check.timeout * 1000 * 0.8) {
        status = 'degraded';
        message = 'Response time approaching timeout threshold';
      }
    }

    const result: HealthCheckResult = {
      id: resultId,
      checkId,
      status,
      responseTime,
      timestamp: new Date().toISOString(),
      message,
      error,
      details,
    };

    // Update health check
    check.lastCheck = result;
    check.status = status;
    check.history.push(result);

    // Keep last 100 results
    if (check.history.length > 100) {
      check.history = check.history.slice(-100);
    }

    // Record metrics
    this.recordMetric({
      name: `health_check.${check.name}.response_time`,
      type: 'gauge',
      value: responseTime,
      unit: 'ms',
      tags: { status },
    });

    return result;
  }

  private async runHttpCheck(check: HealthCheck): Promise<void> {
    const config = check.config;
    const url = `${check.target}${config.path || ''}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), check.timeout * 1000);

    try {
      const response = await fetch(url, {
        method: config.method || 'GET',
        signal: controller.signal,
      });

      if (config.expectedStatus && response.status !== config.expectedStatus) {
        throw new Error(`Expected status ${config.expectedStatus}, got ${response.status}`);
      }

      if (config.expectedBody) {
        const body = await response.text();
        if (!body.includes(config.expectedBody)) {
          throw new Error('Response body did not match expected content');
        }
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  private async runTcpCheck(check: HealthCheck): Promise<void> {
    // In a real implementation, this would use net.Socket
    // For now, we simulate the check
    const url = new URL(check.target);
    const port = check.config.port || parseInt(url.port, 10) || 80;

    console.log(`TCP check to ${url.hostname}:${port}`);
    // Simulated success
  }

  private async runDatabaseCheck(check: HealthCheck): Promise<void> {
    // In a real implementation, this would execute a query
    console.log(`Database check: ${check.config.query || 'SELECT 1'}`);
    // Simulated success
  }

  private async runRedisCheck(check: HealthCheck): Promise<void> {
    // In a real implementation, this would PING Redis
    console.log(`Redis check to ${check.target}`);
    // Simulated success
  }

  private async runDnsCheck(check: HealthCheck): Promise<void> {
    // In a real implementation, this would resolve DNS
    console.log(`DNS check for ${check.target}`);
    // Simulated success
  }

  getHealthCheck(checkId: string): HealthCheck | null {
    return this.healthChecks.get(checkId) || null;
  }

  listHealthChecks(): HealthCheck[] {
    return Array.from(this.healthChecks.values());
  }

  async deleteHealthCheck(checkId: string): Promise<void> {
    const interval = this.checkIntervals.get(checkId);
    if (interval) {
      clearInterval(interval);
      this.checkIntervals.delete(checkId);
    }
    this.healthChecks.delete(checkId);
  }

  getOverallHealth(): { status: HealthStatus; checks: Record<string, HealthStatus> } {
    const checks = Array.from(this.healthChecks.values());
    const checkStatuses: Record<string, HealthStatus> = {};

    let overallStatus: HealthStatus = 'healthy';

    for (const check of checks) {
      checkStatuses[check.name] = check.status;

      if (check.status === 'unhealthy') {
        overallStatus = 'unhealthy';
      } else if (check.status === 'degraded' && overallStatus === 'healthy') {
        overallStatus = 'degraded';
      } else if (check.status === 'unknown' && overallStatus === 'healthy') {
        overallStatus = 'unknown';
      }
    }

    return { status: overallStatus, checks: checkStatuses };
  }

  // ===========================================================================
  // ALERTS
  // ===========================================================================

  async createAlert(
    config: Omit<Alert, 'id' | 'status' | 'triggeredAt' | 'history' | 'notifications'>
  ): Promise<Alert> {
    const alertId = this.generateId();

    const alert: Alert = {
      ...config,
      id: alertId,
      status: 'resolved',
      triggeredAt: '',
      notifications: [],
      history: [],
    };

    this.alerts.set(alertId, alert);

    return alert;
  }

  private startAlertEvaluation(): void {
    this.alertEvaluationInterval = setInterval(() => {
      this.evaluateAlerts();
    }, 10000); // Evaluate every 10 seconds
  }

  private evaluateAlerts(): void {
    for (const alert of this.alerts.values()) {
      const shouldTrigger = this.evaluateAlertCondition(alert.condition);

      if (shouldTrigger && alert.status === 'resolved') {
        this.triggerAlert(alert);
      } else if (!shouldTrigger && alert.status === 'active') {
        this.resolveAlert(alert.id);
      }
    }
  }

  private evaluateAlertCondition(condition: AlertCondition): boolean {
    const series = this.metrics.get(condition.metric);
    if (!series || series.dataPoints.length === 0) {
      return false;
    }

    // Get recent data points (last minute by default)
    const duration = condition.duration || 60;
    const cutoff = Date.now() - duration * 1000;
    const recentPoints = series.dataPoints.filter(
      (p) => new Date(p.timestamp).getTime() >= cutoff
    );

    if (recentPoints.length === 0) {
      return false;
    }

    // Calculate value based on aggregation
    let value: number;
    switch (condition.aggregation) {
      case 'max':
        value = Math.max(...recentPoints.map((p) => p.value));
        break;
      case 'min':
        value = Math.min(...recentPoints.map((p) => p.value));
        break;
      case 'sum':
        value = recentPoints.reduce((sum, p) => sum + p.value, 0);
        break;
      default:
        value = recentPoints.reduce((sum, p) => sum + p.value, 0) / recentPoints.length;
    }

    // Evaluate condition
    switch (condition.operator) {
      case 'gt':
        return value > condition.threshold;
      case 'lt':
        return value < condition.threshold;
      case 'eq':
        return value === condition.threshold;
      case 'gte':
        return value >= condition.threshold;
      case 'lte':
        return value <= condition.threshold;
      default:
        return false;
    }
  }

  private triggerAlert(alert: Alert): void {
    alert.status = 'active';
    alert.triggeredAt = new Date().toISOString();
    alert.history.push({
      type: 'triggered',
      timestamp: alert.triggeredAt,
      details: `Alert triggered: ${alert.condition.metric} ${alert.condition.operator} ${alert.condition.threshold}`,
    });

    // Send notifications
    for (const notification of alert.notifications) {
      this.sendNotification(alert, notification);
    }

    // Record metric
    this.recordMetric({
      name: 'alerts.triggered',
      type: 'counter',
      value: 1,
      tags: { alert: alert.name, severity: alert.severity },
    });
  }

  async resolveAlert(alertId: string, userId?: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (!alert) return;

    alert.status = 'resolved';
    alert.resolvedAt = new Date().toISOString();
    alert.history.push({
      type: 'resolved',
      timestamp: alert.resolvedAt,
      userId,
    });

    this.recordMetric({
      name: 'alerts.resolved',
      type: 'counter',
      value: 1,
      tags: { alert: alert.name, severity: alert.severity },
    });
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (!alert) return;

    alert.status = 'acknowledged';
    alert.acknowledgedBy = userId;
    alert.history.push({
      type: 'acknowledged',
      timestamp: new Date().toISOString(),
      userId,
    });
  }

  private async sendNotification(
    alert: Alert,
    notification: AlertNotification
  ): Promise<void> {
    try {
      const channel = notification.channel;

      switch (channel.type) {
        case 'slack':
          await this.sendSlackNotification(alert, channel.webhook);
          break;
        case 'discord':
          await this.sendDiscordNotification(alert, channel.webhook);
          break;
        case 'email':
          await this.sendEmailNotification(alert, channel.address);
          break;
        case 'webhook':
          await this.sendWebhookNotification(alert, channel.url);
          break;
      }

      notification.status = 'sent';
      notification.sentAt = new Date().toISOString();
    } catch (error) {
      notification.status = 'failed';
      notification.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  private async sendSlackNotification(alert: Alert, webhook: string): Promise<void> {
    const severityColors: Record<AlertSeverity, string> = {
      info: '#36a64f',
      warning: '#ffcc00',
      error: '#ff6600',
      critical: '#ff0000',
    };

    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachments: [
          {
            color: severityColors[alert.severity],
            title: `🚨 ${alert.name}`,
            text: `Alert triggered: ${alert.condition.metric} ${alert.condition.operator} ${alert.condition.threshold}`,
            fields: [
              { title: 'Severity', value: alert.severity, short: true },
              { title: 'Time', value: alert.triggeredAt, short: true },
            ],
          },
        ],
      }),
    });
  }

  private async sendDiscordNotification(alert: Alert, webhook: string): Promise<void> {
    const severityColors: Record<AlertSeverity, number> = {
      info: 0x36a64f,
      warning: 0xffcc00,
      error: 0xff6600,
      critical: 0xff0000,
    };

    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title: `🚨 ${alert.name}`,
            description: `Alert triggered: ${alert.condition.metric} ${alert.condition.operator} ${alert.condition.threshold}`,
            color: severityColors[alert.severity],
            fields: [
              { name: 'Severity', value: alert.severity, inline: true },
              { name: 'Time', value: alert.triggeredAt, inline: true },
            ],
          },
        ],
      }),
    });
  }

  private async sendEmailNotification(_alert: Alert, _address: string): Promise<void> {
    // In a real implementation, this would send an email
    console.log(`Email notification sent to ${_address}`);
  }

  private async sendWebhookNotification(alert: Alert, url: string): Promise<void> {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'alert',
        alert: {
          id: alert.id,
          name: alert.name,
          severity: alert.severity,
          condition: alert.condition,
          triggeredAt: alert.triggeredAt,
        },
      }),
    });
  }

  getAlert(alertId: string): Alert | null {
    return this.alerts.get(alertId) || null;
  }

  listAlerts(status?: Alert['status']): Alert[] {
    let alerts = Array.from(this.alerts.values());
    if (status) {
      alerts = alerts.filter((a) => a.status === status);
    }
    return alerts.sort((a, b) =>
      new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime()
    );
  }

  // ===========================================================================
  // DASHBOARDS
  // ===========================================================================

  async createDashboard(
    config: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Dashboard> {
    const dashboardId = this.generateId();
    const now = new Date().toISOString();

    const dashboard: Dashboard = {
      ...config,
      id: dashboardId,
      createdAt: now,
      updatedAt: now,
    };

    this.dashboards.set(dashboardId, dashboard);

    return dashboard;
  }

  async updateDashboard(
    dashboardId: string,
    updates: Partial<Dashboard>
  ): Promise<Dashboard> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard not found: ${dashboardId}`);
    }

    Object.assign(dashboard, updates, { updatedAt: new Date().toISOString() });

    return dashboard;
  }

  getDashboard(dashboardId: string): Dashboard | null {
    return this.dashboards.get(dashboardId) || null;
  }

  listDashboards(projectId?: string): Dashboard[] {
    let dashboards = Array.from(this.dashboards.values());
    if (projectId) {
      dashboards = dashboards.filter((d) => d.projectId === projectId);
    }
    return dashboards;
  }

  async deleteDashboard(dashboardId: string): Promise<void> {
    this.dashboards.delete(dashboardId);
  }

  // ===========================================================================
  // LOGGING
  // ===========================================================================

  log(entry: Omit<LogEntry, 'id' | 'timestamp'>): void {
    const logEntry: LogEntry = {
      ...entry,
      id: this.generateId(),
      timestamp: new Date().toISOString(),
    };

    this.logs.push(logEntry);

    // Keep last 10000 logs
    if (this.logs.length > 10000) {
      this.logs = this.logs.slice(-10000);
    }

    // Record metrics for log levels
    this.recordMetric({
      name: `logs.${entry.level}`,
      type: 'counter',
      value: 1,
      tags: { service: entry.service || 'default' },
    });
  }

  queryLogs(query: LogQuery): LogEntry[] {
    let results = this.logs.filter((log) => {
      if (log.projectId !== query.projectId) return false;

      const logTime = new Date(log.timestamp).getTime();
      const startTime = new Date(query.startTime).getTime();
      const endTime = new Date(query.endTime).getTime();

      if (logTime < startTime || logTime > endTime) return false;

      if (query.level && !query.level.includes(log.level)) return false;
      if (query.service && log.service !== query.service) return false;

      if (query.search) {
        const searchLower = query.search.toLowerCase();
        if (!log.message.toLowerCase().includes(searchLower)) return false;
      }

      return true;
    });

    // Sort by timestamp descending
    results.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply pagination
    if (query.offset) {
      results = results.slice(query.offset);
    }
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  // ===========================================================================
  // PERFORMANCE PROFILING
  // ===========================================================================

  async capturePerformanceProfile(
    projectId: string,
    environment: string
  ): Promise<PerformanceProfile> {
    const profileId = this.generateId();
    const startTime = Date.now();

    // Gather metrics from various sources
    const cpuMetric = this.getMetric('system.cpu.usage');
    const memoryMetric = this.getMetric('system.memory.usage');
    const diskMetric = this.getMetric('system.disk.usage');
    const requestsMetric = this.getMetric('http.requests.rate');
    const responseTimeMetric = this.getMetric('http.response_time');
    const errorRateMetric = this.getMetric('http.errors.rate');

    const profile: PerformanceProfile = {
      id: profileId,
      projectId,
      environment,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,

      cpu: {
        used: cpuMetric?.aggregation?.avg || 0,
        total: 100,
        percentage: cpuMetric?.aggregation?.avg || 0,
        unit: '%',
      },

      memory: {
        used: memoryMetric?.aggregation?.avg || 0,
        total: 100,
        percentage: memoryMetric?.aggregation?.avg || 0,
        unit: '%',
      },

      disk: {
        used: diskMetric?.aggregation?.avg || 0,
        total: 100,
        percentage: diskMetric?.aggregation?.avg || 0,
        unit: '%',
      },

      network: {
        bytesIn: 0,
        bytesOut: 0,
        requestsIn: 0,
        requestsOut: 0,
      },

      requestsPerSecond: requestsMetric?.aggregation?.avg || 0,
      averageResponseTime: responseTimeMetric?.aggregation?.avg || 0,
      errorRate: errorRateMetric?.aggregation?.avg || 0,
      activeConnections: 0,

      endpoints: [],
      dependencies: [],
    };

    return profile;
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  private generateId(): string {
    return `mon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  cleanup(): void {
    // Clear all intervals
    for (const interval of this.checkIntervals.values()) {
      clearInterval(interval);
    }
    this.checkIntervals.clear();

    if (this.alertEvaluationInterval) {
      clearInterval(this.alertEvaluationInterval);
    }
  }
}

// Export singleton
export const monitoring = MonitoringService.getInstance();
