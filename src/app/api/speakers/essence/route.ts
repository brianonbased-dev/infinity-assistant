/**
 * Essence Configuration API
 *
 * Endpoints for managing assistant personality/essence settings
 * Stored in user preferences (local-first with optional sync)
 */

import { NextRequest, NextResponse } from 'next/server';
import logger from '@/utils/logger';

export interface EssenceConfig {
  voiceTone: 'friendly' | 'professional' | 'playful' | 'supportive' | 'neutral';
  responseStyle: 'concise' | 'detailed' | 'balanced';
  personalityTraits: string[];
  customGreeting?: string;
  familyMode: boolean;
  childSafetyLevel: 'open' | 'family' | 'strict';
}

const defaultEssence: EssenceConfig = {
  voiceTone: 'friendly',
  responseStyle: 'balanced',
  personalityTraits: [],
  familyMode: false,
  childSafetyLevel: 'family',
};

// In-memory cache for essence configs (would be stored in database in production)
const essenceCache = new Map<string, EssenceConfig>();

// GET /api/speakers/essence - Get essence configuration
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'default';

    const essence = essenceCache.get(userId) || defaultEssence;

    return NextResponse.json({ essence });
  } catch (error) {
    logger.error('[Essence API] Error fetching essence:', error);
    return NextResponse.json(
      { error: 'Failed to fetch essence configuration' },
      { status: 500 }
    );
  }
}

// PUT /api/speakers/essence - Update essence configuration
export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'default';
    const body = await request.json();

    // Validate essence config
    const essence: EssenceConfig = {
      voiceTone: body.voiceTone || defaultEssence.voiceTone,
      responseStyle: body.responseStyle || defaultEssence.responseStyle,
      personalityTraits: body.personalityTraits || [],
      customGreeting: body.customGreeting,
      familyMode: body.familyMode ?? defaultEssence.familyMode,
      childSafetyLevel: body.childSafetyLevel || defaultEssence.childSafetyLevel,
    };

    // Validate voice tone
    const validTones = ['friendly', 'professional', 'playful', 'supportive', 'neutral'];
    if (!validTones.includes(essence.voiceTone)) {
      return NextResponse.json(
        { error: 'Invalid voice tone' },
        { status: 400 }
      );
    }

    // Validate response style
    const validStyles = ['concise', 'detailed', 'balanced'];
    if (!validStyles.includes(essence.responseStyle)) {
      return NextResponse.json(
        { error: 'Invalid response style' },
        { status: 400 }
      );
    }

    // Validate child safety level
    const validSafetyLevels = ['open', 'family', 'strict'];
    if (!validSafetyLevels.includes(essence.childSafetyLevel)) {
      return NextResponse.json(
        { error: 'Invalid child safety level' },
        { status: 400 }
      );
    }

    // Store in cache (would store in database in production)
    essenceCache.set(userId, essence);

    logger.info('[Essence API] Updated essence config for user:', userId);

    return NextResponse.json({ success: true, essence });
  } catch (error) {
    logger.error('[Essence API] Error updating essence:', error);
    return NextResponse.json(
      { error: 'Failed to update essence configuration' },
      { status: 500 }
    );
  }
}

/**
 * Generate system prompt additions based on essence configuration
 */
export function generateEssencePrompt(essence: EssenceConfig): string {
  const parts: string[] = [];

  // Voice tone
  const toneDescriptions: Record<string, string> = {
    friendly: 'Be warm, approachable, and conversational. Use a friendly tone that makes users feel comfortable.',
    professional: 'Maintain a professional, polished tone. Be clear, precise, and business-appropriate.',
    playful: 'Be fun, energetic, and engaging. Use humor and creativity while remaining helpful.',
    supportive: 'Be empathetic, encouraging, and patient. Focus on understanding and validation.',
    neutral: 'Be balanced and objective. Focus on delivering information clearly without strong emotional tone.',
  };
  parts.push(toneDescriptions[essence.voiceTone] || toneDescriptions.friendly);

  // Response style
  const styleDescriptions: Record<string, string> = {
    concise: 'Keep responses brief and to the point. Use bullet points when helpful.',
    detailed: 'Provide comprehensive explanations with examples and context.',
    balanced: 'Balance brevity with thoroughness based on the question complexity.',
  };
  parts.push(styleDescriptions[essence.responseStyle] || styleDescriptions.balanced);

  // Custom greeting
  if (essence.customGreeting) {
    parts.push(`When greeting users, consider using: "${essence.customGreeting}"`);
  }

  // Family mode
  if (essence.familyMode) {
    parts.push('FAMILY MODE ACTIVE: This is a family-friendly environment. Ensure all responses are appropriate for all ages.');

    const safetyDescriptions: Record<string, string> = {
      open: 'General family-friendly content is acceptable.',
      family: 'Be extra mindful of child-appropriate language and topics.',
      strict: 'Use the most conservative approach. Avoid any potentially concerning topics for young children.',
    };
    parts.push(safetyDescriptions[essence.childSafetyLevel] || safetyDescriptions.family);
  }

  // Personality traits
  if (essence.personalityTraits && essence.personalityTraits.length > 0) {
    parts.push(`Express these personality traits: ${essence.personalityTraits.join(', ')}`);
  }

  return `\n\n[Assistant Essence Configuration]\n${parts.join('\n')}`;
}
