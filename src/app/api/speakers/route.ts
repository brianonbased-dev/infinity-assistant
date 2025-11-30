/**
 * Speaker Profiles API
 *
 * Endpoints for managing speaker/family member profiles
 * Uses hybrid storage (database + file) for persistence
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAdaptiveCommunicationService,
  initializeAdaptiveCommunication,
} from '@/services/AdaptiveCommunicationService';
import logger from '@/utils/logger';

// GET /api/speakers - Get all speakers for user
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'default';

    // Initialize service with hybrid storage
    const service = await initializeAdaptiveCommunication();
    await service.loadUserSpeakersHybrid(userId);

    const speakers = service.getAllSpeakers();

    // Get essence config from localStorage (sent by client) or defaults
    const essenceHeader = request.headers.get('x-essence-config');
    let essence = {
      voiceTone: 'friendly' as const,
      responseStyle: 'balanced' as const,
      personalityTraits: [] as string[],
      familyMode: false,
      childSafetyLevel: 'family' as const,
    };

    if (essenceHeader) {
      try {
        essence = JSON.parse(essenceHeader);
      } catch {
        // Use defaults
      }
    }

    return NextResponse.json({
      speakers: speakers.map((s) => ({
        id: s.id,
        name: s.name,
        nickname: s.nickname,
        relationship: s.relationship,
        preferredLanguage: s.preferredLanguage || s.detectedLanguage,
        estimatedAge: s.estimatedAge,
        messageCount: s.messageCount,
        firstSeen: s.firstSeen?.toISOString(),
        lastSeen: s.lastSeen?.toISOString(),
        interests: s.interests,
        rememberedFacts: s.rememberedFacts,
      })),
      essence,
    });
  } catch (error) {
    logger.error('[Speakers API] Error fetching speakers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch speaker profiles' },
      { status: 500 }
    );
  }
}

// POST /api/speakers - Create a new speaker profile
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'default';
    const body = await request.json();

    const { name, nickname, relationship, estimatedAge, preferredLanguage } = body;

    if (!name && !nickname) {
      return NextResponse.json(
        { error: 'Name or nickname is required' },
        { status: 400 }
      );
    }

    const service = await initializeAdaptiveCommunication();
    service.setCurrentUser(userId);

    // Register as family member
    const speakerId = service.registerFamilyMember(
      name || nickname,
      relationship || 'other',
      estimatedAge || 'adult',
      preferredLanguage
    );

    // Get the created profile
    const profile = service.getSpeaker(speakerId);

    return NextResponse.json({
      success: true,
      speaker: profile ? {
        id: profile.id,
        name: profile.name,
        nickname: profile.nickname,
        relationship: profile.relationship,
        preferredLanguage: profile.preferredLanguage,
        estimatedAge: profile.estimatedAge,
        messageCount: profile.messageCount,
      } : null,
    });
  } catch (error) {
    logger.error('[Speakers API] Error creating speaker:', error);
    return NextResponse.json(
      { error: 'Failed to create speaker profile' },
      { status: 500 }
    );
  }
}

// PATCH /api/speakers - Update a speaker profile
export async function PATCH(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'default';
    const body = await request.json();

    const { speakerId, updates } = body;

    if (!speakerId) {
      return NextResponse.json(
        { error: 'Speaker ID is required' },
        { status: 400 }
      );
    }

    const service = await initializeAdaptiveCommunication();
    service.setCurrentUser(userId);

    const success = service.updateSpeaker(speakerId, {
      name: updates.name,
      nickname: updates.nickname,
      relationship: updates.relationship,
      preferredLanguage: updates.preferredLanguage,
      estimatedAge: updates.estimatedAge,
      interests: updates.interests,
      rememberedFacts: updates.rememberedFacts,
    });

    if (!success) {
      return NextResponse.json(
        { error: 'Speaker not found' },
        { status: 404 }
      );
    }

    // Sync to database
    await service.saveSpeakerHybrid(service.getSpeaker(speakerId)!);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Speakers API] Error updating speaker:', error);
    return NextResponse.json(
      { error: 'Failed to update speaker profile' },
      { status: 500 }
    );
  }
}

// DELETE /api/speakers - Delete a speaker profile
export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'default';
    const body = await request.json();

    const { speakerId } = body;

    if (!speakerId) {
      return NextResponse.json(
        { error: 'Speaker ID is required' },
        { status: 400 }
      );
    }

    const service = await initializeAdaptiveCommunication();
    service.setCurrentUser(userId);

    const success = service.deleteSpeaker(speakerId);

    if (!success) {
      return NextResponse.json(
        { error: 'Speaker not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Speakers API] Error deleting speaker:', error);
    return NextResponse.json(
      { error: 'Failed to delete speaker profile' },
      { status: 500 }
    );
  }
}
