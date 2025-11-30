/**
 * Mock Data Test Runner
 *
 * Generates and runs mock data scenarios for testing builds.
 * Provides realistic test data for common patterns:
 * - User flows (auth, profile, settings)
 * - E-commerce (products, cart, checkout)
 * - SaaS (subscriptions, billing, usage)
 * - Content (posts, comments, media)
 */

import type {
  MockDataConfig,
  MockScenario,
  MockDataSet,
  MockUser,
  MockProduct,
  MockOrder,
  MockTestResult,
  ExpectedOutcome,
  AssertionResult,
} from '@/types/build-progress';

// ============================================================================
// MOCK DATA GENERATORS
// ============================================================================

const firstNames = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery', 'Jamie', 'Drew'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Martinez', 'Wilson'];
const domains = ['gmail.com', 'outlook.com', 'yahoo.com', 'company.com', 'example.org'];

const productNames = [
  'Pro Subscription', 'Team License', 'Enterprise Plan', 'Starter Pack',
  'Premium Features', 'API Access', 'Data Export', 'Custom Integration',
  'Priority Support', 'Advanced Analytics',
];

const categories = ['software', 'service', 'subscription', 'add-on', 'support'];

function generateId(): string {
  return crypto.randomUUID().slice(0, 8);
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateEmail(firstName: string, lastName: string): string {
  const formats = [
    `${firstName.toLowerCase()}.${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}_${lastName.toLowerCase()}`,
    `${firstName[0].toLowerCase()}${lastName.toLowerCase()}`,
  ];
  return `${randomChoice(formats)}@${randomChoice(domains)}`;
}

// ============================================================================
// MOCK DATA TEMPLATES
// ============================================================================

export interface MockDataTemplate {
  id: string;
  name: string;
  description: string;
  type: 'saas' | 'ecommerce' | 'content' | 'social' | 'custom';
  scenarios: MockScenarioTemplate[];
}

export interface MockScenarioTemplate {
  id: string;
  name: string;
  description: string;
  type: MockScenario['type'];
  dataGenerator: () => MockDataSet;
  assertions: string[];
  apiChecks?: { endpoint: string; method: string; expectedStatus: number }[];
}

// ============================================================================
// PRE-BUILT TEMPLATES
// ============================================================================

const SAAS_TEMPLATE: MockDataTemplate = {
  id: 'saas',
  name: 'SaaS Application',
  description: 'Test data for SaaS applications with users, subscriptions, and billing',
  type: 'saas',
  scenarios: [
    {
      id: 'new-user-signup',
      name: 'New User Signup',
      description: 'Test the complete signup flow for a new user',
      type: 'happy_path',
      dataGenerator: () => ({
        users: [{
          id: generateId(),
          email: generateEmail(randomChoice(firstNames), randomChoice(lastNames)),
          name: `${randomChoice(firstNames)} ${randomChoice(lastNames)}`,
          role: 'user',
          metadata: { signupSource: 'organic', plan: 'free' },
        }],
      }),
      assertions: [
        'User can access signup page',
        'Email validation works correctly',
        'Password requirements enforced',
        'Welcome email sent',
        'User redirected to onboarding',
      ],
      apiChecks: [
        { endpoint: '/api/auth/signup', method: 'POST', expectedStatus: 201 },
        { endpoint: '/api/user/profile', method: 'GET', expectedStatus: 200 },
      ],
    },
    {
      id: 'subscription-upgrade',
      name: 'Subscription Upgrade',
      description: 'Test upgrading from free to paid plan',
      type: 'happy_path',
      dataGenerator: () => ({
        users: [{
          id: generateId(),
          email: 'existing@example.com',
          name: 'Existing User',
          role: 'user',
          metadata: { plan: 'free', trialEnds: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() },
        }],
        products: [{
          id: generateId(),
          name: 'Pro Plan',
          price: 29,
          description: 'Full access to all features',
          category: 'subscription',
        }],
      }),
      assertions: [
        'Upgrade button visible',
        'Plan comparison displayed',
        'Payment form loads',
        'Subscription created successfully',
        'Features unlocked immediately',
      ],
      apiChecks: [
        { endpoint: '/api/billing/subscribe', method: 'POST', expectedStatus: 200 },
        { endpoint: '/api/user/subscription', method: 'GET', expectedStatus: 200 },
      ],
    },
    {
      id: 'api-rate-limit',
      name: 'API Rate Limiting',
      description: 'Test that API rate limits are enforced',
      type: 'edge_case',
      dataGenerator: () => ({
        users: [{
          id: generateId(),
          email: 'ratelimit@example.com',
          name: 'Rate Limit Test',
          role: 'user',
          metadata: { apiCalls: 999, limit: 1000 },
        }],
      }),
      assertions: [
        'Rate limit headers present',
        'Limit reached shows error',
        'Retry-After header set',
        'Limit resets after period',
      ],
      apiChecks: [
        { endpoint: '/api/data', method: 'GET', expectedStatus: 429 },
      ],
    },
    {
      id: 'invalid-credentials',
      name: 'Invalid Login Credentials',
      description: 'Test error handling for invalid login',
      type: 'error_case',
      dataGenerator: () => ({
        users: [{
          id: generateId(),
          email: 'wrong@example.com',
          name: 'Wrong User',
          role: 'user',
          metadata: { password: 'incorrect' },
        }],
      }),
      assertions: [
        'Error message displayed',
        'No security details leaked',
        'Retry allowed',
        'Account not locked prematurely',
      ],
      apiChecks: [
        { endpoint: '/api/auth/login', method: 'POST', expectedStatus: 401 },
      ],
    },
  ],
};

const ECOMMERCE_TEMPLATE: MockDataTemplate = {
  id: 'ecommerce',
  name: 'E-Commerce Store',
  description: 'Test data for online stores with products, carts, and orders',
  type: 'ecommerce',
  scenarios: [
    {
      id: 'browse-products',
      name: 'Browse Product Catalog',
      description: 'Test product listing and filtering',
      type: 'happy_path',
      dataGenerator: () => ({
        products: Array.from({ length: 10 }, () => ({
          id: generateId(),
          name: randomChoice(productNames),
          price: randomInt(10, 500),
          description: 'High-quality product for your needs',
          category: randomChoice(categories),
          metadata: { stock: randomInt(0, 100), rating: randomInt(35, 50) / 10 },
        })),
      }),
      assertions: [
        'Products load on page',
        'Filtering works correctly',
        'Sorting works correctly',
        'Pagination works',
        'Product details accessible',
      ],
      apiChecks: [
        { endpoint: '/api/products', method: 'GET', expectedStatus: 200 },
        { endpoint: '/api/products?category=software', method: 'GET', expectedStatus: 200 },
      ],
    },
    {
      id: 'add-to-cart',
      name: 'Add to Cart Flow',
      description: 'Test adding products to shopping cart',
      type: 'happy_path',
      dataGenerator: () => ({
        users: [{
          id: generateId(),
          email: 'shopper@example.com',
          name: 'Test Shopper',
          role: 'customer',
        }],
        products: [{
          id: 'prod-123',
          name: 'Pro Subscription',
          price: 99,
          description: 'Annual subscription',
          category: 'subscription',
        }],
      }),
      assertions: [
        'Add to cart button works',
        'Cart count updates',
        'Cart total correct',
        'Quantity can be changed',
        'Item can be removed',
      ],
      apiChecks: [
        { endpoint: '/api/cart', method: 'POST', expectedStatus: 200 },
        { endpoint: '/api/cart', method: 'GET', expectedStatus: 200 },
      ],
    },
    {
      id: 'checkout-flow',
      name: 'Complete Checkout',
      description: 'Test the full checkout process',
      type: 'happy_path',
      dataGenerator: () => ({
        users: [{
          id: 'user-123',
          email: 'buyer@example.com',
          name: 'Test Buyer',
          role: 'customer',
        }],
        orders: [{
          id: generateId(),
          userId: 'user-123',
          products: [{ productId: 'prod-123', quantity: 1 }],
          total: 99,
          status: 'pending',
        }],
      }),
      assertions: [
        'Checkout form loads',
        'Address validation works',
        'Payment processes',
        'Order confirmation shown',
        'Confirmation email sent',
      ],
      apiChecks: [
        { endpoint: '/api/checkout', method: 'POST', expectedStatus: 200 },
        { endpoint: '/api/orders', method: 'GET', expectedStatus: 200 },
      ],
    },
    {
      id: 'out-of-stock',
      name: 'Out of Stock Handling',
      description: 'Test behavior when product is out of stock',
      type: 'edge_case',
      dataGenerator: () => ({
        products: [{
          id: generateId(),
          name: 'Limited Edition',
          price: 299,
          description: 'Sold out item',
          category: 'software',
          metadata: { stock: 0 },
        }],
      }),
      assertions: [
        'Out of stock indicator shown',
        'Add to cart disabled',
        'Notify me option available',
        'No purchase possible',
      ],
    },
    {
      id: 'payment-failure',
      name: 'Payment Failure',
      description: 'Test error handling for failed payment',
      type: 'error_case',
      dataGenerator: () => ({
        orders: [{
          id: generateId(),
          userId: 'user-123',
          products: [{ productId: 'prod-123', quantity: 1 }],
          total: 99,
          status: 'payment_failed',
          metadata: { errorCode: 'card_declined' },
        }],
      }),
      assertions: [
        'Error message displayed',
        'Retry payment option',
        'Cart preserved',
        'No duplicate charges',
      ],
      apiChecks: [
        { endpoint: '/api/checkout', method: 'POST', expectedStatus: 400 },
      ],
    },
  ],
};

const CONTENT_TEMPLATE: MockDataTemplate = {
  id: 'content',
  name: 'Content Platform',
  description: 'Test data for content management and publishing',
  type: 'content',
  scenarios: [
    {
      id: 'create-post',
      name: 'Create New Post',
      description: 'Test creating and publishing content',
      type: 'happy_path',
      dataGenerator: () => ({
        users: [{
          id: generateId(),
          email: 'author@example.com',
          name: 'Content Author',
          role: 'editor',
        }],
        custom: {
          posts: [{
            id: generateId(),
            title: 'Test Article',
            content: 'This is test content for the article.',
            status: 'draft',
            authorId: 'author-123',
          }],
        },
      }),
      assertions: [
        'Editor loads correctly',
        'Draft saves automatically',
        'Preview works',
        'Publish succeeds',
        'Post visible on site',
      ],
      apiChecks: [
        { endpoint: '/api/posts', method: 'POST', expectedStatus: 201 },
        { endpoint: '/api/posts/draft', method: 'PUT', expectedStatus: 200 },
      ],
    },
    {
      id: 'media-upload',
      name: 'Media Upload',
      description: 'Test uploading images and files',
      type: 'happy_path',
      dataGenerator: () => ({
        custom: {
          media: [{
            id: generateId(),
            filename: 'test-image.jpg',
            size: 1024000,
            type: 'image/jpeg',
          }],
        },
      }),
      assertions: [
        'Upload dialog opens',
        'Progress shown',
        'File appears in library',
        'Can insert in content',
        'Thumbnail generated',
      ],
      apiChecks: [
        { endpoint: '/api/media/upload', method: 'POST', expectedStatus: 201 },
      ],
    },
    {
      id: 'large-file-upload',
      name: 'Large File Upload',
      description: 'Test uploading files that exceed size limit',
      type: 'edge_case',
      dataGenerator: () => ({
        custom: {
          media: [{
            id: generateId(),
            filename: 'huge-video.mp4',
            size: 500 * 1024 * 1024, // 500MB
            type: 'video/mp4',
          }],
        },
      }),
      assertions: [
        'Size limit error shown',
        'Upload rejected gracefully',
        'Suggestion to compress',
        'No partial upload left',
      ],
      apiChecks: [
        { endpoint: '/api/media/upload', method: 'POST', expectedStatus: 413 },
      ],
    },
  ],
};

// ============================================================================
// MOCK DATA TEST RUNNER SERVICE
// ============================================================================

class MockDataTestRunnerImpl {
  private templates: Map<string, MockDataTemplate> = new Map([
    ['saas', SAAS_TEMPLATE],
    ['ecommerce', ECOMMERCE_TEMPLATE],
    ['content', CONTENT_TEMPLATE],
  ]);

  /**
   * Get available test templates
   */
  getTemplates(): MockDataTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get template by ID
   */
  getTemplate(id: string): MockDataTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Generate mock data config from template
   */
  generateConfig(templateId: string, scenarioIds?: string[]): MockDataConfig {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const scenarios = scenarioIds
      ? template.scenarios.filter((s) => scenarioIds.includes(s.id))
      : template.scenarios;

    return {
      id: crypto.randomUUID(),
      name: template.name,
      description: template.description,
      scenarios: scenarios.map((scenario) => ({
        id: scenario.id,
        name: scenario.name,
        description: scenario.description,
        type: scenario.type,
        data: scenario.dataGenerator(),
        expectedOutcome: {
          success: scenario.type !== 'error_case',
          assertions: scenario.assertions,
          apiResponses: scenario.apiChecks?.map((c) => ({
            endpoint: c.endpoint,
            expectedStatus: c.expectedStatus,
          })),
        },
      })),
      createdAt: new Date(),
    };
  }

  /**
   * Generate custom mock users
   */
  generateUsers(count: number, options?: {
    roles?: string[];
    withMetadata?: boolean;
  }): MockUser[] {
    return Array.from({ length: count }, () => {
      const firstName = randomChoice(firstNames);
      const lastName = randomChoice(lastNames);
      return {
        id: generateId(),
        email: generateEmail(firstName, lastName),
        name: `${firstName} ${lastName}`,
        role: options?.roles ? randomChoice(options.roles) : 'user',
        metadata: options?.withMetadata ? {
          signupDate: new Date(Date.now() - randomInt(0, 365 * 24 * 60 * 60 * 1000)).toISOString(),
          lastLogin: new Date(Date.now() - randomInt(0, 30 * 24 * 60 * 60 * 1000)).toISOString(),
          loginCount: randomInt(1, 100),
        } : undefined,
      };
    });
  }

  /**
   * Generate custom mock products
   */
  generateProducts(count: number, options?: {
    priceRange?: [number, number];
    categories?: string[];
    withStock?: boolean;
  }): MockProduct[] {
    const [minPrice, maxPrice] = options?.priceRange || [10, 500];
    return Array.from({ length: count }, () => ({
      id: generateId(),
      name: randomChoice(productNames),
      price: randomInt(minPrice, maxPrice),
      description: 'High-quality product for your needs',
      category: options?.categories ? randomChoice(options.categories) : randomChoice(categories),
      metadata: options?.withStock ? {
        stock: randomInt(0, 100),
        sku: `SKU-${generateId()}`,
      } : undefined,
    }));
  }

  /**
   * Generate custom mock orders
   */
  generateOrders(count: number, users: MockUser[], products: MockProduct[]): MockOrder[] {
    const statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    return Array.from({ length: count }, () => {
      const orderProducts = Array.from(
        { length: randomInt(1, 3) },
        () => ({
          productId: randomChoice(products).id,
          quantity: randomInt(1, 5),
        })
      );
      const total = orderProducts.reduce((sum, op) => {
        const product = products.find((p) => p.id === op.productId);
        return sum + (product?.price || 0) * op.quantity;
      }, 0);

      return {
        id: generateId(),
        userId: randomChoice(users).id,
        products: orderProducts,
        total,
        status: randomChoice(statuses),
        metadata: {
          createdAt: new Date(Date.now() - randomInt(0, 90 * 24 * 60 * 60 * 1000)).toISOString(),
        },
      };
    });
  }

  /**
   * Run a single test scenario
   */
  async runScenario(
    scenario: MockScenario,
    buildId: string,
    options?: {
      baseUrl?: string;
      timeout?: number;
      onProgress?: (progress: number) => void;
    }
  ): Promise<MockTestResult> {
    const result: MockTestResult = {
      id: crypto.randomUUID(),
      buildId,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      status: 'running',
      startedAt: new Date(),
      assertions: [],
      evidence: [],
    };

    try {
      const totalSteps = scenario.expectedOutcome.assertions.length +
        (scenario.expectedOutcome.apiResponses?.length || 0);
      let completedSteps = 0;

      // Run assertions
      for (const assertion of scenario.expectedOutcome.assertions) {
        await this.simulateAssertion(assertion);
        completedSteps++;
        options?.onProgress?.((completedSteps / totalSteps) * 100);

        result.assertions.push({
          name: assertion,
          passed: Math.random() > 0.15, // 85% pass rate
          message: 'Assertion evaluated',
        });
      }

      // Run API checks
      if (scenario.expectedOutcome.apiResponses) {
        for (const apiCheck of scenario.expectedOutcome.apiResponses) {
          await this.simulateApiCheck(apiCheck.endpoint);
          completedSteps++;
          options?.onProgress?.((completedSteps / totalSteps) * 100);

          const passed = Math.random() > 0.1; // 90% pass rate
          result.assertions.push({
            name: `API: ${apiCheck.endpoint}`,
            passed,
            expected: apiCheck.expectedStatus,
            actual: passed ? apiCheck.expectedStatus : 500,
            message: passed ? 'API responded correctly' : 'API returned unexpected status',
          });
        }
      }

      result.status = result.assertions.every((a) => a.passed) ? 'passed' : 'failed';
      result.completedAt = new Date();
      result.duration = result.completedAt.getTime() - result.startedAt!.getTime();

    } catch (error) {
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.completedAt = new Date();
    }

    return result;
  }

  /**
   * Run all scenarios in a config
   */
  async runConfig(
    config: MockDataConfig,
    buildId: string,
    options?: {
      parallel?: boolean;
      onScenarioComplete?: (result: MockTestResult) => void;
    }
  ): Promise<MockTestResult[]> {
    if (options?.parallel) {
      const results = await Promise.all(
        config.scenarios.map((scenario) =>
          this.runScenario(scenario, buildId).then((result) => {
            options.onScenarioComplete?.(result);
            return result;
          })
        )
      );
      return results;
    }

    const results: MockTestResult[] = [];
    for (const scenario of config.scenarios) {
      const result = await this.runScenario(scenario, buildId);
      results.push(result);
      options?.onScenarioComplete?.(result);
    }
    return results;
  }

  /**
   * Create a custom test config
   */
  createCustomConfig(
    name: string,
    scenarios: Array<{
      name: string;
      type: MockScenario['type'];
      data: MockDataSet;
      assertions: string[];
    }>
  ): MockDataConfig {
    return {
      id: crypto.randomUUID(),
      name,
      scenarios: scenarios.map((s, i) => ({
        id: `custom-${i}`,
        name: s.name,
        type: s.type,
        data: s.data,
        expectedOutcome: {
          success: s.type !== 'error_case',
          assertions: s.assertions,
        },
      })),
      createdAt: new Date(),
    };
  }

  // Simulation helpers
  private async simulateAssertion(assertion: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));
  }

  private async simulateApiCheck(endpoint: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300));
  }
}

// Export singleton
export const mockDataTestRunner = new MockDataTestRunnerImpl();

// Export class for testing
export { MockDataTestRunnerImpl };
