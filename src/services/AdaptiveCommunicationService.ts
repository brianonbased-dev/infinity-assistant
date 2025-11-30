/**
 * Adaptive Communication Service
 *
 * Non-invasive, natural language and communication adaptation.
 * KNOWS WHO IS CALLING IT - recognizes different speakers by:
 * - Name introductions ("Hi, I'm Sarah")
 * - Voice/writing style fingerprinting
 * - Language patterns unique to each person
 * - Family member recognition
 *
 * Detects and adapts to:
 * - Different speakers/voices in conversation
 * - Language switching (code-switching)
 * - Communication style changes
 * - Age-appropriate responses
 * - Formality level shifts
 *
 * Philosophy: Be invisible. Adapt naturally without requiring configuration.
 * Know each person. Remember their preferences. Greet them naturally.
 *
 * Based on research:
 * - Pragmatics (context-aware communication)
 * - Sociolinguistics (language variation, code-switching)
 * - Psycholinguistics (cognitive load, age differences)
 */

import { detectLanguage, type SupportedLanguage } from './BilingualService';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// FILE-BASED STORAGE (uaa2 compression style)
// ============================================================================

const STORAGE_BASE = process.env.UAA2_STORAGE_PATH || '.uaa2-standalone';
const SPEAKERS_DIR = 'users';
const SPEAKERS_FILE = 'speakers.json';
const FAMILY_FILE = 'family.json';

interface StoredSpeakerData {
  version: string;
  lastUpdated: string;
  speakers: Record<string, SpeakerProfile>;
  familyMembers: string[];
}

/**
 * Get storage path for a user's speaker data
 */
function getSpeakerStoragePath(userId: string): string {
  return path.join(STORAGE_BASE, SPEAKERS_DIR, userId, SPEAKERS_FILE);
}

/**
 * Get storage path for family data
 */
function getFamilyStoragePath(userId: string): string {
  return path.join(STORAGE_BASE, SPEAKERS_DIR, userId, FAMILY_FILE);
}

/**
 * Ensure directory exists
 */
function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Load speaker data from file
 */
function loadSpeakerData(userId: string): StoredSpeakerData | null {
  try {
    const filePath = getSpeakerStoragePath(userId);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[AdaptiveCommunication] Error loading speaker data:', error);
  }
  return null;
}

/**
 * Save speaker data to file
 */
function saveSpeakerData(userId: string, data: StoredSpeakerData): void {
  try {
    const filePath = getSpeakerStoragePath(userId);
    ensureDir(filePath);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('[AdaptiveCommunication] Error saving speaker data:', error);
  }
}

// ============================================================================
// HYBRID STORAGE SERVICE (Database + File)
// ============================================================================

/**
 * Hybrid storage for speaker profiles
 * - Database: Fast online access, real-time sync
 * - File: Offline backup, user-editable
 */
class HybridSpeakerStorage {
  private supabase: SupabaseClient | null = null;
  private isOnline: boolean = true;

  /**
   * Initialize with Supabase client
   */
  async initialize(): Promise<void> {
    try {
      // Dynamic import to avoid issues in different environments
      const { getSupabaseClient } = await import('@/lib/supabase');
      this.supabase = getSupabaseClient();
      this.isOnline = true;
    } catch (error) {
      console.warn('[HybridStorage] Database not available, using file-only mode:', error);
      this.isOnline = false;
    }
  }

  /**
   * Load speakers - try database first, fall back to file
   */
  async loadSpeakers(userId: string): Promise<Map<string, SpeakerProfile>> {
    const speakers = new Map<string, SpeakerProfile>();

    // Try database first if online
    if (this.isOnline && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('infinity_speaker_profiles')
          .select('*')
          .eq('user_id', userId);

        if (!error && data) {
          for (const row of data) {
            speakers.set(row.id, this.rowToProfile(row));
          }
          console.log(`[HybridStorage] Loaded ${data.length} speakers from database`);
          return speakers;
        }
      } catch (e) {
        console.warn('[HybridStorage] Database load failed, using file:', e);
      }
    }

    // Fall back to file storage
    const fileData = loadSpeakerData(userId);
    if (fileData) {
      for (const [id, profile] of Object.entries(fileData.speakers)) {
        profile.firstSeen = new Date(profile.firstSeen);
        profile.lastSeen = new Date(profile.lastSeen);
        speakers.set(id, profile);
      }
      console.log(`[HybridStorage] Loaded ${speakers.size} speakers from file`);
    }

    return speakers;
  }

  /**
   * Save speaker - write to both database and file
   */
  async saveSpeaker(userId: string, profile: SpeakerProfile): Promise<void> {
    // Save to database if online
    if (this.isOnline && this.supabase) {
      try {
        const row = this.profileToRow(userId, profile);
        const { error } = await this.supabase
          .from('infinity_speaker_profiles')
          .upsert(row, { onConflict: 'id' });

        if (error) {
          console.warn('[HybridStorage] Database save failed:', error);
        }
      } catch (e) {
        console.warn('[HybridStorage] Database save error:', e);
      }
    }

    // Always save to file as backup (will be triggered by saveUserSpeakers)
  }

  /**
   * Sync file to database (for offline changes)
   */
  async syncFileToDatabase(userId: string): Promise<{ synced: number; errors: string[] }> {
    const errors: string[] = [];
    let synced = 0;

    if (!this.isOnline || !this.supabase) {
      errors.push('Database not available');
      return { synced, errors };
    }

    const fileData = loadSpeakerData(userId);
    if (!fileData) {
      return { synced, errors };
    }

    for (const [id, profile] of Object.entries(fileData.speakers)) {
      try {
        profile.firstSeen = new Date(profile.firstSeen);
        profile.lastSeen = new Date(profile.lastSeen);
        const row = this.profileToRow(userId, profile);

        const { error } = await this.supabase
          .from('infinity_speaker_profiles')
          .upsert(row, { onConflict: 'id' });

        if (error) {
          errors.push(`Failed to sync ${id}: ${error.message}`);
        } else {
          synced++;
        }
      } catch (e) {
        errors.push(`Error syncing ${id}: ${e}`);
      }
    }

    return { synced, errors };
  }

  /**
   * Sync database to file (refresh file with latest)
   */
  async syncDatabaseToFile(userId: string): Promise<void> {
    if (!this.isOnline || !this.supabase) return;

    try {
      const { data, error } = await this.supabase
        .from('infinity_speaker_profiles')
        .select('*')
        .eq('user_id', userId);

      if (!error && data) {
        const speakers: Record<string, SpeakerProfile> = {};
        const familyMembers: string[] = [];

        for (const row of data) {
          const profile = this.rowToProfile(row);
          speakers[row.id] = profile;
          if (profile.relationship) {
            familyMembers.push(row.id);
          }
        }

        const fileData: StoredSpeakerData = {
          version: '1.0.0',
          lastUpdated: new Date().toISOString(),
          speakers,
          familyMembers,
        };

        saveSpeakerData(userId, fileData);
        console.log(`[HybridStorage] Synced ${data.length} speakers to file`);
      }
    } catch (e) {
      console.warn('[HybridStorage] Failed to sync to file:', e);
    }
  }

  /**
   * Convert database row to SpeakerProfile
   */
  private rowToProfile(row: Record<string, unknown>): SpeakerProfile {
    const fp = row.style_fingerprint as Record<string, unknown> | null;
    return {
      id: row.id as string,
      name: row.name as string | undefined,
      nickname: row.nickname as string | undefined,
      relationship: row.relationship as string | undefined,
      detectedLanguage: (row.detected_language as SupportedLanguage) || 'en',
      preferredLanguage: row.preferred_language as SupportedLanguage | undefined,
      communicationStyle: (row.communication_style as CommunicationStyle) || 'friendly',
      vocabularyLevel: (row.vocabulary_level as VocabularyLevel) || 'intermediate',
      formalityLevel: (row.formality_level as FormalityLevel) || 'neutral',
      estimatedAge: (row.estimated_age as 'child' | 'teen' | 'adult' | 'senior') || 'adult',
      messageCount: (row.message_count as number) || 0,
      firstSeen: new Date(row.first_seen as string),
      lastSeen: new Date(row.last_seen as string),
      confidence: (row.confidence as number) || 0.5,
      styleFingerprint: {
        avgWordLength: (fp?.avgWordLength as number) || 0,
        avgMessageLength: (fp?.avgMessageLength as number) || 0,
        punctuationStyle: (fp?.punctuationStyle as string) || 'standard',
        emojiUsage: (fp?.emojiUsage as string) || 'rare',
        greetingStyle: fp?.greetingStyle as string | undefined,
        signaturePatterns: (fp?.signaturePatterns as string[]) || [],
      },
      interests: (row.interests as string[]) || [],
      rememberedFacts: (row.remembered_facts as string[]) || [],
    };
  }

  /**
   * Convert SpeakerProfile to database row
   */
  private profileToRow(userId: string, profile: SpeakerProfile): Record<string, unknown> {
    return {
      id: profile.id,
      user_id: userId,
      name: profile.name || null,
      nickname: profile.nickname || null,
      relationship: profile.relationship || null,
      detected_language: profile.detectedLanguage,
      preferred_language: profile.preferredLanguage || null,
      estimated_age: profile.estimatedAge || 'adult',
      communication_style: profile.communicationStyle,
      vocabulary_level: profile.vocabularyLevel,
      formality_level: profile.formalityLevel,
      style_fingerprint: {
        avgWordLength: profile.styleFingerprint.avgWordLength,
        avgMessageLength: profile.styleFingerprint.avgMessageLength,
        punctuationStyle: profile.styleFingerprint.punctuationStyle,
        emojiUsage: profile.styleFingerprint.emojiUsage,
        greetingStyle: profile.styleFingerprint.greetingStyle,
        signaturePatterns: profile.styleFingerprint.signaturePatterns,
      },
      interests: profile.interests,
      remembered_facts: profile.rememberedFacts,
      message_count: profile.messageCount,
      confidence: profile.confidence,
      first_seen: profile.firstSeen.toISOString(),
      last_seen: profile.lastSeen.toISOString(),
      needs_file_sync: false, // We're syncing now
    };
  }
}

// Supabase client type (imported dynamically)
type SupabaseClient = {
  from: (table: string) => {
    select: (columns?: string) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
    upsert: (data: Record<string, unknown>, options?: { onConflict?: string }) => Promise<{ error: { message: string } | null }>;
    eq: (column: string, value: string) => {
      select: (columns?: string) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
    };
  };
};

// Singleton hybrid storage
let hybridStorage: HybridSpeakerStorage | null = null;

function getHybridStorage(): HybridSpeakerStorage {
  if (!hybridStorage) {
    hybridStorage = new HybridSpeakerStorage();
  }
  return hybridStorage;
}

// ============================================================================
// TYPES
// ============================================================================

export interface SpeakerProfile {
  id: string;
  name?: string;                    // Detected or provided name
  nickname?: string;                // "Mom", "Dad", "buddy", etc.
  relationship?: string;            // "parent", "child", "friend", etc.
  detectedLanguage: SupportedLanguage;
  preferredLanguage?: SupportedLanguage; // Explicitly stated preference
  communicationStyle: CommunicationStyle;
  vocabularyLevel: VocabularyLevel;
  formalityLevel: FormalityLevel;
  estimatedAge?: 'child' | 'teen' | 'adult' | 'senior';
  messageCount: number;
  firstSeen: Date;
  lastSeen: Date;
  confidence: number;

  // Writing style fingerprint for recognition
  styleFingerprint: {
    avgWordLength: number;
    avgMessageLength: number;
    punctuationStyle: string;       // "minimal", "standard", "expressive"
    emojiUsage: string;             // "none", "rare", "moderate", "frequent"
    greetingStyle?: string;         // How they typically start messages
    signaturePatterns: string[];    // Unique phrases they use
  };

  // Topics they're interested in
  interests: string[];

  // Remembered facts about them
  rememberedFacts: string[];
}

export type CommunicationStyle =
  | 'casual'      // Hey, what's up, cool
  | 'friendly'    // Hi there! How can I help?
  | 'professional'// Good morning, I would like to inquire
  | 'technical'   // Implement the API endpoint with OAuth2
  | 'academic'    // Research indicates, furthermore, hypothesis
  | 'supportive'; // I understand, that sounds difficult

export type VocabularyLevel =
  | 'simple'      // Basic words, short sentences
  | 'intermediate'// Standard vocabulary
  | 'advanced'    // Rich vocabulary, complex sentences
  | 'technical';  // Domain-specific terminology

export type FormalityLevel =
  | 'very_casual' // hey, gonna, wanna, lol
  | 'casual'      // Hi, thanks, sure thing
  | 'neutral'     // Hello, thank you, of course
  | 'formal'      // Good morning, I appreciate, certainly
  | 'very_formal';// Dear Sir/Madam, I am writing to

export interface ConversationContext {
  sessionId: string;
  speakers: Map<string, SpeakerProfile>;
  currentSpeaker: string | null;
  languageHistory: SupportedLanguage[];
  styleHistory: CommunicationStyle[];
  isMultiSpeaker: boolean;
  familyMode: boolean;
  childDetected: boolean;
}

export interface AdaptationResult {
  shouldAdapt: boolean;
  language: SupportedLanguage;
  style: CommunicationStyle;
  vocabularyLevel: VocabularyLevel;
  formalityLevel: FormalityLevel;
  systemPromptAdditions: string;
  speakerChange: boolean;
  confidence: number;

  // WHO is speaking
  recognizedSpeaker?: SpeakerProfile;
  isNewSpeaker: boolean;
  suggestedGreeting?: string;
}

// Voice/Speaker Recognition Result
export interface VoiceRecognitionResult {
  speakerId: string;
  speakerName?: string;
  confidence: number;
  isNewVoice: boolean;
  matchedProfile?: SpeakerProfile;
  suggestedGreeting: string;
  ageGroup?: 'child' | 'teen' | 'adult' | 'senior';
}

// Personalized greeting templates
const GREETINGS = {
  child: [
    "Hey buddy! What's up?",
    "Hi there, little one! How can I help?",
    "Hello! Ready to learn something cool?",
    "Hey! What are we doing today?",
    "Hi friend! What can I help you with?",
  ],
  teen: [
    "Hey! What's going on?",
    "Yo! What do you need?",
    "Hey there! How can I help?",
    "What's up? Ready to get started?",
  ],
  adult: [
    "Hello! How can I help you today?",
    "Hi there! What can I assist you with?",
    "Good to see you! What's on your mind?",
    "Hello! What would you like to work on?",
  ],
  senior: [
    "Hello! How are you today?",
    "Hi there! How can I help you?",
    "Good to hear from you! What can I do for you?",
    "Hello! What would you like help with today?",
  ],
  returning_child: [
    "Hey {name}! Good to see you again!",
    "Hi {name}! What are we learning today?",
    "{name}! Ready for another adventure?",
    "Welcome back, {name}! What's on your mind?",
  ],
  returning_adult: [
    "Welcome back, {name}! How can I help?",
    "Hi {name}! Good to see you again.",
    "Hello {name}! What can I help you with today?",
  ],
  family_child: [
    "Hey there! Is this {name}?",
    "Hi little one! Ready to learn something?",
    "Hello! What would you like to know today?",
  ],
};

// ============================================================================
// DETECTION PATTERNS (from linguistics research)
// ============================================================================

// Casual/informal indicators
const CASUAL_PATTERNS = [
  /\b(hey|hi|yo|sup|hiya|heya)\b/i,
  /\b(gonna|wanna|gotta|kinda|sorta)\b/i,
  /\b(cool|awesome|great|nice|sweet)\b/i,
  /\b(yeah|yep|nope|nah|yup)\b/i,
  /\b(lol|haha|hehe|omg|btw|idk|imo)\b/i,
  /[!]{2,}/, // Multiple exclamation marks
  /[:;]-?[)D(P]/,  // Emoticons
];

// Formal indicators
const FORMAL_PATTERNS = [
  /\b(dear|respected|esteemed)\b/i,
  /\b(would you be so kind|i would appreciate|please be advised)\b/i,
  /\b(furthermore|moreover|nevertheless|consequently)\b/i,
  /\b(regarding|concerning|with respect to)\b/i,
  /\b(kindly|sincerely|respectfully)\b/i,
];

// Technical indicators
const TECHNICAL_PATTERNS = [
  /\b(api|sdk|oauth|jwt|http|crud|sql|nosql)\b/i,
  /\b(function|class|interface|component|module)\b/i,
  /\b(deploy|implement|integrate|configure|debug)\b/i,
  /\b(async|await|promise|callback|middleware)\b/i,
  /```[\s\S]*```/, // Code blocks
  /`[^`]+`/, // Inline code
];

// Child-like patterns (simple vocabulary, questions, expressions)
const CHILD_PATTERNS = [
  /\b(mommy|daddy|mom|dad|mama|papa)\b/i,
  /\b(please please|pretty please)\b/i,
  /\bwhy\s+(is|are|do|does|can|did)\b/i, // Lots of "why" questions
  /\b(homework|school|teacher|class)\b/i,
  /\b(favorite|best friend|play|game)\b/i,
  /[!?]{3,}/, // Excessive punctuation
];

// Professional indicators
const PROFESSIONAL_PATTERNS = [
  /\b(meeting|deadline|project|client|stakeholder)\b/i,
  /\b(strategy|objective|deliverable|milestone)\b/i,
  /\b(per your request|as discussed|moving forward)\b/i,
  /\b(roi|kpi|q[1-4]|fy\d{2,4})\b/i,
];

// Question patterns (indicates learning/exploration)
const QUESTION_PATTERNS = [
  /^(what|why|how|when|where|who|which|can|could|would|should|is|are|do|does)\b/i,
  /\?$/,
  /\b(explain|tell me|help me understand|what does .* mean)\b/i,
];

// Speaker change indicators
const SPEAKER_CHANGE_PATTERNS = [
  /^(hi|hello|hey)\s*(,|!|\.)?\s*(i'm|my name is|this is)/i,
  /\b(this is|speaking|it's me)\b/i,
  /\b(can i ask|i have a question|i need help)\b/i, // New topic/person
];

// ============================================================================
// ADAPTIVE COMMUNICATION SERVICE
// ============================================================================

class AdaptiveCommunicationService {
  private contexts: Map<string, ConversationContext> = new Map();
  private knownSpeakers: Map<string, SpeakerProfile> = new Map();
  private loadedUsers: Set<string> = new Set(); // Track which users' data we've loaded
  private readonly MAX_HISTORY = 10;
  private currentUserId: string = 'default';

  /**
   * Load speaker profiles from file storage for a user
   */
  loadUserSpeakers(userId: string): void {
    if (this.loadedUsers.has(userId)) return; // Already loaded

    const data = loadSpeakerData(userId);
    if (data) {
      // Convert stored data back to Map
      for (const [id, profile] of Object.entries(data.speakers)) {
        // Restore Date objects
        profile.firstSeen = new Date(profile.firstSeen);
        profile.lastSeen = new Date(profile.lastSeen);
        this.knownSpeakers.set(id, profile);
      }
      console.log(`[AdaptiveCommunication] Loaded ${Object.keys(data.speakers).length} speakers for user ${userId}`);
    }
    this.loadedUsers.add(userId);
    this.currentUserId = userId;
  }

  /**
   * Save speaker profiles to file storage
   */
  private saveUserSpeakers(userId: string): void {
    const speakers: Record<string, SpeakerProfile> = {};
    const familyMembers: string[] = [];

    for (const [id, profile] of this.knownSpeakers) {
      speakers[id] = profile;
      if (profile.relationship) {
        familyMembers.push(id);
      }
    }

    const data: StoredSpeakerData = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      speakers,
      familyMembers,
    };

    saveSpeakerData(userId, data);
  }

  /**
   * Set current user context (for file storage)
   */
  setCurrentUser(userId: string): void {
    this.currentUserId = userId;
    this.loadUserSpeakers(userId);
  }

  // ============================================================================
  // VOICE/SPEAKER RECOGNITION
  // ============================================================================

  /**
   * Identify who is speaking based on voice metadata and/or text patterns
   * This is the main entry point for voice recognition
   */
  identifySpeaker(
    sessionId: string,
    message: string,
    voiceMetadata?: {
      pitchHz?: number;
      speakingRate?: number;
      voiceId?: string;
    }
  ): VoiceRecognitionResult {
    const context = this.contexts.get(sessionId) || this.createContext(sessionId);

    // 1. Check for explicit name introduction
    const detectedName = this.detectNameFromMessage(message);

    // 2. Detect age group from voice or text patterns
    const ageGroup = this.detectAgeGroup(message, voiceMetadata);

    // 3. Create style fingerprint for matching
    const fingerprint = this.createStyleFingerprint(message);

    // 4. Try to match to known speaker
    const matchedSpeaker = this.matchToKnownSpeaker(fingerprint, ageGroup, voiceMetadata);

    // 5. If new speaker, create profile
    let speakerId: string;
    let isNewVoice = false;
    let profile: SpeakerProfile;

    if (matchedSpeaker && matchedSpeaker.confidence > 0.7) {
      speakerId = matchedSpeaker.id;
      profile = matchedSpeaker;
      // Update profile with new info
      if (detectedName && !profile.name) {
        profile.name = detectedName;
      }
      profile.messageCount++;
      profile.lastSeen = new Date();
    } else {
      // New speaker
      isNewVoice = true;
      speakerId = `speaker_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      profile = this.createSpeakerProfile(speakerId, message, ageGroup, detectedName, fingerprint);
      this.knownSpeakers.set(speakerId, profile);
    }

    // 6. Generate appropriate greeting
    const greeting = this.generatePersonalizedGreeting(profile, isNewVoice, context);

    // Update context
    context.currentSpeaker = speakerId;
    if (ageGroup === 'child') {
      context.childDetected = true;
      context.familyMode = true;
    }
    this.contexts.set(sessionId, context);

    return {
      speakerId,
      speakerName: profile.name,
      confidence: matchedSpeaker?.confidence ?? 0.5,
      isNewVoice,
      matchedProfile: profile,
      suggestedGreeting: greeting,
      ageGroup,
    };
  }

  /**
   * Detect name from message
   */
  private detectNameFromMessage(message: string): string | undefined {
    for (const pattern of NAME_INTRO_PATTERNS) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return undefined;
  }

  /**
   * Detect age group from voice characteristics and text patterns
   */
  private detectAgeGroup(
    message: string,
    voiceMetadata?: { pitchHz?: number; speakingRate?: number }
  ): 'child' | 'teen' | 'adult' | 'senior' {
    let childScore = 0;
    let teenScore = 0;
    let adultScore = 0;
    let seniorScore = 0;

    // Voice-based detection (if available)
    if (voiceMetadata?.pitchHz) {
      // Higher pitch often indicates child/female
      if (voiceMetadata.pitchHz > 250) childScore += 3;
      else if (voiceMetadata.pitchHz > 200) teenScore += 2;
      else if (voiceMetadata.pitchHz > 120) adultScore += 2;
      else seniorScore += 1;
    }

    // Text-based detection
    // Child patterns
    if (CHILD_PATTERNS.some(p => p.test(message))) childScore += 2;
    if (/\b(mommy|daddy|my mom|my dad)\b/i.test(message)) childScore += 3;
    if (/[!?]{3,}/.test(message)) childScore += 1; // Excessive punctuation

    // Teen patterns
    if (/\b(lol|omg|idk|tbh|ngl|bruh|fr fr)\b/i.test(message)) teenScore += 2;
    if (/\b(literally|like,|so like|basically)\b/i.test(message)) teenScore += 1;

    // Adult patterns
    if (PROFESSIONAL_PATTERNS.some(p => p.test(message))) adultScore += 2;
    if (TECHNICAL_PATTERNS.some(p => p.test(message))) adultScore += 2;

    // Word complexity (simple = younger)
    const words = message.split(/\s+/);
    const avgLen = words.reduce((a, w) => a + w.length, 0) / words.length;
    if (avgLen < 4) childScore += 1;
    else if (avgLen > 6) adultScore += 1;

    // Determine highest score
    const scores = [
      { age: 'child' as const, score: childScore },
      { age: 'teen' as const, score: teenScore },
      { age: 'adult' as const, score: adultScore },
      { age: 'senior' as const, score: seniorScore },
    ];
    scores.sort((a, b) => b.score - a.score);

    // Default to adult if no clear signal
    return scores[0].score > 0 ? scores[0].age : 'adult';
  }

  /**
   * Create a style fingerprint for speaker matching
   */
  private createStyleFingerprint(message: string): VoiceFingerprint {
    const words = message.split(/\s+/).filter(w => w.length > 0);
    const sentences = message.split(/[.!?]+/).filter(s => s.trim().length > 0);

    const avgWordLength = words.length > 0
      ? words.reduce((a, w) => a + w.length, 0) / words.length
      : 0;

    const avgSentenceLength = sentences.length > 0
      ? words.length / sentences.length
      : words.length;

    // Punctuation density
    const punctuation = message.match(/[.!?,;:]/g) || [];
    const punctuationDensity = punctuation.length / Math.max(words.length, 1);

    // Emoji density
    const emojis = message.match(/[\u{1F300}-\u{1F9FF}]/gu) || [];
    const emojiDensity = emojis.length / Math.max(words.length, 1);

    // Capitalization style
    let capStyle: 'normal' | 'all_lower' | 'all_caps' | 'mixed' = 'normal';
    if (message === message.toLowerCase()) capStyle = 'all_lower';
    else if (message === message.toUpperCase()) capStyle = 'all_caps';
    else if (/[a-z][A-Z]/.test(message)) capStyle = 'mixed';

    // Common starters (first word patterns)
    const firstWord = words[0]?.toLowerCase() || '';

    return {
      avgWordLength,
      avgSentenceLength,
      punctuationDensity,
      emojiDensity,
      capitalizationStyle: capStyle,
      commonStarters: [firstWord],
      uniquePhrases: [],
    };
  }

  /**
   * Match fingerprint to known speakers
   */
  private matchToKnownSpeaker(
    fingerprint: VoiceFingerprint,
    ageGroup: 'child' | 'teen' | 'adult' | 'senior',
    voiceMetadata?: { voiceId?: string }
  ): SpeakerProfile | undefined {
    // If we have a voice ID from the speech system, use it directly
    if (voiceMetadata?.voiceId) {
      for (const [, profile] of this.knownSpeakers) {
        if (profile.id === voiceMetadata.voiceId) {
          return { ...profile, confidence: 0.95 };
        }
      }
    }

    // Otherwise, match by style fingerprint
    let bestMatch: SpeakerProfile | undefined;
    let bestScore = 0;

    for (const [, profile] of this.knownSpeakers) {
      // Age group must match
      if (profile.estimatedAge !== ageGroup) continue;

      // Calculate similarity score
      let score = 0;
      const pf = profile.styleFingerprint;

      // Word length similarity
      const wordLenDiff = Math.abs(pf.avgWordLength - fingerprint.avgWordLength);
      if (wordLenDiff < 1) score += 0.3;
      else if (wordLenDiff < 2) score += 0.15;

      // Sentence length similarity
      const sentLenDiff = Math.abs(pf.avgSentenceLength - fingerprint.avgSentenceLength);
      if (sentLenDiff < 3) score += 0.2;

      // Punctuation style
      if (pf.punctuationStyle === (fingerprint.punctuationDensity > 0.1 ? 'expressive' : 'standard')) {
        score += 0.15;
      }

      // Capitalization
      if (pf.avgWordLength > 0 && fingerprint.capitalizationStyle ===
          (pf.avgWordLength < 4 ? 'all_lower' : 'normal')) {
        score += 0.1;
      }

      // Greeting style
      if (pf.greetingStyle && fingerprint.commonStarters.includes(pf.greetingStyle)) {
        score += 0.25;
      }

      if (score > bestScore && score > 0.5) {
        bestScore = score;
        bestMatch = { ...profile, confidence: score };
      }
    }

    return bestMatch;
  }

  /**
   * Create new speaker profile
   */
  private createSpeakerProfile(
    id: string,
    message: string,
    ageGroup: 'child' | 'teen' | 'adult' | 'senior',
    name: string | undefined,
    fingerprint: VoiceFingerprint
  ): SpeakerProfile {
    const now = new Date();
    return {
      id,
      name,
      detectedLanguage: this.detectLanguage(message),
      communicationStyle: this.detectCommunicationStyle(message),
      vocabularyLevel: this.detectVocabularyLevel(message),
      formalityLevel: this.detectFormalityLevel(message),
      estimatedAge: ageGroup,
      messageCount: 1,
      firstSeen: now,
      lastSeen: now,
      confidence: 0.5,
      styleFingerprint: {
        avgWordLength: fingerprint.avgWordLength,
        avgMessageLength: fingerprint.avgSentenceLength,
        punctuationStyle: fingerprint.punctuationDensity > 0.15 ? 'expressive' :
                         fingerprint.punctuationDensity > 0.05 ? 'standard' : 'minimal',
        emojiUsage: fingerprint.emojiDensity > 0.1 ? 'frequent' :
                   fingerprint.emojiDensity > 0.03 ? 'moderate' :
                   fingerprint.emojiDensity > 0 ? 'rare' : 'none',
        greetingStyle: fingerprint.commonStarters[0],
        signaturePatterns: [],
      },
      interests: [],
      rememberedFacts: [],
    };
  }

  /**
   * Generate personalized greeting based on who is speaking
   */
  private generatePersonalizedGreeting(
    profile: SpeakerProfile,
    isNewVoice: boolean,
    context: ConversationContext
  ): string {
    const age = profile.estimatedAge || 'adult';
    const name = profile.name || profile.nickname;

    // Returning speaker with name
    if (!isNewVoice && name && profile.messageCount > 1) {
      const greetings = age === 'child' || age === 'teen'
        ? GREETINGS.returning_child
        : GREETINGS.returning_adult;
      const template = greetings[Math.floor(Math.random() * greetings.length)];
      return template.replace('{name}', name);
    }

    // New or unknown speaker - use age-appropriate greeting
    const greetings = GREETINGS[age] || GREETINGS.adult;
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  /**
   * Register a family member for easier recognition
   */
  registerFamilyMember(
    name: string,
    relationship: 'parent' | 'child' | 'grandparent' | 'other',
    ageGroup: 'child' | 'teen' | 'adult' | 'senior',
    preferredLanguage?: SupportedLanguage
  ): string {
    const id = `family_${name.toLowerCase()}_${Date.now()}`;
    const now = new Date();

    const profile: SpeakerProfile = {
      id,
      name,
      relationship,
      detectedLanguage: preferredLanguage || 'en',
      preferredLanguage,
      communicationStyle: ageGroup === 'child' ? 'friendly' : 'casual',
      vocabularyLevel: ageGroup === 'child' ? 'simple' : 'intermediate',
      formalityLevel: 'casual',
      estimatedAge: ageGroup,
      messageCount: 0,
      firstSeen: now,
      lastSeen: now,
      confidence: 0.9, // High confidence for registered members
      styleFingerprint: {
        avgWordLength: 0,
        avgMessageLength: 0,
        punctuationStyle: 'standard',
        emojiUsage: ageGroup === 'child' ? 'moderate' : 'rare',
        signaturePatterns: [],
      },
      interests: [],
      rememberedFacts: [],
    };

    this.knownSpeakers.set(id, profile);
    return id;
  }

  /**
   * Remember a fact about a speaker
   */
  rememberFact(speakerId: string, fact: string): void {
    const profile = this.knownSpeakers.get(speakerId);
    if (profile) {
      profile.rememberedFacts.push(fact);
      // Keep only last 20 facts
      if (profile.rememberedFacts.length > 20) {
        profile.rememberedFacts.shift();
      }
    }
  }

  /**
   * Get all known family members
   */
  getFamilyMembers(): SpeakerProfile[] {
    return Array.from(this.knownSpeakers.values())
      .filter(p => p.relationship)
      .sort((a, b) => (b.messageCount || 0) - (a.messageCount || 0));
  }

  // ============================================================================
  // USER-EDITABLE PROFILE MANAGEMENT
  // ============================================================================

  /**
   * Get all speakers for user to view/edit
   */
  getAllSpeakers(): SpeakerProfile[] {
    return Array.from(this.knownSpeakers.values())
      .sort((a, b) => (b.messageCount || 0) - (a.messageCount || 0));
  }

  /**
   * Get a specific speaker profile
   */
  getSpeaker(speakerId: string): SpeakerProfile | undefined {
    return this.knownSpeakers.get(speakerId);
  }

  /**
   * Update a speaker profile (user editable)
   * Users can edit: name, nickname, relationship, preferredLanguage, interests
   */
  updateSpeaker(
    speakerId: string,
    updates: {
      name?: string;
      nickname?: string;
      relationship?: string;
      preferredLanguage?: SupportedLanguage;
      estimatedAge?: 'child' | 'teen' | 'adult' | 'senior';
      interests?: string[];
      rememberedFacts?: string[];
    }
  ): boolean {
    const profile = this.knownSpeakers.get(speakerId);
    if (!profile) return false;

    // Apply updates
    if (updates.name !== undefined) profile.name = updates.name;
    if (updates.nickname !== undefined) profile.nickname = updates.nickname;
    if (updates.relationship !== undefined) profile.relationship = updates.relationship;
    if (updates.preferredLanguage !== undefined) profile.preferredLanguage = updates.preferredLanguage;
    if (updates.estimatedAge !== undefined) profile.estimatedAge = updates.estimatedAge;
    if (updates.interests !== undefined) profile.interests = updates.interests;
    if (updates.rememberedFacts !== undefined) profile.rememberedFacts = updates.rememberedFacts;

    // Save to file
    this.saveUserSpeakers(this.currentUserId);
    return true;
  }

  /**
   * Delete a speaker profile
   */
  deleteSpeaker(speakerId: string): boolean {
    const deleted = this.knownSpeakers.delete(speakerId);
    if (deleted) {
      this.saveUserSpeakers(this.currentUserId);
    }
    return deleted;
  }

  /**
   * Merge two speaker profiles (when user identifies same person)
   */
  mergeSpeakers(keepId: string, mergeId: string): boolean {
    const keep = this.knownSpeakers.get(keepId);
    const merge = this.knownSpeakers.get(mergeId);

    if (!keep || !merge) return false;

    // Merge data (keep profile gets priority)
    keep.name = keep.name || merge.name;
    keep.nickname = keep.nickname || merge.nickname;
    keep.relationship = keep.relationship || merge.relationship;
    keep.messageCount += merge.messageCount;
    keep.interests = [...new Set([...keep.interests, ...merge.interests])];
    keep.rememberedFacts = [...keep.rememberedFacts, ...merge.rememberedFacts].slice(-20);

    // Use earliest firstSeen
    if (merge.firstSeen < keep.firstSeen) {
      keep.firstSeen = merge.firstSeen;
    }

    // Delete merged profile
    this.knownSpeakers.delete(mergeId);
    this.saveUserSpeakers(this.currentUserId);

    return true;
  }

  /**
   * Export speaker data as JSON (for backup/editing)
   */
  exportSpeakersAsJson(): string {
    const speakers = this.getAllSpeakers();
    return JSON.stringify({
      exported: new Date().toISOString(),
      version: '1.0.0',
      speakers: speakers.map(s => ({
        id: s.id,
        name: s.name,
        nickname: s.nickname,
        relationship: s.relationship,
        preferredLanguage: s.preferredLanguage,
        estimatedAge: s.estimatedAge,
        interests: s.interests,
        rememberedFacts: s.rememberedFacts,
        messageCount: s.messageCount,
        firstSeen: s.firstSeen,
        lastSeen: s.lastSeen,
      })),
    }, null, 2);
  }

  /**
   * Import speaker data from JSON (user restore/edit)
   */
  importSpeakersFromJson(json: string): { imported: number; errors: string[] } {
    const errors: string[] = [];
    let imported = 0;

    try {
      const data = JSON.parse(json);

      if (!data.speakers || !Array.isArray(data.speakers)) {
        errors.push('Invalid format: missing speakers array');
        return { imported, errors };
      }

      for (const speaker of data.speakers) {
        if (!speaker.id) {
          errors.push('Speaker missing ID, skipped');
          continue;
        }

        const existing = this.knownSpeakers.get(speaker.id);
        if (existing) {
          // Update existing
          if (speaker.name) existing.name = speaker.name;
          if (speaker.nickname) existing.nickname = speaker.nickname;
          if (speaker.relationship) existing.relationship = speaker.relationship;
          if (speaker.preferredLanguage) existing.preferredLanguage = speaker.preferredLanguage;
          if (speaker.estimatedAge) existing.estimatedAge = speaker.estimatedAge;
          if (speaker.interests) existing.interests = speaker.interests;
          if (speaker.rememberedFacts) existing.rememberedFacts = speaker.rememberedFacts;
        } else {
          // Create new with basic profile
          const now = new Date();
          this.knownSpeakers.set(speaker.id, {
            id: speaker.id,
            name: speaker.name,
            nickname: speaker.nickname,
            relationship: speaker.relationship,
            detectedLanguage: speaker.preferredLanguage || 'en',
            preferredLanguage: speaker.preferredLanguage,
            communicationStyle: 'friendly',
            vocabularyLevel: 'intermediate',
            formalityLevel: 'neutral',
            estimatedAge: speaker.estimatedAge || 'adult',
            messageCount: speaker.messageCount || 0,
            firstSeen: speaker.firstSeen ? new Date(speaker.firstSeen) : now,
            lastSeen: speaker.lastSeen ? new Date(speaker.lastSeen) : now,
            confidence: 0.8,
            styleFingerprint: {
              avgWordLength: 0,
              avgMessageLength: 0,
              punctuationStyle: 'standard',
              emojiUsage: 'rare',
              signaturePatterns: [],
            },
            interests: speaker.interests || [],
            rememberedFacts: speaker.rememberedFacts || [],
          });
        }
        imported++;
      }

      this.saveUserSpeakers(this.currentUserId);
    } catch (e) {
      errors.push(`Parse error: ${e}`);
    }

    return { imported, errors };
  }

  /**
   * Add a fact about a speaker (user can also add manually)
   */
  addFact(speakerId: string, fact: string): boolean {
    const profile = this.knownSpeakers.get(speakerId);
    if (!profile) return false;

    if (!profile.rememberedFacts.includes(fact)) {
      profile.rememberedFacts.push(fact);
      // Keep only last 20 facts
      if (profile.rememberedFacts.length > 20) {
        profile.rememberedFacts.shift();
      }
      this.saveUserSpeakers(this.currentUserId);
    }
    return true;
  }

  /**
   * Remove a remembered fact
   */
  removeFact(speakerId: string, fact: string): boolean {
    const profile = this.knownSpeakers.get(speakerId);
    if (!profile) return false;

    const index = profile.rememberedFacts.indexOf(fact);
    if (index > -1) {
      profile.rememberedFacts.splice(index, 1);
      this.saveUserSpeakers(this.currentUserId);
      return true;
    }
    return false;
  }

  /**
   * Get storage file path for user reference
   */
  getStorageFilePath(): string {
    return getSpeakerStoragePath(this.currentUserId);
  }

  /**
   * Analyze a message and determine appropriate adaptations
   * Non-invasive: Only suggests changes when confident
   */
  analyzeMessage(
    sessionId: string,
    message: string,
    userId?: string
  ): AdaptationResult {
    // Get or create context
    let context = this.contexts.get(sessionId);
    if (!context) {
      context = this.createContext(sessionId);
      this.contexts.set(sessionId, context);
    }

    // Detect characteristics
    const language = this.detectLanguage(message);
    const style = this.detectCommunicationStyle(message);
    const vocabulary = this.detectVocabularyLevel(message);
    const formality = this.detectFormalityLevel(message);
    const speakerChange = this.detectSpeakerChange(message, context);
    const childLikely = this.detectChildPatterns(message);

    // Calculate confidence
    const confidence = this.calculateConfidence(message, {
      language,
      style,
      vocabulary,
      formality,
    });

    // Update context
    this.updateContext(context, {
      language,
      style,
      userId,
      speakerChange,
      childLikely,
    });

    // Determine if we should adapt (non-invasive threshold)
    const shouldAdapt = confidence > 0.6 || speakerChange || childLikely;

    // Generate system prompt additions (only when needed)
    const systemPromptAdditions = shouldAdapt
      ? this.generateAdaptationPrompt(context, {
          language,
          style,
          vocabulary,
          formality,
          childLikely,
        })
      : '';

    return {
      shouldAdapt,
      language,
      style,
      vocabularyLevel: vocabulary,
      formalityLevel: formality,
      systemPromptAdditions,
      speakerChange,
      confidence,
    };
  }

  /**
   * Detect language (wrapper around BilingualService)
   */
  private detectLanguage(message: string): SupportedLanguage {
    const result = detectLanguage(message);
    return result.confidence > 0.5 ? result.language : 'en';
  }

  /**
   * Detect communication style from message patterns
   */
  private detectCommunicationStyle(message: string): CommunicationStyle {
    const scores: Record<CommunicationStyle, number> = {
      casual: 0,
      friendly: 0,
      professional: 0,
      technical: 0,
      academic: 0,
      supportive: 0,
    };

    // Check patterns
    for (const pattern of CASUAL_PATTERNS) {
      if (pattern.test(message)) scores.casual += 2;
    }
    for (const pattern of FORMAL_PATTERNS) {
      if (pattern.test(message)) scores.academic += 2;
    }
    for (const pattern of TECHNICAL_PATTERNS) {
      if (pattern.test(message)) scores.technical += 3;
    }
    for (const pattern of PROFESSIONAL_PATTERNS) {
      if (pattern.test(message)) scores.professional += 2;
    }

    // Check message characteristics
    if (message.length < 50) scores.casual += 1;
    if (message.length > 200) scores.professional += 1;
    if (QUESTION_PATTERNS.some(p => p.test(message))) {
      scores.friendly += 1;
    }

    // Find highest score
    let maxStyle: CommunicationStyle = 'friendly'; // Default
    let maxScore = 0;
    for (const [style, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxStyle = style as CommunicationStyle;
      }
    }

    return maxStyle;
  }

  /**
   * Detect vocabulary level from word complexity
   */
  private detectVocabularyLevel(message: string): VocabularyLevel {
    const words = message.toLowerCase().split(/\s+/);
    const avgWordLength = words.reduce((a, w) => a + w.length, 0) / words.length;

    // Technical indicators
    if (TECHNICAL_PATTERNS.some(p => p.test(message))) {
      return 'technical';
    }

    // Simple vocabulary (short words, basic structure)
    if (avgWordLength < 4.5 && words.length < 15) {
      return 'simple';
    }

    // Advanced vocabulary (longer words, complex sentences)
    if (avgWordLength > 6 || FORMAL_PATTERNS.some(p => p.test(message))) {
      return 'advanced';
    }

    return 'intermediate';
  }

  /**
   * Detect formality level
   */
  private detectFormalityLevel(message: string): FormalityLevel {
    let score = 0; // -2 to +2 scale

    // Casual indicators (negative)
    if (CASUAL_PATTERNS.some(p => p.test(message))) score -= 1;
    if (/[!]{2,}|[?]{2,}/.test(message)) score -= 1;
    if (/\b(lol|haha|omg)\b/i.test(message)) score -= 2;

    // Formal indicators (positive)
    if (FORMAL_PATTERNS.some(p => p.test(message))) score += 2;
    if (PROFESSIONAL_PATTERNS.some(p => p.test(message))) score += 1;
    if (/^(dear|hello|good (morning|afternoon|evening))/i.test(message)) score += 1;

    // Map score to level
    if (score <= -2) return 'very_casual';
    if (score === -1) return 'casual';
    if (score === 0) return 'neutral';
    if (score === 1) return 'formal';
    return 'very_formal';
  }

  /**
   * Detect if a child might be speaking
   */
  private detectChildPatterns(message: string): boolean {
    let childIndicators = 0;

    for (const pattern of CHILD_PATTERNS) {
      if (pattern.test(message)) childIndicators++;
    }

    // Check for simple sentence structure
    const words = message.split(/\s+/);
    const avgWordLength = words.reduce((a, w) => a + w.length, 0) / words.length;
    if (avgWordLength < 4) childIndicators++;

    // Multiple questions in a row
    const questionCount = (message.match(/\?/g) || []).length;
    if (questionCount > 2) childIndicators++;

    return childIndicators >= 2;
  }

  /**
   * Detect if the speaker might have changed
   */
  private detectSpeakerChange(
    message: string,
    context: ConversationContext
  ): boolean {
    // Check for explicit speaker change patterns
    if (SPEAKER_CHANGE_PATTERNS.some(p => p.test(message))) {
      return true;
    }

    // Check for dramatic style shift
    if (context.styleHistory.length > 0) {
      const prevStyle = context.styleHistory[context.styleHistory.length - 1];
      const currentStyle = this.detectCommunicationStyle(message);

      // Big style jump suggests different person
      const styleDistance = this.getStyleDistance(prevStyle, currentStyle);
      if (styleDistance > 2) return true;
    }

    // Check for language switch
    if (context.languageHistory.length > 0) {
      const prevLang = context.languageHistory[context.languageHistory.length - 1];
      const currentLang = this.detectLanguage(message);
      if (prevLang !== currentLang && prevLang !== 'en' && currentLang !== 'en') {
        // Switching between two non-English languages suggests different person
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate style distance for speaker change detection
   */
  private getStyleDistance(a: CommunicationStyle, b: CommunicationStyle): number {
    const styles: CommunicationStyle[] = [
      'casual', 'friendly', 'professional', 'technical', 'academic', 'supportive'
    ];
    const indexA = styles.indexOf(a);
    const indexB = styles.indexOf(b);
    return Math.abs(indexA - indexB);
  }

  /**
   * Calculate overall confidence in detection
   */
  private calculateConfidence(
    message: string,
    detected: {
      language: SupportedLanguage;
      style: CommunicationStyle;
      vocabulary: VocabularyLevel;
      formality: FormalityLevel;
    }
  ): number {
    let confidence = 0.5; // Base confidence

    // Longer messages = more signal
    if (message.length > 50) confidence += 0.1;
    if (message.length > 100) confidence += 0.1;

    // Strong pattern matches increase confidence
    if (TECHNICAL_PATTERNS.some(p => p.test(message))) confidence += 0.2;
    if (FORMAL_PATTERNS.some(p => p.test(message))) confidence += 0.15;
    if (CASUAL_PATTERNS.filter(p => p.test(message)).length > 2) confidence += 0.15;

    // Non-English language detection is usually reliable
    if (detected.language !== 'en') confidence += 0.2;

    return Math.min(confidence, 1.0);
  }

  /**
   * Create new conversation context
   */
  private createContext(sessionId: string): ConversationContext {
    return {
      sessionId,
      speakers: new Map(),
      currentSpeaker: null,
      languageHistory: [],
      styleHistory: [],
      isMultiSpeaker: false,
      familyMode: false,
      childDetected: false,
    };
  }

  /**
   * Update context with new message analysis
   */
  private updateContext(
    context: ConversationContext,
    analysis: {
      language: SupportedLanguage;
      style: CommunicationStyle;
      userId?: string;
      speakerChange: boolean;
      childLikely: boolean;
    }
  ): void {
    // Update history (keep last N)
    context.languageHistory.push(analysis.language);
    if (context.languageHistory.length > this.MAX_HISTORY) {
      context.languageHistory.shift();
    }

    context.styleHistory.push(analysis.style);
    if (context.styleHistory.length > this.MAX_HISTORY) {
      context.styleHistory.shift();
    }

    // Track multi-speaker
    if (analysis.speakerChange) {
      context.isMultiSpeaker = true;
    }

    // Track child detection
    if (analysis.childLikely) {
      context.childDetected = true;
      context.familyMode = true; // Enable family mode automatically
    }

    // Update speaker profile
    const speakerId = analysis.userId || 'default';
    const existingProfile = context.speakers.get(speakerId);

    if (existingProfile) {
      existingProfile.detectedLanguage = analysis.language;
      existingProfile.communicationStyle = analysis.style;
      existingProfile.messageCount++;
      existingProfile.lastSeen = new Date();
    } else {
      context.speakers.set(speakerId, {
        id: speakerId,
        detectedLanguage: analysis.language,
        communicationStyle: analysis.style,
        vocabularyLevel: 'intermediate',
        formalityLevel: 'neutral',
        messageCount: 1,
        lastSeen: new Date(),
        confidence: 0.5,
      });
    }

    context.currentSpeaker = speakerId;
  }

  /**
   * Generate natural, non-invasive adaptation prompt
   */
  private generateAdaptationPrompt(
    context: ConversationContext,
    detected: {
      language: SupportedLanguage;
      style: CommunicationStyle;
      vocabulary: VocabularyLevel;
      formality: FormalityLevel;
      childLikely: boolean;
    }
  ): string {
    const parts: string[] = [];

    // Child-appropriate communication (highest priority for safety)
    if (detected.childLikely || context.childDetected) {
      parts.push(`
[COMMUNICATION ADAPTATION - Child Detected]
A young person appears to be in this conversation. Please:
- Use simple, age-appropriate language
- Be patient and encouraging
- Avoid complex jargon
- Keep responses concise and clear
- Be extra supportive and positive
- If discussing homework or learning, explain step-by-step`);
    }

    // Multi-speaker awareness
    if (context.isMultiSpeaker) {
      parts.push(`
[COMMUNICATION ADAPTATION - Multiple Speakers]
This appears to be a shared device or family conversation.
Adapt naturally to each person's communication style.`);
    }

    // Style adaptation (subtle)
    if (detected.style === 'casual' && detected.formality === 'very_casual') {
      parts.push(`
[STYLE] Casual conversation - feel free to be relaxed and conversational.`);
    } else if (detected.style === 'technical') {
      parts.push(`
[STYLE] Technical discussion - you can use domain-specific terminology.`);
    } else if (detected.style === 'professional') {
      parts.push(`
[STYLE] Professional context - maintain appropriate formality.`);
    }

    // Vocabulary level (only when clearly different from default)
    if (detected.vocabulary === 'simple') {
      parts.push(`
[VOCABULARY] Use simpler words and shorter sentences for clarity.`);
    } else if (detected.vocabulary === 'advanced') {
      parts.push(`
[VOCABULARY] Rich vocabulary is appropriate for this conversation.`);
    }

    return parts.join('\n');
  }

  /**
   * Get context for a session
   */
  getContext(sessionId: string): ConversationContext | undefined {
    return this.contexts.get(sessionId);
  }

  /**
   * Clear context (e.g., when session ends)
   */
  clearContext(sessionId: string): void {
    this.contexts.delete(sessionId);
  }

  /**
   * Check if family mode is active
   */
  isFamilyMode(sessionId: string): boolean {
    return this.contexts.get(sessionId)?.familyMode ?? false;
  }
}

// ============================================================================
// NAME DETECTION PATTERNS
// ============================================================================

const NAME_INTRO_PATTERNS = [
  /(?:hi|hello|hey)[\s,!.]*(?:i'm|i am|my name is|this is|it's)\s+([A-Z][a-z]+)/i,
  /(?:it's|this is)\s+([A-Z][a-z]+)(?:\s+here)?/i,
  /([A-Z][a-z]+)\s+(?:here|speaking)/i,
  /^([A-Z][a-z]+)[!.,]?\s+(?:can you|could you|i need|i want|help)/i,
];

const RELATIONSHIP_PATTERNS = {
  parent: [/\b(mom|dad|mother|father|mama|papa|mum)\b/i],
  child: [/\b(mommy|daddy|my mom|my dad)\b/i, /\b(homework|school|teacher)\b/i],
  grandparent: [/\b(grandma|grandpa|grandmother|grandfather|nana|papa|abuela|abuelo)\b/i],
};

// ============================================================================
// VOICE FINGERPRINT ANALYSIS
// ============================================================================

interface VoiceFingerprint {
  // Pitch characteristics (from voice metadata if available)
  pitchRange?: 'high' | 'medium' | 'low';

  // Writing style (always available from text)
  avgWordLength: number;
  avgSentenceLength: number;
  punctuationDensity: number;
  emojiDensity: number;
  capitalizationStyle: 'normal' | 'all_lower' | 'all_caps' | 'mixed';
  commonStarters: string[];
  uniquePhrases: string[];
}

// Singleton instance
let serviceInstance: AdaptiveCommunicationService | null = null;

export function getAdaptiveCommunicationService(): AdaptiveCommunicationService {
  if (!serviceInstance) {
    serviceInstance = new AdaptiveCommunicationService();
  }
  return serviceInstance;
}

export default AdaptiveCommunicationService;
