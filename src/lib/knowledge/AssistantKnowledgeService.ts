/**
 * Assistant Knowledge Service
 *
 * Core service for managing the Assistant's knowledge base.
 * Implements the uAA2++ 8-Phase Protocol for:
 * - Phase-aware conversation context
 * - Knowledge loading and caching
 * - Relevance-based retrieval
 *
 * This service loads compressed wisdom from research and makes it
 * available for consistent, knowledge-rich conversations.
 */

import type {
  KnowledgeBase,
  WisdomEntry,
  PatternEntry,
  GotchaEntry,
  KnowledgeLoadOptions,
  KnowledgeSearchResult,
  KnowledgeDomain,
  AssistantContext,
  IKnowledgeService,
} from './types';

// ============================================================================
// EMBEDDED KNOWLEDGE
// ============================================================================

/**
 * Core wisdom embedded in the assistant
 * These are the most critical pieces of knowledge that should always be available
 */
const CORE_WISDOM: WisdomEntry[] = [
  // Conversational AI Wisdom
  {
    id: 'W.CONV.001',
    title: 'NLU + NLG Integration',
    wisdom: 'Natural Language Understanding and Generation must be deeply integrated, not separate systems. The feedback loop between them enables continuous improvement.',
    application: 'Design conversational AI with shared context representations between understanding and generation.',
    domain: 'conversational-ai',
  },
  {
    id: 'W.CONV.003',
    title: 'Self-Model for Identity',
    wisdom: 'A robust self-model maintains coherent identity and personality across all interactions. This creates trust and natural dialogue flow.',
    application: 'Build self-model architectures that encode identity vectors, maintain personality consistency, and track capability awareness.',
    domain: 'conversational-ai',
  },
  {
    id: 'W.CONV.004',
    title: 'Hierarchical Memory',
    wisdom: 'Extended memory requires hierarchical organization, not flat storage. Essential information must be quickly accessible while less critical data can be compressed.',
    application: 'Implement memory systems with importance-based hierarchies, compression for older data, and semantic search for retrieval.',
    domain: 'conversational-ai',
  },
  {
    id: 'W.CONV.006',
    title: 'Multimodal Emotion Processing',
    wisdom: 'True emotional intelligence requires processing multiple signals—text content, tone, context, and conversation history—not just sentiment analysis.',
    application: 'Build emotion recognition that processes multiple signals simultaneously and integrates into response generation.',
    domain: 'conversational-ai',
  },
  {
    id: 'W.CONV.008',
    title: 'Helpfulness Over Consciousness',
    wisdom: 'The goal is creating genuinely helpful, contextually aware AI systems—not replicating consciousness. Practical utility matters more than philosophical replication.',
    application: 'Focus on practical capabilities—understanding, responsiveness, personalization, reliability, and empathy.',
    domain: 'conversational-ai',
  },
  // AI Core Concepts Wisdom
  {
    id: 'W.AI.01',
    title: 'Technical-Ethical Integration',
    wisdom: 'AI development must integrate technical and ethical considerations from the start, not as an afterthought.',
    application: 'Include ethics in initial requirements and design. Regular ethical reviews throughout development.',
    domain: 'core-concepts',
  },
  {
    id: 'W.AI.03',
    title: 'Data Quality Foundation',
    wisdom: 'Addressing bias at the data level prevents downstream ethical issues. Data quality directly impacts bias and ethics.',
    application: 'Comprehensive data auditing, diverse datasets, bias mitigation from collection phase.',
    domain: 'core-concepts',
  },
  {
    id: 'W.AI.05',
    title: 'Transparency Enables Trust',
    wisdom: 'Explainability enables transparency, which builds trust, which enables adoption. Users need to understand AI to trust it.',
    application: 'Design with explainability in mind from the start, not as an add-on.',
    domain: 'core-concepts',
  },
  // Research and Learning Wisdom
  {
    id: 'W.RESEARCH.01',
    title: 'Multi-Paradigm Research',
    wisdom: 'Complex problems require multiple research paradigms. No single approach captures all aspects of reality.',
    application: 'Apply mixed methods, combining quantitative and qualitative approaches based on the problem.',
    domain: 'research-paradigms',
  },
  {
    id: 'W.LEARN.01',
    title: 'Active Learning Efficiency',
    wisdom: 'Strategic uncertainty identification focuses learning on high-value opportunities, not random questioning.',
    application: 'Implement confidence scoring and strategically solicit feedback on specific knowledge gaps.',
    domain: 'idiom-learning',
  },
  // Problem Solving Wisdom
  {
    id: 'W.PROBLEM.01',
    title: 'Continuous Problem Scanning',
    wisdom: 'Problems should be identified proactively through continuous scanning, not reactively after they cause issues.',
    application: 'Implement pattern recognition for early warning signs, monitor trends, and anticipate issues.',
    domain: 'problem-scanning',
  },
  {
    id: 'W.THINK.01',
    title: 'Multiple Thinking Modes',
    wisdom: 'Different problems require different thinking modes—analytical, creative, systems, critical, design, strategic.',
    application: 'Match thinking mode to problem type. Use multiple modes for complex problems.',
    domain: 'ways-of-thinking',
  },
  // Web Development Wisdom
  {
    id: 'W.WEB.01',
    title: 'Progressive Enhancement',
    wisdom: 'Build for the baseline first, then enhance. Core functionality should work without JavaScript, then add enhancements progressively.',
    application: 'Start with semantic HTML, add CSS for styling, JavaScript for interactivity. Test with JS disabled.',
    domain: 'web-development',
  },
  {
    id: 'W.WEB.02',
    title: 'Performance Budget',
    wisdom: 'Set and enforce performance budgets before development starts. Its easier to maintain performance than fix it later.',
    application: 'Define bundle size limits, time-to-interactive targets, and Core Web Vitals goals upfront.',
    domain: 'web-development',
  },
  {
    id: 'W.WEB.03',
    title: 'Mobile First Design',
    wisdom: 'Design for mobile constraints first, then expand for larger screens. This ensures core functionality is prioritized.',
    application: 'Start CSS with min-width media queries. Design for touch interactions first.',
    domain: 'web-development',
  },
  // React Wisdom
  {
    id: 'W.REACT.01',
    title: 'Component Composition Over Inheritance',
    wisdom: 'React components should be composed together, not extended. Composition is more flexible and easier to reason about.',
    application: 'Use props and children to compose components. Avoid class inheritance for code reuse.',
    domain: 'react',
  },
  {
    id: 'W.REACT.02',
    title: 'State Colocation',
    wisdom: 'Keep state as close as possible to where it is used. Only lift state up when multiple components need it.',
    application: 'Start with local state, lift up only when needed. Consider context for truly global state.',
    domain: 'react',
  },
  {
    id: 'W.REACT.03',
    title: 'Controlled vs Uncontrolled Components',
    wisdom: 'Prefer controlled components for form elements when you need to validate or transform input. Use uncontrolled for simple cases.',
    application: 'Use controlled inputs with useState for validation. Use refs for uncontrolled when validation is not needed.',
    domain: 'react',
  },
  // TypeScript Wisdom
  {
    id: 'W.TS.01',
    title: 'Type Inference First',
    wisdom: 'Let TypeScript infer types when possible. Only add explicit types when inference fails or for documentation.',
    application: 'Skip type annotations where inference works. Add types for function parameters, returns, and complex objects.',
    domain: 'typescript',
  },
  {
    id: 'W.TS.02',
    title: 'Strict Mode Always',
    wisdom: 'Enable strict mode from the start. Its much harder to add strictness to an existing codebase.',
    application: 'Set strict: true in tsconfig.json. Address all strict errors before they accumulate.',
    domain: 'typescript',
  },
  // Next.js Wisdom
  {
    id: 'W.NEXT.01',
    title: 'Server Components Default',
    wisdom: 'In Next.js 13+, components are Server Components by default. Only add use client when you need interactivity.',
    application: 'Keep data fetching in Server Components. Add use client only for hooks, browser APIs, or event handlers.',
    domain: 'nextjs',
  },
  {
    id: 'W.NEXT.02',
    title: 'Route Segment Config',
    wisdom: 'Use route segment config for caching and revalidation control. This gives fine-grained control over data freshness.',
    application: 'Export const revalidate, dynamic, fetchCache from route files to control caching behavior.',
    domain: 'nextjs',
  },
  // API Design Wisdom
  {
    id: 'W.API.01',
    title: 'REST Resource Naming',
    wisdom: 'Use nouns for resources, HTTP verbs for actions. Plural resource names (users, not user) are conventional.',
    application: 'GET /users, POST /users, GET /users/:id, PUT /users/:id, DELETE /users/:id',
    domain: 'api-design',
  },
  {
    id: 'W.API.02',
    title: 'Error Response Consistency',
    wisdom: 'Always return errors in a consistent format with useful information. Include error code, message, and details.',
    application: 'Return { error: { code: "VALIDATION_ERROR", message: "...", details: [...] } } consistently.',
    domain: 'api-design',
  },
  // Database Wisdom
  {
    id: 'W.DB.01',
    title: 'Index Before You Need It',
    wisdom: 'Add indexes on columns used in WHERE, JOIN, and ORDER BY clauses. Missing indexes are the #1 performance killer.',
    application: 'Analyze query patterns, add indexes proactively. Use EXPLAIN to verify index usage.',
    domain: 'database',
  },
  {
    id: 'W.DB.02',
    title: 'N+1 Query Prevention',
    wisdom: 'Batch data fetching to avoid N+1 queries. One query returning N items should not trigger N additional queries.',
    application: 'Use eager loading, data loaders, or batch APIs. Monitor query counts in development.',
    domain: 'database',
  },
  // Security Wisdom
  {
    id: 'W.SEC.01',
    title: 'Input Validation at Boundaries',
    wisdom: 'Validate and sanitize all input at system boundaries. Never trust user input, even from authenticated users.',
    application: 'Use zod or similar for validation. Sanitize HTML. Parameterize SQL queries.',
    domain: 'security',
  },
  {
    id: 'W.SEC.02',
    title: 'Principle of Least Privilege',
    wisdom: 'Grant minimum necessary permissions. Users, services, and tokens should only have access to what they need.',
    application: 'Create scoped API keys. Use role-based access control. Audit permissions regularly.',
    domain: 'security',
  },
  // Productivity & Life Wisdom
  {
    id: 'W.PROD.01',
    title: 'Time Blocking',
    wisdom: 'Schedule specific blocks of time for specific tasks. Context switching is expensive - batch similar work together.',
    application: 'Block 2-4 hour chunks for deep work. Group meetings together. Protect your most productive hours.',
    domain: 'productivity',
  },
  {
    id: 'W.PROD.02',
    title: '80/20 Principle (Pareto)',
    wisdom: '80% of results come from 20% of efforts. Focus on high-impact activities first.',
    application: 'Identify your highest-value activities. Say no to low-impact requests. Measure results, not busyness.',
    domain: 'productivity',
  },
  {
    id: 'W.PROD.03',
    title: 'Two-Minute Rule',
    wisdom: 'If a task takes less than two minutes, do it now. The overhead of tracking it exceeds doing it.',
    application: 'Apply to emails, quick requests, and small tasks. Queue larger tasks for dedicated time blocks.',
    domain: 'productivity',
  },
  // Business & Career Wisdom
  {
    id: 'W.BIZ.01',
    title: 'Value Before Revenue',
    wisdom: 'Create genuine value for customers before focusing on revenue. Revenue follows value.',
    application: 'Solve real problems first. Get feedback early. Pricing comes after product-market fit.',
    domain: 'business',
  },
  {
    id: 'W.BIZ.02',
    title: 'Start Small, Learn Fast',
    wisdom: 'Launch minimal versions quickly to learn from real users. Perfectionism delays learning.',
    application: 'MVP first, then iterate. Talk to users weekly. Measure what matters.',
    domain: 'business',
  },
  {
    id: 'W.BIZ.03',
    title: 'Network is Net Worth',
    wisdom: 'Professional relationships compound over time. Help others without expecting immediate return.',
    application: 'Give before you take. Stay in touch with former colleagues. Share knowledge generously.',
    domain: 'business',
  },
  {
    id: 'W.CAREER.01',
    title: 'Skills Stack Better Than Specialize',
    wisdom: 'Combining multiple skills creates unique value. Being top 10% in two skills beats top 1% in one.',
    application: 'Develop complementary skills (e.g., technical + communication). Build a unique skill combination.',
    domain: 'career',
  },
  {
    id: 'W.CAREER.02',
    title: 'Negotiate Everything',
    wisdom: 'Most offers are negotiable. The worst they can say is no, and you usually get something.',
    application: 'Research market rates. Ask confidently. Focus on total compensation, not just salary.',
    domain: 'career',
  },
  // Finance Wisdom
  {
    id: 'W.FIN.01',
    title: 'Pay Yourself First',
    wisdom: 'Automate savings before discretionary spending. What you dont see, you dont spend.',
    application: 'Set up automatic transfers on payday. Target 20% savings rate. Emergency fund first (3-6 months).',
    domain: 'finance',
  },
  {
    id: 'W.FIN.02',
    title: 'Compound Interest is Powerful',
    wisdom: 'Time in the market beats timing the market. Start early, stay consistent.',
    application: 'Start investing early, even small amounts. Reinvest dividends. Use index funds for simplicity.',
    domain: 'finance',
  },
  {
    id: 'W.FIN.03',
    title: 'Multiple Income Streams',
    wisdom: 'Diversify income sources to reduce risk. Side income provides security and optionality.',
    application: 'Explore freelancing, investments, digital products. Start while employed. Build gradually.',
    domain: 'finance',
  },
  // Health & Wellness Wisdom
  {
    id: 'W.HEALTH.01',
    title: 'Sleep is Non-Negotiable',
    wisdom: '7-9 hours of sleep improves everything - cognition, mood, health, productivity. Sleep deprivation has no upside.',
    application: 'Consistent bedtime. No screens 1hr before bed. Cool, dark room. No caffeine after 2pm.',
    domain: 'health',
  },
  {
    id: 'W.HEALTH.02',
    title: 'Movement Over Exercise',
    wisdom: 'Daily movement matters more than intense workouts. Consistency beats intensity.',
    application: 'Walk daily (10k steps). Take stairs. Stand while working. Exercise is bonus, movement is baseline.',
    domain: 'health',
  },
  {
    id: 'W.HEALTH.03',
    title: 'Nutrition Fundamentals',
    wisdom: 'Eat mostly whole foods. Avoid processed foods. No diet is magic - consistency and moderation work.',
    application: 'Cook more meals. Eat vegetables at every meal. Stay hydrated. Treat, dont cheat.',
    domain: 'health',
  },
  // Learning & Growth Wisdom
  {
    id: 'W.LEARN.02',
    title: 'Teach to Learn',
    wisdom: 'Teaching forces deep understanding. You discover gaps in knowledge when you try to explain.',
    application: 'Write about what you learn. Mentor others. Explain concepts to non-experts.',
    domain: 'learning',
  },
  {
    id: 'W.LEARN.03',
    title: 'Deliberate Practice',
    wisdom: 'Improvement requires focused practice at the edge of your ability, not just repetition.',
    application: 'Practice specific weaknesses. Get feedback. Push slightly beyond comfort zone. Quality over quantity.',
    domain: 'learning',
  },
  // Relationships & Communication
  {
    id: 'W.COMM.01',
    title: 'Listen to Understand',
    wisdom: 'Most people listen to respond, not understand. Active listening builds trust and insight.',
    application: 'Pause before responding. Ask clarifying questions. Summarize what you heard. Seek to understand first.',
    domain: 'communication',
  },
  {
    id: 'W.COMM.02',
    title: 'Clear is Kind',
    wisdom: 'Unclear expectations lead to frustration. Direct communication prevents misunderstanding.',
    application: 'Be specific about expectations. Give direct feedback. Ask for what you need clearly.',
    domain: 'communication',
  },
];

/**
 * Core patterns embedded in the assistant
 */
const CORE_PATTERNS: PatternEntry[] = [
  // Conversation Patterns
  {
    id: 'P.CONV.03',
    name: 'Hierarchical Memory Architecture',
    pattern: 'Organize memory hierarchically by importance and recency. Use compression for older data, semantic search for retrieval.',
    when: 'Building systems with long-term user memory, managing large conversation histories.',
    result: 'Efficient memory management, fast context retrieval, scalable to extended interactions.',
    domain: 'conversational-ai',
  },
  {
    id: 'P.CONV.04',
    name: 'Self-Model Identity Persistence',
    pattern: 'Maintain coherent AI identity through self-model architecture including identity vectors, capability awareness, and personality consistency.',
    when: 'Building AI assistants with personality, creating long-term user relationships.',
    result: 'Coherent AI identity, user trust, natural dialogue continuation.',
    domain: 'conversational-ai',
  },
  {
    id: 'P.CONV.08',
    name: 'Helpfulness-First Development',
    pattern: 'Focus on practical capabilities—understanding, responsiveness, personalization, reliability, empathy—measure success by user satisfaction.',
    when: 'Setting development priorities, defining success metrics.',
    result: 'Clear development focus, measurable success criteria.',
    domain: 'conversational-ai',
  },
  // Research Patterns
  {
    id: 'P.UAA2.01',
    name: 'uAA2++ 8-Phase Protocol',
    pattern: 'Intake → Reflect → Execute → Compress → Re-intake → Grow → Evolve → Autonomize. Each phase builds on the previous.',
    when: 'Complex research tasks, knowledge building, systematic learning.',
    result: 'Comprehensive knowledge acquisition, compressed wisdom, continuous improvement.',
    domain: 'research-paradigms',
  },
  {
    id: 'P.RESEARCH.01',
    name: 'Multi-Method Research',
    pattern: 'Combine multiple research methods based on problem type. Quantitative for measurement, qualitative for understanding, mixed for complex problems.',
    when: 'Complex research questions requiring multiple perspectives.',
    result: 'More complete understanding, validated findings.',
    domain: 'research-paradigms',
  },
  // AI Development Patterns
  {
    id: 'P.AI.04',
    name: 'Alignment-Safety-Guardrails Triad',
    pattern: 'Implement alignment, safety, and guardrails together. Each addresses different aspects of protection.',
    when: 'Building responsible AI systems.',
    result: 'Comprehensive multi-layer protection.',
    domain: 'core-concepts',
  },
  // Workflow Patterns
  {
    id: 'P.WORKFLOW.01',
    name: 'Research → Plan → Deliver',
    pattern: 'Research first (understand the problem), Plan second (design the solution), Deliver third (implement and ship).',
    when: 'Any multi-step project or feature development.',
    result: 'Well-informed solutions, clear execution path, quality delivery.',
    domain: 'general',
  },
  // React Patterns
  {
    id: 'P.REACT.01',
    name: 'Container/Presentational Pattern',
    pattern: 'Separate components into containers (data fetching, state) and presentational (rendering, props only).',
    when: 'Building complex UIs with reusable components.',
    result: 'Better separation of concerns, reusable UI components, easier testing.',
    domain: 'react',
  },
  {
    id: 'P.REACT.02',
    name: 'Custom Hook Extraction',
    pattern: 'Extract reusable stateful logic into custom hooks prefixed with use (useLocalStorage, useDebounce, etc.).',
    when: 'Sharing stateful logic between components.',
    result: 'Reusable logic, cleaner components, testable hooks.',
    domain: 'react',
  },
  {
    id: 'P.REACT.03',
    name: 'Compound Component Pattern',
    pattern: 'Create related components that work together via context (Tabs, TabList, Tab, TabPanel sharing state).',
    when: 'Building flexible component APIs like tabs, menus, accordions.',
    result: 'Flexible composition, clear relationships between components.',
    domain: 'react',
  },
  // Next.js Patterns
  {
    id: 'P.NEXT.01',
    name: 'Parallel Data Fetching',
    pattern: 'Use Promise.all or multiple async components to fetch data in parallel, not sequentially.',
    when: 'Pages requiring multiple independent data sources.',
    result: 'Faster page loads, reduced waterfall effect.',
    domain: 'nextjs',
  },
  {
    id: 'P.NEXT.02',
    name: 'Loading UI Pattern',
    pattern: 'Create loading.tsx files for route segments to show instant loading states during navigation.',
    when: 'Routes with data fetching that may take time.',
    result: 'Better perceived performance, no blank screens during navigation.',
    domain: 'nextjs',
  },
  // API Patterns
  {
    id: 'P.API.01',
    name: 'API Route Handler Pattern',
    pattern: 'Use route.ts with GET, POST, PUT, DELETE exports. Handle errors with try/catch and return proper status codes.',
    when: 'Building API endpoints in Next.js.',
    result: 'Clean, RESTful APIs with proper error handling.',
    domain: 'api-design',
  },
  {
    id: 'P.API.02',
    name: 'Optimistic Updates',
    pattern: 'Update UI immediately, then sync with server. Rollback on failure.',
    when: 'User actions that modify data (likes, saves, edits).',
    result: 'Instant feedback, better UX, resilient to network latency.',
    domain: 'api-design',
  },
  // Database Patterns
  {
    id: 'P.DB.01',
    name: 'Repository Pattern',
    pattern: 'Abstract database operations behind repository classes/functions. Components never touch DB directly.',
    when: 'Building applications with database access.',
    result: 'Testable code, swappable backends, clean architecture.',
    domain: 'database',
  },
  {
    id: 'P.DB.02',
    name: 'Pagination Pattern',
    pattern: 'Use cursor-based pagination (after/before) for real-time data, offset for static lists.',
    when: 'Displaying lists of items from database.',
    result: 'Efficient queries, no skipped/duplicate items in real-time feeds.',
    domain: 'database',
  },
  // Authentication Patterns
  {
    id: 'P.AUTH.01',
    name: 'JWT + Refresh Token Pattern',
    pattern: 'Short-lived access tokens (15min) + long-lived refresh tokens (7d). Silent refresh before expiry.',
    when: 'Building stateless authentication systems.',
    result: 'Secure, scalable auth with good UX (no frequent logins).',
    domain: 'security',
  },
  {
    id: 'P.AUTH.02',
    name: 'Middleware Auth Pattern',
    pattern: 'Check auth in middleware before route handlers execute. Redirect to login or return 401.',
    when: 'Protecting routes and API endpoints.',
    result: 'Consistent auth enforcement, no unauthorized access.',
    domain: 'security',
  },
  // State Management Patterns
  {
    id: 'P.STATE.01',
    name: 'Server State vs Client State',
    pattern: 'Use React Query/SWR for server state (cache, refetch), useState/useReducer for UI state.',
    when: 'Managing different types of application state.',
    result: 'Proper caching, automatic revalidation, simpler components.',
    domain: 'react',
  },
  {
    id: 'P.STATE.02',
    name: 'URL State Pattern',
    pattern: 'Store filter/sort/search state in URL params. Read from URL, write to URL on change.',
    when: 'Building filterable lists, search pages, shareable views.',
    result: 'Shareable URLs, browser back/forward works, state survives refresh.',
    domain: 'web-development',
  },
];

/**
 * Core gotchas embedded in the assistant
 */
const CORE_GOTCHAS: GotchaEntry[] = [
  // Conversation Gotchas
  {
    id: 'G.CONV.02',
    title: 'Flat Memory Storage Fails',
    symptom: 'Memory retrieval becomes slow, storage costs grow, relevant information hard to find.',
    cause: 'Storing all conversation history in flat structures without organization or compression.',
    fix: 'Implement hierarchical memory with importance-based organization and compression.',
    prevention: 'Design memory systems with hierarchy from the start.',
    domain: 'conversational-ai',
  },
  {
    id: 'G.CONV.06',
    title: 'Identity Inconsistency',
    symptom: 'AI personality changes between conversations, users notice contradictory behavior, trust erodes.',
    cause: 'Not maintaining coherent self-model. Treating each conversation as isolated.',
    fix: 'Implement self-model with identity vectors and personality tracking.',
    prevention: 'Design identity persistence from the start.',
    domain: 'conversational-ai',
  },
  {
    id: 'G.CONV.08',
    title: 'Ignoring Extended Memory',
    symptom: 'AI doesn\'t remember user preferences, conversations feel repetitive, personalization is shallow.',
    cause: 'Not implementing extended memory for user preferences and past interactions.',
    fix: 'Implement hierarchical memory systems that remember user preferences over time.',
    prevention: 'Design extended memory capabilities from the start.',
    domain: 'conversational-ai',
  },
  // AI Development Gotchas
  {
    id: 'G.AI.01',
    title: 'Ethical Afterthought',
    symptom: 'Ethical issues discovered late in development, expensive to fix.',
    cause: 'Treating ethics as afterthought, not integrated from start.',
    fix: 'Integrate ethics from design phase, regular ethical reviews.',
    prevention: 'Include ethics in initial requirements.',
    domain: 'core-concepts',
  },
  {
    id: 'G.AI.05',
    title: 'Alignment Drift',
    symptom: 'AI behavior drifts from aligned behavior over time.',
    cause: 'Distributional shift, insufficient monitoring.',
    fix: 'Continuous alignment monitoring, regular retraining.',
    prevention: 'Monitor alignment metrics, detect drift early.',
    domain: 'core-concepts',
  },
  // Research Gotchas
  {
    id: 'G.RESEARCH.01',
    title: 'Single-Paradigm Blindness',
    symptom: 'Missing important aspects of problems, incomplete understanding.',
    cause: 'Relying on single research paradigm or method.',
    fix: 'Apply multiple research methods, combine perspectives.',
    prevention: 'Design research with multiple paradigms from start.',
    domain: 'research-paradigms',
  },
  // Productivity Gotchas
  {
    id: 'G.PROD.01',
    title: 'Multitasking Myth',
    symptom: 'Work takes longer, more errors, feeling scattered and unproductive.',
    cause: 'Attempting to do multiple complex tasks simultaneously. Context switching has a cognitive cost.',
    fix: 'Single-task with time blocks. Close distractions. Use "Do Not Disturb" modes.',
    prevention: 'Schedule focused work blocks. Batch similar tasks together.',
    domain: 'productivity',
  },
  {
    id: 'G.PROD.02',
    title: 'Perfectionism Paralysis',
    symptom: 'Projects never finish, endless revision, fear of shipping.',
    cause: 'Waiting for perfect before shipping. Confusing quality with perfectionism.',
    fix: 'Define "good enough" criteria upfront. Set hard deadlines. Ship and iterate.',
    prevention: 'Embrace "done is better than perfect." Schedule shipping dates before starting.',
    domain: 'productivity',
  },
  {
    id: 'G.PROD.03',
    title: 'Busy vs Productive',
    symptom: 'Long hours but little progress on what matters. Exhaustion without results.',
    cause: 'Confusing activity with achievement. Working on urgent instead of important.',
    fix: 'Track outcomes not hours. Ask "What would make today a win?" Do that first.',
    prevention: 'Weekly review: What moved the needle? Do more of that.',
    domain: 'productivity',
  },
  // Business Gotchas
  {
    id: 'G.BIZ.01',
    title: 'Building Without Validation',
    symptom: 'Spent months building, no one wants it. Wasted time and money.',
    cause: 'Assuming you know what customers want without asking them.',
    fix: 'Talk to potential customers. Pre-sell before building. Start with landing page.',
    prevention: 'Validate problem exists before building solution. Get paying customers first.',
    domain: 'business',
  },
  {
    id: 'G.BIZ.02',
    title: 'Pricing Too Low',
    symptom: 'Working hard but not profitable. Attracting price-sensitive customers who demand most.',
    cause: 'Fear of rejection. Undervaluing your work. Competing on price.',
    fix: 'Raise prices. Focus on value delivered. Target customers who value quality.',
    prevention: 'Price based on value to customer, not cost to you. Test higher prices.',
    domain: 'business',
  },
  {
    id: 'G.BIZ.03',
    title: 'Ignoring Unit Economics',
    symptom: 'Growing revenue but losing money. Each sale costs more than it brings.',
    cause: 'Not calculating true customer acquisition cost and lifetime value.',
    fix: 'Calculate CAC and LTV. Only scale what\'s profitable. Cut unprofitable channels.',
    prevention: 'Know your numbers from day one. LTV should be 3x+ CAC.',
    domain: 'business',
  },
  // Finance Gotchas
  {
    id: 'G.FIN.01',
    title: 'Lifestyle Creep',
    symptom: 'Earning more but saving same or less. Living paycheck to paycheck despite raises.',
    cause: 'Increasing spending to match income. Normalizing luxury as necessity.',
    fix: 'Automate savings when income increases. Keep lifestyle fixed when earning more.',
    prevention: 'Save raises before you see them. Define "enough" spending level.',
    domain: 'finance',
  },
  {
    id: 'G.FIN.02',
    title: 'Timing the Market',
    symptom: 'Selling low buying high. Missed gains from being out of market. Stress and anxiety.',
    cause: 'Thinking you can predict short-term market movements. Emotional decisions.',
    fix: 'Dollar-cost average consistently. Ignore daily fluctuations. Think in decades.',
    prevention: 'Automate investments. Don\'t check portfolio daily. Have long time horizon.',
    domain: 'finance',
  },
  {
    id: 'G.FIN.03',
    title: 'Single Income Dependency',
    symptom: 'Job loss = financial crisis. Stuck in bad job because you need the paycheck.',
    cause: 'Relying 100% on employer for income. No backup plan.',
    fix: 'Build side income gradually. Keep 6 month emergency fund. Develop sellable skills.',
    prevention: 'Start small side project while employed. Diversify income sources.',
    domain: 'finance',
  },
  // Health Gotchas
  {
    id: 'G.HEALTH.01',
    title: 'All-or-Nothing Fitness',
    symptom: 'Intense workouts then burnout. Start-stop cycles. Never consistent.',
    cause: 'Going too hard too fast. Making exercise punishment. Unsustainable routine.',
    fix: 'Start embarrassingly small. 10 min daily beats 1 hour weekly. Make it enjoyable.',
    prevention: 'Build habit first, intensity second. Exercise you enjoy > optimal exercise.',
    domain: 'health',
  },
  {
    id: 'G.HEALTH.02',
    title: 'Ignoring Sleep Debt',
    symptom: 'Chronic fatigue, poor decisions, weight gain, weakened immunity.',
    cause: 'Treating sleep as optional. Glorifying hustle culture. Screens before bed.',
    fix: 'Prioritize 7-9 hours. No screens 1 hour before bed. Same wake time daily.',
    prevention: 'Protect sleep like important meeting. Track sleep quality.',
    domain: 'health',
  },
  {
    id: 'G.HEALTH.03',
    title: 'Diet Extremism',
    symptom: 'Yo-yo dieting. Restriction then binging. Unhealthy relationship with food.',
    cause: 'All-or-nothing thinking. Demonizing food groups. Unsustainable restrictions.',
    fix: '80/20 approach: eat well 80% of time. No forbidden foods. Sustainable changes.',
    prevention: 'Small permanent changes over dramatic temporary ones.',
    domain: 'health',
  },
  // Career Gotchas
  {
    id: 'G.CAREER.01',
    title: 'Waiting to Be Noticed',
    symptom: 'Passed over for promotion. Others with less skill advancing faster.',
    cause: 'Assuming good work speaks for itself. Not making achievements visible.',
    fix: 'Document wins. Share updates with stakeholders. Ask for what you want directly.',
    prevention: 'Self-advocate regularly. Build relationships with decision makers.',
    domain: 'career',
  },
  {
    id: 'G.CAREER.02',
    title: 'Accepting First Offer',
    symptom: 'Leaving money on table. Starting behind peers. Resentment later.',
    cause: 'Fear of losing offer. Not knowing market rate. Conflict avoidance.',
    fix: 'Always negotiate. Research market rates. Counter with data, not emotion.',
    prevention: 'Practice negotiation. Know your BATNA. They expect negotiation.',
    domain: 'career',
  },
  {
    id: 'G.CAREER.03',
    title: 'Specializing Too Narrow',
    symptom: 'Skills become obsolete. Limited job options. Vulnerable to industry changes.',
    cause: 'Going deep without breadth. Not updating skills. Comfort zone.',
    fix: 'T-shaped skills: deep expertise + broad awareness. Learn adjacent domains.',
    prevention: 'Spend 20% learning new things. Stay curious about industry trends.',
    domain: 'career',
  },
  // Learning Gotchas
  {
    id: 'G.LEARN.01',
    title: 'Passive Consumption',
    symptom: 'Watch tutorials but can\'t apply. Forget everything. No real skill gained.',
    cause: 'Consuming without doing. Taking notes you never review. Tutorial hell.',
    fix: 'Build something immediately. Teach others. Test yourself, don\'t re-read.',
    prevention: 'Follow 1:2 ratio: 1 hour learning, 2 hours applying.',
    domain: 'learning',
  },
  {
    id: 'G.LEARN.02',
    title: 'Shiny Object Syndrome',
    symptom: 'Start many things, master none. Jack of all trades, master of none.',
    cause: 'Chasing new over mastering current. Confusing interest with commitment.',
    fix: 'Finish what you start. Set 90-day learning commitments. Ignore new until done.',
    prevention: 'Before starting new: Am I at plateau in current skill? If not, continue.',
    domain: 'learning',
  },
  // Communication Gotchas
  {
    id: 'G.COMM.01',
    title: 'Responding vs Understanding',
    symptom: 'Conversations feel like debates. Miss important information. Others feel unheard.',
    cause: 'Planning response while others talk. Listening to reply, not understand.',
    fix: 'Pause before responding. Summarize what you heard. Ask clarifying questions.',
    prevention: 'Practice active listening. Seek first to understand, then be understood.',
    domain: 'communication',
  },
  {
    id: 'G.COMM.02',
    title: 'Avoiding Difficult Conversations',
    symptom: 'Problems fester. Resentment builds. Small issues become big ones.',
    cause: 'Conflict avoidance. Fear of reaction. Hoping it resolves itself.',
    fix: 'Address issues early and directly. Use "I" statements. Focus on behavior not person.',
    prevention: 'Schedule regular check-ins. Make feedback normal, not scary.',
    domain: 'communication',
  },
];

// ============================================================================
// KNOWLEDGE SERVICE
// ============================================================================

/**
 * Singleton knowledge cache
 */
let knowledgeCache: KnowledgeBase | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Assistant Knowledge Service
 */
class AssistantKnowledgeService implements IKnowledgeService {
  private static instance: AssistantKnowledgeService;

  private constructor() {}

  static getInstance(): AssistantKnowledgeService {
    if (!AssistantKnowledgeService.instance) {
      AssistantKnowledgeService.instance = new AssistantKnowledgeService();
    }
    return AssistantKnowledgeService.instance;
  }

  /**
   * Load knowledge base
   */
  async loadKnowledge(options?: KnowledgeLoadOptions): Promise<KnowledgeBase> {
    // Check cache
    if (knowledgeCache && Date.now() - cacheTimestamp < CACHE_TTL) {
      return this.filterKnowledge(knowledgeCache, options);
    }

    // Build knowledge base from embedded + external sources
    const knowledge: KnowledgeBase = {
      wisdom: [...CORE_WISDOM],
      patterns: [...CORE_PATTERNS],
      gotchas: [...CORE_GOTCHAS],
      lastUpdated: new Date().toISOString(),
      version: '1.0.0',
    };

    // TODO: Load additional knowledge from uaa2-service API
    // const externalKnowledge = await this.loadExternalKnowledge();
    // knowledge.wisdom.push(...externalKnowledge.wisdom);
    // knowledge.patterns.push(...externalKnowledge.patterns);
    // knowledge.gotchas.push(...externalKnowledge.gotchas);

    // Cache the result
    knowledgeCache = knowledge;
    cacheTimestamp = Date.now();

    return this.filterKnowledge(knowledge, options);
  }

  /**
   * Filter knowledge by options
   */
  private filterKnowledge(knowledge: KnowledgeBase, options?: KnowledgeLoadOptions): KnowledgeBase {
    if (!options) return knowledge;

    let wisdom = knowledge.wisdom;
    let patterns = knowledge.patterns;
    let gotchas = knowledge.gotchas;

    // Filter by domain
    if (options.domains && options.domains.length > 0) {
      wisdom = wisdom.filter(w => !w.domain || options.domains!.includes(w.domain as KnowledgeDomain));
      patterns = patterns.filter(p => !p.domain || options.domains!.includes(p.domain as KnowledgeDomain));
      gotchas = gotchas.filter(g => !g.domain || options.domains!.includes(g.domain as KnowledgeDomain));
    }

    // Limit results
    if (options.maxWisdom) wisdom = wisdom.slice(0, options.maxWisdom);
    if (options.maxPatterns) patterns = patterns.slice(0, options.maxPatterns);
    if (options.maxGotchas) gotchas = gotchas.slice(0, options.maxGotchas);

    return {
      ...knowledge,
      wisdom,
      patterns,
      gotchas,
    };
  }

  /**
   * Search knowledge by query
   */
  async searchKnowledge(query: string, options?: KnowledgeLoadOptions): Promise<KnowledgeSearchResult> {
    const startTime = Date.now();
    const knowledge = await this.loadKnowledge(options);
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2);

    // Score and filter wisdom
    const scoredWisdom = knowledge.wisdom
      .map(w => ({
        ...w,
        score: this.calculateRelevanceScore(queryTerms, [
          w.title,
          w.wisdom,
          w.application || '',
          w.domain || '',
        ]),
      }))
      .filter(w => w.score > 0)
      .sort((a, b) => b.score - a.score);

    // Score and filter patterns
    const scoredPatterns = knowledge.patterns
      .map(p => ({
        ...p,
        score: this.calculateRelevanceScore(queryTerms, [
          p.name,
          p.pattern,
          p.when || '',
          p.result || '',
          p.domain || '',
        ]),
      }))
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score);

    // Score and filter gotchas
    const scoredGotchas = knowledge.gotchas
      .map(g => ({
        ...g,
        score: this.calculateRelevanceScore(queryTerms, [
          g.title,
          g.symptom,
          g.cause,
          g.fix,
          g.domain || '',
        ]),
      }))
      .filter(g => g.score > 0)
      .sort((a, b) => b.score - a.score);

    return {
      query,
      wisdom: scoredWisdom.slice(0, options?.maxWisdom || 5),
      patterns: scoredPatterns.slice(0, options?.maxPatterns || 5),
      gotchas: scoredGotchas.slice(0, options?.maxGotchas || 5),
      searchTime: Date.now() - startTime,
      totalResults: scoredWisdom.length + scoredPatterns.length + scoredGotchas.length,
    };
  }

  /**
   * Calculate relevance score for search
   */
  private calculateRelevanceScore(queryTerms: string[], texts: string[]): number {
    const combinedText = texts.join(' ').toLowerCase();
    let score = 0;

    for (const term of queryTerms) {
      // Exact match
      if (combinedText.includes(term)) {
        score += 1;
      }
      // Partial match (word starts with term)
      const words = combinedText.split(/\s+/);
      for (const word of words) {
        if (word.startsWith(term) && word !== term) {
          score += 0.5;
        }
      }
    }

    // Normalize by number of terms
    return queryTerms.length > 0 ? score / queryTerms.length : 0;
  }

  /**
   * Get relevant knowledge for assistant context
   */
  async getRelevantKnowledge(context: AssistantContext): Promise<{
    wisdom: WisdomEntry[];
    patterns: PatternEntry[];
    gotchas: GotchaEntry[];
  }> {
    const knowledge = await this.loadKnowledge();

    // Build relevance context from user profile and conversation
    const relevanceTerms: string[] = [];

    // Add user interests
    if (context.userProfile.interests) {
      relevanceTerms.push(...context.userProfile.interests);
    }
    if (context.userProfile.customInterests) {
      relevanceTerms.push(...context.userProfile.customInterests);
    }

    // Add workflow phase preferences
    if (context.userProfile.workflowPhases) {
      if (context.userProfile.workflowPhases.includes('research')) {
        relevanceTerms.push('research', 'paradigm', 'method');
      }
      if (context.userProfile.workflowPhases.includes('plan')) {
        relevanceTerms.push('architecture', 'design', 'planning');
      }
      if (context.userProfile.workflowPhases.includes('deliver')) {
        relevanceTerms.push('implementation', 'code', 'development');
      }
    }

    // Add mode-specific terms
    if (context.mode === 'search') {
      relevanceTerms.push('research', 'knowledge', 'patterns');
    } else if (context.mode === 'build') {
      relevanceTerms.push('development', 'code', 'architecture');
    } else {
      relevanceTerms.push('conversational', 'help', 'assist');
    }

    // Search with relevance terms
    const searchResult = await this.searchKnowledge(relevanceTerms.join(' '), {
      maxWisdom: 3,
      maxPatterns: 3,
      maxGotchas: 2,
    });

    return {
      wisdom: searchResult.wisdom,
      patterns: searchResult.patterns,
      gotchas: searchResult.gotchas,
    };
  }

  /**
   * Format knowledge for system prompt
   */
  formatKnowledgeForPrompt(knowledge: {
    wisdom: WisdomEntry[];
    patterns: PatternEntry[];
    gotchas: GotchaEntry[];
  }): string {
    const parts: string[] = [];

    if (knowledge.wisdom.length > 0) {
      parts.push('## Relevant Wisdom');
      for (const w of knowledge.wisdom) {
        parts.push(`- **${w.id}** ${w.title}: ${w.wisdom}`);
      }
    }

    if (knowledge.patterns.length > 0) {
      parts.push('\n## Applicable Patterns');
      for (const p of knowledge.patterns) {
        parts.push(`- **${p.id}** ${p.name}: ${p.pattern}`);
      }
    }

    if (knowledge.gotchas.length > 0) {
      parts.push('\n## Watch For (Gotchas)');
      for (const g of knowledge.gotchas) {
        parts.push(`- **${g.id}** ${g.title}: ${g.symptom} → ${g.fix}`);
      }
    }

    return parts.join('\n');
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const getAssistantKnowledgeService = (): AssistantKnowledgeService => {
  return AssistantKnowledgeService.getInstance();
};

export { AssistantKnowledgeService };
