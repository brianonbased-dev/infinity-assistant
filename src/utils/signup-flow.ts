/**
 * Signup Flow Utilities
 * 
 * Provides utilities for post-signup flow, welcome messages,
 * and user onboarding guidance.
 */

import logger from './logger';

export interface SignupFlowContext {
  userId: string;
  email?: string;
  product?: 'assistant' | 'builder';
  source?: 'email' | 'google' | 'anonymous';
  timestamp: Date;
}

export interface PostSignupSteps {
  completed: string[];
  next: string[];
  resources: {
    gettingStarted: string;
    apiDocs: string;
    pricing: string;
    support: string;
  };
}

/**
 * Generate post-signup next steps
 */
export function getPostSignupSteps(context: SignupFlowContext): PostSignupSteps {
  const steps: PostSignupSteps = {
    completed: [],
    next: [],
    resources: {
      gettingStarted: '/docs/GETTING_STARTED.md',
      apiDocs: '/docs/PUBLIC_API_DOCUMENTATION.md',
      pricing: '/pricing',
      support: 'mailto:support@infinityassistant.io',
    },
  };

  // Completed steps
  steps.completed.push('Account created');
  
  if (context.email) {
    steps.completed.push('Email verified');
  }

  // Next steps based on product
  if (context.product === 'builder') {
    steps.next = [
      'Complete Builder onboarding',
      'Create your first project',
      'Generate your first code',
      'Explore Builder features',
    ];
  } else {
    steps.next = [
      'Complete Assistant onboarding',
      'Ask your first question',
      'Explore Assistant features',
      'Try Builder mode (included)',
    ];
  }

  // Add API-related steps for developers
  if (context.email) {
    steps.next.push('Get your API key');
    steps.next.push('Read API documentation');
  }

  return steps;
}

/**
 * Generate welcome message for new users
 */
export function getWelcomeMessage(context: SignupFlowContext): string {
  const productName = context.product === 'builder' ? 'Infinity Builder' : 'Infinity Assistant';
  
  return `Welcome to ${productName}! 🎉

You're all set to start building amazing things with AI. Here's what you can do next:

${getPostSignupSteps(context).next.map((step, i) => `${i + 1}. ${step}`).join('\n')}

Need help? Check out our getting started guide or reach out to support.`;
}

/**
 * Track signup completion
 */
export async function trackSignupCompletion(context: SignupFlowContext): Promise<void> {
  try {
    // Log signup event
    logger.info('[SignupFlow] User signup completed', {
      userId: context.userId,
      product: context.product,
      source: context.source,
      timestamp: context.timestamp.toISOString(),
    });

    // Could send analytics event here
    // await analytics.track('user_signed_up', { ...context });
  } catch (error) {
    logger.error('[SignupFlow] Failed to track signup:', error);
  }
}

/**
 * Check if user needs post-signup guidance
 */
export function needsPostSignupGuidance(userId: string): boolean {
  // Check localStorage for post-signup guidance flag
  if (typeof window === 'undefined') return false;
  
  const guidanceShown = localStorage.getItem(`post_signup_guidance_${userId}`);
  return !guidanceShown;
}

/**
 * Mark post-signup guidance as shown
 */
export function markPostSignupGuidanceShown(userId: string): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem(`post_signup_guidance_${userId}`, 'true');
}

/**
 * Get signup completion percentage
 */
export function getSignupCompletionPercentage(context: SignupFlowContext): number {
  const steps = getPostSignupSteps(context);
  const totalSteps = steps.completed.length + steps.next.length;
  const completedSteps = steps.completed.length;
  
  return Math.round((completedSteps / totalSteps) * 100);
}

