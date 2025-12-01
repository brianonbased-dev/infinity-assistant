/**
 * Payment & Billing Service
 *
 * Handles Stripe integration, subscription management, usage metering,
 * invoicing, and credit system for the platform.
 */

// =============================================================================
// TYPES
// =============================================================================

export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'trialing'
  | 'paused';

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'disputed';

export type BillingInterval = 'monthly' | 'yearly';

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  tier: PlanTier;
  prices: PlanPrice[];
  features: PlanFeature[];
  limits: PlanLimits;
  trialDays: number;
  popular?: boolean;
  enterprise?: boolean;
}

export type PlanTier = 'free' | 'starter' | 'growth' | 'scale' | 'enterprise';

export interface PlanPrice {
  id: string;
  interval: BillingInterval;
  amount: number; // cents
  currency: string;
  stripeId?: string;
}

export interface PlanFeature {
  name: string;
  description: string;
  included: boolean;
  limit?: number;
  unit?: string;
}

export interface PlanLimits {
  projects: number;
  collaborators: number;
  deployments: number;
  builds: number;
  storage: number; // MB
  bandwidth: number; // MB
  agents: number;
  apiCalls: number;
  supportLevel: 'community' | 'email' | 'priority' | 'dedicated';
}

export interface Customer {
  id: string;
  userId: string;
  email: string;
  name: string;
  stripeCustomerId?: string;
  subscription?: Subscription;
  paymentMethods: PaymentMethod[];
  credits: CreditBalance;
  billingAddress?: BillingAddress;
  taxIds?: TaxId[];
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  customerId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEnd?: string;
  stripeSubscriptionId?: string;
  items: SubscriptionItem[];
  discount?: Discount;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionItem {
  id: string;
  priceId: string;
  quantity: number;
}

export interface Discount {
  id: string;
  code: string;
  percentOff?: number;
  amountOff?: number;
  duration: 'once' | 'repeating' | 'forever';
  durationMonths?: number;
  expiresAt?: string;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account' | 'paypal';
  isDefault: boolean;
  card?: CardDetails;
  bankAccount?: BankDetails;
  stripePaymentMethodId?: string;
  createdAt: string;
}

export interface CardDetails {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  funding: 'credit' | 'debit' | 'prepaid';
}

export interface BankDetails {
  bankName: string;
  last4: string;
  accountType: 'checking' | 'savings';
}

export interface BillingAddress {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface TaxId {
  type: string;
  value: string;
  verified: boolean;
}

export interface CreditBalance {
  amount: number; // cents
  currency: string;
  lastUpdated: string;
  transactions: CreditTransaction[];
}

export interface CreditTransaction {
  id: string;
  type: 'purchase' | 'usage' | 'refund' | 'bonus' | 'adjustment';
  amount: number;
  description: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  customerId: string;
  subscriptionId?: string;
  number: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  amountDue: number;
  amountPaid: number;
  lineItems: InvoiceLineItem[];
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  paidAt?: string;
  stripeInvoiceId?: string;
  pdfUrl?: string;
  createdAt: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
  period?: { start: string; end: string };
}

export interface UsageRecord {
  id: string;
  customerId: string;
  metric: UsageMetric;
  quantity: number;
  timestamp: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
}

export type UsageMetric =
  | 'api_calls'
  | 'builds'
  | 'deployments'
  | 'storage_mb'
  | 'bandwidth_mb'
  | 'agent_minutes'
  | 'ai_tokens';

export interface UsageSummary {
  customerId: string;
  period: { start: string; end: string };
  metrics: Record<UsageMetric, UsageMetricSummary>;
}

export interface UsageMetricSummary {
  used: number;
  limit: number;
  percentage: number;
  overage: number;
  cost: number;
}

export interface CheckoutSession {
  id: string;
  customerId: string;
  planId: string;
  priceId: string;
  status: 'pending' | 'complete' | 'expired';
  url: string;
  expiresAt: string;
  stripeSessionId?: string;
  createdAt: string;
}

export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  data: unknown;
  processedAt?: string;
  error?: string;
}

export type WebhookEventType =
  | 'checkout.session.completed'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'invoice.payment_succeeded'
  | 'invoice.payment_failed'
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed';

// =============================================================================
// PRICING PLANS
// =============================================================================

const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Perfect for trying out the platform',
    tier: 'free',
    prices: [
      { id: 'free_monthly', interval: 'monthly', amount: 0, currency: 'usd' },
      { id: 'free_yearly', interval: 'yearly', amount: 0, currency: 'usd' },
    ],
    features: [
      { name: '1 Project', description: 'Create one project', included: true, limit: 1 },
      { name: 'Basic Builder', description: 'Access to basic AI builder', included: true },
      { name: 'Community Support', description: 'Community forum access', included: true },
      { name: 'Collaboration', description: 'Invite team members', included: false },
      { name: 'Custom Domains', description: 'Use your own domain', included: false },
    ],
    limits: {
      projects: 1,
      collaborators: 0,
      deployments: 3,
      builds: 10,
      storage: 100,
      bandwidth: 1000,
      agents: 0,
      apiCalls: 1000,
      supportLevel: 'community',
    },
    trialDays: 0,
  },
  {
    id: 'starter',
    name: 'Starter',
    description: 'For individuals and small projects',
    tier: 'starter',
    prices: [
      { id: 'starter_monthly', interval: 'monthly', amount: 2900, currency: 'usd' },
      { id: 'starter_yearly', interval: 'yearly', amount: 29000, currency: 'usd' },
    ],
    features: [
      { name: '5 Projects', description: 'Create up to 5 projects', included: true, limit: 5 },
      { name: 'Advanced Builder', description: 'Full AI builder features', included: true },
      { name: 'Email Support', description: '48-hour response time', included: true },
      { name: '2 Collaborators', description: 'Invite team members', included: true, limit: 2 },
      { name: 'Custom Domains', description: 'Use your own domain', included: true },
    ],
    limits: {
      projects: 5,
      collaborators: 2,
      deployments: 50,
      builds: 100,
      storage: 1000,
      bandwidth: 10000,
      agents: 1,
      apiCalls: 10000,
      supportLevel: 'email',
    },
    trialDays: 14,
    popular: true,
  },
  {
    id: 'growth',
    name: 'Growth',
    description: 'For growing teams and businesses',
    tier: 'growth',
    prices: [
      { id: 'growth_monthly', interval: 'monthly', amount: 7900, currency: 'usd' },
      { id: 'growth_yearly', interval: 'yearly', amount: 79000, currency: 'usd' },
    ],
    features: [
      { name: '20 Projects', description: 'Create up to 20 projects', included: true, limit: 20 },
      { name: 'Full Platform', description: 'All builder features', included: true },
      { name: 'Priority Support', description: '24-hour response time', included: true },
      { name: '10 Collaborators', description: 'Invite team members', included: true, limit: 10 },
      { name: '3 AI Agents', description: 'Autonomous agents', included: true, limit: 3 },
    ],
    limits: {
      projects: 20,
      collaborators: 10,
      deployments: 200,
      builds: 500,
      storage: 5000,
      bandwidth: 50000,
      agents: 3,
      apiCalls: 50000,
      supportLevel: 'priority',
    },
    trialDays: 14,
  },
  {
    id: 'scale',
    name: 'Scale',
    description: 'For large teams with advanced needs',
    tier: 'scale',
    prices: [
      { id: 'scale_monthly', interval: 'monthly', amount: 19900, currency: 'usd' },
      { id: 'scale_yearly', interval: 'yearly', amount: 199000, currency: 'usd' },
    ],
    features: [
      { name: 'Unlimited Projects', description: 'No project limits', included: true },
      { name: 'Enterprise Features', description: 'SSO, audit logs, etc.', included: true },
      { name: 'Dedicated Support', description: 'Slack channel', included: true },
      { name: 'Unlimited Collaborators', description: 'Invite unlimited team members', included: true },
      { name: '10 AI Agents', description: 'Autonomous agents', included: true, limit: 10 },
    ],
    limits: {
      projects: -1, // Unlimited
      collaborators: -1,
      deployments: -1,
      builds: 2000,
      storage: 20000,
      bandwidth: 200000,
      agents: 10,
      apiCalls: 200000,
      supportLevel: 'dedicated',
    },
    trialDays: 14,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Custom solutions for large organizations',
    tier: 'enterprise',
    prices: [
      { id: 'enterprise_monthly', interval: 'monthly', amount: 0, currency: 'usd' },
      { id: 'enterprise_yearly', interval: 'yearly', amount: 0, currency: 'usd' },
    ],
    features: [
      { name: 'Custom Everything', description: 'Tailored to your needs', included: true },
      { name: 'White Glove Setup', description: 'Full onboarding assistance', included: true },
      { name: 'Dedicated Success Manager', description: 'Personal account manager', included: true },
      { name: 'SLA', description: '99.99% uptime guarantee', included: true },
      { name: 'Custom Integrations', description: 'Built to your requirements', included: true },
    ],
    limits: {
      projects: -1,
      collaborators: -1,
      deployments: -1,
      builds: -1,
      storage: -1,
      bandwidth: -1,
      agents: -1,
      apiCalls: -1,
      supportLevel: 'dedicated',
    },
    trialDays: 30,
    enterprise: true,
  },
];

// =============================================================================
// USAGE PRICING
// =============================================================================

const OVERAGE_PRICING: Record<UsageMetric, number> = {
  api_calls: 0.001, // $0.001 per call
  builds: 0.50, // $0.50 per build
  deployments: 1.00, // $1.00 per deployment
  storage_mb: 0.02, // $0.02 per MB
  bandwidth_mb: 0.01, // $0.01 per MB
  agent_minutes: 0.10, // $0.10 per minute
  ai_tokens: 0.00001, // $0.00001 per token
};

// =============================================================================
// PAYMENT BILLING SERVICE
// =============================================================================

export class PaymentBillingService {
  private static instance: PaymentBillingService;
  private customers: Map<string, Customer> = new Map();
  private subscriptions: Map<string, Subscription> = new Map();
  private invoices: Map<string, Invoice> = new Map();
  private usageRecords: UsageRecord[] = [];
  private checkoutSessions: Map<string, CheckoutSession> = new Map();
  private stripeSecretKey?: string;

  private constructor() {
    this.stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  }

  static getInstance(): PaymentBillingService {
    if (!PaymentBillingService.instance) {
      PaymentBillingService.instance = new PaymentBillingService();
    }
    return PaymentBillingService.instance;
  }

  // ===========================================================================
  // PLANS
  // ===========================================================================

  getPlans(): PricingPlan[] {
    return PRICING_PLANS;
  }

  getPlan(planId: string): PricingPlan | undefined {
    return PRICING_PLANS.find((p) => p.id === planId);
  }

  getPlanByTier(tier: PlanTier): PricingPlan | undefined {
    return PRICING_PLANS.find((p) => p.tier === tier);
  }

  // ===========================================================================
  // CUSTOMERS
  // ===========================================================================

  async createCustomer(params: {
    userId: string;
    email: string;
    name: string;
  }): Promise<Customer> {
    const customerId = this.generateId();

    // Create Stripe customer
    let stripeCustomerId: string | undefined;
    if (this.stripeSecretKey) {
      try {
        const stripeCustomer = await this.createStripeCustomer(params.email, params.name);
        stripeCustomerId = stripeCustomer.id;
      } catch (error) {
        console.error('Failed to create Stripe customer:', error);
      }
    }

    const customer: Customer = {
      id: customerId,
      userId: params.userId,
      email: params.email,
      name: params.name,
      stripeCustomerId,
      paymentMethods: [],
      credits: {
        amount: 0,
        currency: 'usd',
        lastUpdated: new Date().toISOString(),
        transactions: [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.customers.set(customerId, customer);
    return customer;
  }

  async getCustomer(customerId: string): Promise<Customer | undefined> {
    return this.customers.get(customerId);
  }

  async getCustomerByUserId(userId: string): Promise<Customer | undefined> {
    return Array.from(this.customers.values()).find((c) => c.userId === userId);
  }

  async updateCustomer(customerId: string, updates: Partial<Customer>): Promise<Customer> {
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    Object.assign(customer, updates, { updatedAt: new Date().toISOString() });
    return customer;
  }

  // ===========================================================================
  // SUBSCRIPTIONS
  // ===========================================================================

  async createCheckoutSession(
    customerId: string,
    planId: string,
    interval: BillingInterval
  ): Promise<CheckoutSession> {
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    const plan = this.getPlan(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    const price = plan.prices.find((p) => p.interval === interval);
    if (!price) {
      throw new Error(`Price not found for interval: ${interval}`);
    }

    const sessionId = this.generateId();

    const session: CheckoutSession = {
      id: sessionId,
      customerId,
      planId,
      priceId: price.id,
      status: 'pending',
      url: `https://checkout.stripe.com/c/pay/${sessionId}`, // Simulated
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    };

    this.checkoutSessions.set(sessionId, session);

    return session;
  }

  async completeCheckout(sessionId: string): Promise<Subscription> {
    const session = this.checkoutSessions.get(sessionId);
    if (!session) {
      throw new Error(`Checkout session not found: ${sessionId}`);
    }

    session.status = 'complete';

    return this.createSubscription(session.customerId, session.planId, session.priceId);
  }

  async createSubscription(
    customerId: string,
    planId: string,
    priceId: string
  ): Promise<Subscription> {
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    const plan = this.getPlan(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    const subscriptionId = this.generateId();
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const subscription: Subscription = {
      id: subscriptionId,
      customerId,
      planId,
      status: plan.trialDays > 0 ? 'trialing' : 'active',
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      cancelAtPeriodEnd: false,
      trialEnd: plan.trialDays > 0
        ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000).toISOString()
        : undefined,
      items: [{ id: this.generateId(), priceId, quantity: 1 }],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    this.subscriptions.set(subscriptionId, subscription);
    customer.subscription = subscription;

    return subscription;
  }

  async cancelSubscription(subscriptionId: string, immediate: boolean = false): Promise<Subscription> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    if (immediate) {
      subscription.status = 'canceled';
    } else {
      subscription.cancelAtPeriodEnd = true;
    }

    subscription.updatedAt = new Date().toISOString();
    return subscription;
  }

  async updateSubscription(subscriptionId: string, planId: string): Promise<Subscription> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    const plan = this.getPlan(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    subscription.planId = planId;
    subscription.updatedAt = new Date().toISOString();

    return subscription;
  }

  async pauseSubscription(subscriptionId: string): Promise<Subscription> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    subscription.status = 'paused';
    subscription.updatedAt = new Date().toISOString();

    return subscription;
  }

  async resumeSubscription(subscriptionId: string): Promise<Subscription> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    subscription.status = 'active';
    subscription.updatedAt = new Date().toISOString();

    return subscription;
  }

  getSubscription(subscriptionId: string): Subscription | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  // ===========================================================================
  // PAYMENT METHODS
  // ===========================================================================

  async addPaymentMethod(
    customerId: string,
    paymentMethod: Omit<PaymentMethod, 'id' | 'createdAt'>
  ): Promise<PaymentMethod> {
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    const method: PaymentMethod = {
      ...paymentMethod,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
    };

    // If this is the first method or marked as default, update others
    if (method.isDefault) {
      customer.paymentMethods.forEach((m) => (m.isDefault = false));
    } else if (customer.paymentMethods.length === 0) {
      method.isDefault = true;
    }

    customer.paymentMethods.push(method);
    customer.updatedAt = new Date().toISOString();

    return method;
  }

  async removePaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    const index = customer.paymentMethods.findIndex((m) => m.id === paymentMethodId);
    if (index === -1) {
      throw new Error(`Payment method not found: ${paymentMethodId}`);
    }

    const removed = customer.paymentMethods.splice(index, 1)[0];

    // If we removed the default, set a new one
    if (removed.isDefault && customer.paymentMethods.length > 0) {
      customer.paymentMethods[0].isDefault = true;
    }

    customer.updatedAt = new Date().toISOString();
  }

  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    customer.paymentMethods.forEach((m) => {
      m.isDefault = m.id === paymentMethodId;
    });

    customer.updatedAt = new Date().toISOString();
  }

  // ===========================================================================
  // CREDITS
  // ===========================================================================

  async addCredits(
    customerId: string,
    amount: number,
    type: CreditTransaction['type'],
    description: string
  ): Promise<CreditBalance> {
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    const transaction: CreditTransaction = {
      id: this.generateId(),
      type,
      amount,
      description,
      createdAt: new Date().toISOString(),
    };

    customer.credits.amount += amount;
    customer.credits.lastUpdated = transaction.createdAt;
    customer.credits.transactions.push(transaction);

    // Keep last 100 transactions
    if (customer.credits.transactions.length > 100) {
      customer.credits.transactions = customer.credits.transactions.slice(-100);
    }

    return customer.credits;
  }

  async deductCredits(customerId: string, amount: number, description: string): Promise<CreditBalance> {
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    if (customer.credits.amount < amount) {
      throw new Error('Insufficient credits');
    }

    return this.addCredits(customerId, -amount, 'usage', description);
  }

  getCredits(customerId: string): CreditBalance | undefined {
    return this.customers.get(customerId)?.credits;
  }

  // ===========================================================================
  // USAGE METERING
  // ===========================================================================

  async recordUsage(
    customerId: string,
    metric: UsageMetric,
    quantity: number,
    projectId?: string
  ): Promise<UsageRecord> {
    const record: UsageRecord = {
      id: this.generateId(),
      customerId,
      metric,
      quantity,
      timestamp: new Date().toISOString(),
      projectId,
    };

    this.usageRecords.push(record);
    return record;
  }

  async getUsageSummary(
    customerId: string,
    startDate: string,
    endDate: string
  ): Promise<UsageSummary> {
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    const plan = customer.subscription
      ? this.getPlan(customer.subscription.planId)
      : this.getPlan('free');

    if (!plan) {
      throw new Error('Plan not found');
    }

    const records = this.usageRecords.filter(
      (r) =>
        r.customerId === customerId &&
        r.timestamp >= startDate &&
        r.timestamp <= endDate
    );

    const metrics: Record<UsageMetric, UsageMetricSummary> = {} as Record<UsageMetric, UsageMetricSummary>;

    const metricTypes: UsageMetric[] = [
      'api_calls',
      'builds',
      'deployments',
      'storage_mb',
      'bandwidth_mb',
      'agent_minutes',
      'ai_tokens',
    ];

    for (const metric of metricTypes) {
      const used = records
        .filter((r) => r.metric === metric)
        .reduce((sum, r) => sum + r.quantity, 0);

      const limitKey = this.metricToLimitKey(metric);
      const limit = plan.limits[limitKey as keyof PlanLimits] as number;
      const percentage = limit > 0 ? (used / limit) * 100 : 0;
      const overage = Math.max(0, used - limit);
      const cost = overage * OVERAGE_PRICING[metric];

      metrics[metric] = { used, limit, percentage, overage, cost };
    }

    return {
      customerId,
      period: { start: startDate, end: endDate },
      metrics,
    };
  }

  private metricToLimitKey(metric: UsageMetric): string {
    const mapping: Record<UsageMetric, string> = {
      api_calls: 'apiCalls',
      builds: 'builds',
      deployments: 'deployments',
      storage_mb: 'storage',
      bandwidth_mb: 'bandwidth',
      agent_minutes: 'agents',
      ai_tokens: 'apiCalls',
    };
    return mapping[metric];
  }

  // ===========================================================================
  // INVOICES
  // ===========================================================================

  async generateInvoice(customerId: string, subscriptionId?: string): Promise<Invoice> {
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    const subscription = subscriptionId
      ? this.subscriptions.get(subscriptionId)
      : customer.subscription;

    const invoiceId = this.generateId();
    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 30);

    const lineItems: InvoiceLineItem[] = [];

    // Add subscription charge
    if (subscription) {
      const plan = this.getPlan(subscription.planId);
      if (plan) {
        const price = plan.prices[0];
        lineItems.push({
          id: this.generateId(),
          description: `${plan.name} Subscription`,
          quantity: 1,
          unitAmount: price.amount,
          amount: price.amount,
          period: {
            start: subscription.currentPeriodStart,
            end: subscription.currentPeriodEnd,
          },
        });
      }
    }

    // Calculate usage charges
    const usageSummary = await this.getUsageSummary(
      customerId,
      subscription?.currentPeriodStart || now.toISOString(),
      subscription?.currentPeriodEnd || now.toISOString()
    );

    for (const [metric, summary] of Object.entries(usageSummary.metrics)) {
      if (summary.cost > 0) {
        lineItems.push({
          id: this.generateId(),
          description: `${metric} overage (${summary.overage} units)`,
          quantity: summary.overage,
          unitAmount: Math.round(OVERAGE_PRICING[metric as UsageMetric] * 100),
          amount: Math.round(summary.cost * 100),
        });
      }
    }

    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const tax = Math.round(subtotal * 0.0); // 0% tax for now
    const total = subtotal + tax;

    const invoice: Invoice = {
      id: invoiceId,
      customerId,
      subscriptionId: subscription?.id,
      number: `INV-${Date.now()}`,
      status: 'open',
      currency: 'usd',
      subtotal,
      tax,
      total,
      amountDue: total,
      amountPaid: 0,
      lineItems,
      periodStart: subscription?.currentPeriodStart || now.toISOString(),
      periodEnd: subscription?.currentPeriodEnd || now.toISOString(),
      dueDate: dueDate.toISOString(),
      createdAt: now.toISOString(),
    };

    this.invoices.set(invoiceId, invoice);
    return invoice;
  }

  async payInvoice(invoiceId: string, paymentMethodId: string): Promise<Invoice> {
    const invoice = this.invoices.get(invoiceId);
    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    const customer = this.customers.get(invoice.customerId);
    if (!customer) {
      throw new Error(`Customer not found: ${invoice.customerId}`);
    }

    const paymentMethod = customer.paymentMethods.find((m) => m.id === paymentMethodId);
    if (!paymentMethod) {
      throw new Error(`Payment method not found: ${paymentMethodId}`);
    }

    // Process payment (simulated)
    invoice.status = 'paid';
    invoice.amountPaid = invoice.total;
    invoice.amountDue = 0;
    invoice.paidAt = new Date().toISOString();

    return invoice;
  }

  getInvoice(invoiceId: string): Invoice | undefined {
    return this.invoices.get(invoiceId);
  }

  listInvoices(customerId: string): Invoice[] {
    return Array.from(this.invoices.values())
      .filter((i) => i.customerId === customerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // ===========================================================================
  // DISCOUNTS
  // ===========================================================================

  async applyDiscount(subscriptionId: string, code: string): Promise<Discount | null> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    // Validate discount code (simulated)
    const discounts: Record<string, Discount> = {
      LAUNCH50: {
        id: 'disc_launch50',
        code: 'LAUNCH50',
        percentOff: 50,
        duration: 'once',
      },
      ANNUAL20: {
        id: 'disc_annual20',
        code: 'ANNUAL20',
        percentOff: 20,
        duration: 'forever',
      },
    };

    const discount = discounts[code.toUpperCase()];
    if (!discount) {
      return null;
    }

    subscription.discount = discount;
    subscription.updatedAt = new Date().toISOString();

    return discount;
  }

  // ===========================================================================
  // WEBHOOKS
  // ===========================================================================

  async handleWebhook(event: WebhookEvent): Promise<void> {
    event.processedAt = new Date().toISOString();

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data);
          break;
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data);
          break;
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data);
          break;
        default:
          console.log(`Unhandled webhook event: ${event.type}`);
      }
    } catch (error) {
      event.error = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  private async handleCheckoutCompleted(data: unknown): Promise<void> {
    const sessionId = (data as { sessionId: string }).sessionId;
    if (sessionId) {
      await this.completeCheckout(sessionId);
    }
  }

  private async handleSubscriptionUpdated(data: unknown): Promise<void> {
    const { subscriptionId, status } = data as { subscriptionId: string; status: SubscriptionStatus };
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.status = status;
      subscription.updatedAt = new Date().toISOString();
    }
  }

  private async handleSubscriptionDeleted(data: unknown): Promise<void> {
    const subscriptionId = (data as { subscriptionId: string }).subscriptionId;
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.status = 'canceled';
      subscription.updatedAt = new Date().toISOString();
    }
  }

  private async handlePaymentSucceeded(data: unknown): Promise<void> {
    const invoiceId = (data as { invoiceId: string }).invoiceId;
    const invoice = this.invoices.get(invoiceId);
    if (invoice) {
      invoice.status = 'paid';
      invoice.paidAt = new Date().toISOString();
    }
  }

  private async handlePaymentFailed(data: unknown): Promise<void> {
    const invoiceId = (data as { invoiceId: string }).invoiceId;
    const invoice = this.invoices.get(invoiceId);
    if (invoice) {
      invoice.status = 'open';
    }

    // Update subscription status
    const customerId = invoice?.customerId;
    if (customerId) {
      const customer = this.customers.get(customerId);
      if (customer?.subscription) {
        customer.subscription.status = 'past_due';
      }
    }
  }

  // ===========================================================================
  // STRIPE INTEGRATION
  // ===========================================================================

  private async createStripeCustomer(email: string, name: string): Promise<{ id: string }> {
    if (!this.stripeSecretKey) {
      return { id: `cus_simulated_${Date.now()}` };
    }

    const response = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ email, name }),
    });

    return response.json();
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private generateId(): string {
    return `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton
export const paymentBilling = PaymentBillingService.getInstance();
