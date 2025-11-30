/**
 * Driving Music Integration Service
 *
 * Intelligent music selection and playback for EV driving experience.
 * Integrates with:
 * - EV battery/range status
 * - Weather conditions
 * - Driving style and route
 * - Time of day
 * - User preferences
 *
 * Features:
 * - Adaptive mood detection
 * - Energy-aware playlist generation
 * - Voice control integration
 * - Seamless Infinity Assistant integration
 *
 * @author Infinity Assistant
 * @version 1.0.0
 */

import logger from '@/utils/logger';
import type { BatteryState, WeatherConditions, DrivingSensorData } from '@/types/ev-optimization';

// ============================================================================
// TYPES
// ============================================================================

export interface DrivingContext {
  battery: Partial<BatteryState>;
  weather?: Partial<WeatherConditions>;
  driving?: Partial<DrivingSensorData>;
  route?: RouteInfo;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  userMood?: string;
}

export interface RouteInfo {
  distance: number; // km
  estimatedDuration: number; // minutes
  trafficLevel: 'light' | 'moderate' | 'heavy';
  routeType: 'city' | 'highway' | 'scenic' | 'mixed';
}

export interface MusicRecommendation {
  mood: MusicMood;
  genres: string[];
  tempo: TempoRange;
  energy: EnergyLevel;
  playlists: PlaylistSuggestion[];
  reason: string;
  voiceAnnouncement?: string;
}

export type MusicMood =
  | 'calm'
  | 'relaxed'
  | 'balanced'
  | 'upbeat'
  | 'energetic'
  | 'focused'
  | 'adventurous'
  | 'romantic'
  | 'nostalgic';

export type TempoRange = 'slow' | 'moderate' | 'upbeat' | 'fast' | 'varied';

export type EnergyLevel = 'low' | 'medium' | 'high' | 'dynamic';

export interface PlaylistSuggestion {
  name: string;
  description: string;
  genres: string[];
  trackCount: number;
  duration: number; // minutes
  source: 'spotify' | 'apple_music' | 'youtube_music' | 'local';
  uri?: string;
}

export interface DrivingAnnouncement {
  type: 'music' | 'ev_status' | 'navigation' | 'weather' | 'recommendation';
  message: string;
  priority: 'low' | 'medium' | 'high';
  interruptMusic: boolean;
}

// ============================================================================
// DRIVING MUSIC SERVICE
// ============================================================================

export class DrivingMusicService {
  private static instance: DrivingMusicService;
  private currentContext: DrivingContext | null = null;
  private currentRecommendation: MusicRecommendation | null = null;

  private constructor() {}

  static getInstance(): DrivingMusicService {
    if (!DrivingMusicService.instance) {
      DrivingMusicService.instance = new DrivingMusicService();
    }
    return DrivingMusicService.instance;
  }

  // ==========================================================================
  // MAIN RECOMMENDATION ENGINE
  // ==========================================================================

  async getRecommendation(context: DrivingContext): Promise<MusicRecommendation> {
    this.currentContext = context;

    logger.info('[DrivingMusic] Generating recommendation', {
      soc: context.battery.stateOfCharge,
      timeOfDay: context.timeOfDay,
      routeType: context.route?.routeType,
    });

    // Calculate base mood from multiple factors
    const moodFactors = this.analyzeMoodFactors(context);
    const primaryMood = this.determinePrimaryMood(moodFactors);

    // Get appropriate genres
    const genres = this.selectGenres(primaryMood, context);

    // Determine tempo based on driving conditions
    const tempo = this.determineTempo(context);

    // Calculate energy level
    const energy = this.calculateEnergyLevel(context);

    // Generate playlist suggestions
    const playlists = this.generatePlaylistSuggestions(primaryMood, genres, context);

    // Create reason explanation
    const reason = this.generateReasonExplanation(moodFactors, context);

    // Generate voice announcement if appropriate
    const voiceAnnouncement = this.generateVoiceAnnouncement(primaryMood, context);

    const recommendation: MusicRecommendation = {
      mood: primaryMood,
      genres,
      tempo,
      energy,
      playlists,
      reason,
      voiceAnnouncement,
    };

    this.currentRecommendation = recommendation;
    return recommendation;
  }

  // ==========================================================================
  // MOOD ANALYSIS
  // ==========================================================================

  private analyzeMoodFactors(context: DrivingContext): MoodFactors {
    return {
      batteryAnxiety: this.calculateBatteryAnxiety(context.battery),
      timeEnergy: this.calculateTimeEnergy(context.timeOfDay),
      weatherInfluence: this.calculateWeatherInfluence(context.weather),
      routeExcitement: this.calculateRouteExcitement(context.route),
      trafficStress: this.calculateTrafficStress(context.route),
      drivingDynamics: this.calculateDrivingDynamics(context.driving),
    };
  }

  private calculateBatteryAnxiety(battery: Partial<BatteryState>): number {
    const soc = battery.stateOfCharge || 50;

    if (soc < 15) return 0.9; // High anxiety
    if (soc < 25) return 0.6;
    if (soc < 40) return 0.3;
    return 0; // No anxiety
  }

  private calculateTimeEnergy(timeOfDay: string): number {
    switch (timeOfDay) {
      case 'morning': return 0.7; // Rising energy
      case 'afternoon': return 0.5; // Stable
      case 'evening': return 0.3; // Winding down
      case 'night': return 0.2; // Calm
      default: return 0.5;
    }
  }

  private calculateWeatherInfluence(weather?: Partial<WeatherConditions>): number {
    if (!weather) return 0.5;

    let influence = 0.5;

    // Sunny = more upbeat
    if (weather.cloudCover !== undefined && weather.cloudCover < 30) {
      influence += 0.2;
    }

    // Rain = more reflective
    if (weather.precipitation !== undefined && weather.precipitation > 0) {
      influence -= 0.2;
    }

    return Math.max(0, Math.min(1, influence));
  }

  private calculateRouteExcitement(route?: RouteInfo): number {
    if (!route) return 0.5;

    switch (route.routeType) {
      case 'scenic': return 0.8;
      case 'highway': return 0.6;
      case 'mixed': return 0.5;
      case 'city': return 0.3;
      default: return 0.5;
    }
  }

  private calculateTrafficStress(route?: RouteInfo): number {
    if (!route) return 0;

    switch (route.trafficLevel) {
      case 'heavy': return 0.7;
      case 'moderate': return 0.3;
      case 'light': return 0;
      default: return 0;
    }
  }

  private calculateDrivingDynamics(driving?: Partial<DrivingSensorData>): number {
    if (!driving) return 0.5;

    let dynamics = 0.5;

    // Sport mode = more energetic
    if (driving.drivingMode === 'sport') {
      dynamics += 0.3;
    } else if (driving.drivingMode === 'eco') {
      dynamics -= 0.2;
    }

    // High speed = more energy
    if (driving.speed !== undefined && driving.speed > 100) {
      dynamics += 0.2;
    }

    return Math.max(0, Math.min(1, dynamics));
  }

  // ==========================================================================
  // MOOD DETERMINATION
  // ==========================================================================

  private determinePrimaryMood(factors: MoodFactors): MusicMood {
    // High battery anxiety = calm music
    if (factors.batteryAnxiety > 0.6) {
      return 'calm';
    }

    // Heavy traffic = focused music
    if (factors.trafficStress > 0.5) {
      return 'focused';
    }

    // Scenic route = adventurous
    if (factors.routeExcitement > 0.7) {
      return 'adventurous';
    }

    // Night driving = relaxed
    if (factors.timeEnergy < 0.3) {
      return 'relaxed';
    }

    // High dynamics = energetic
    if (factors.drivingDynamics > 0.7) {
      return 'energetic';
    }

    // Morning commute = upbeat
    if (factors.timeEnergy > 0.6 && factors.routeExcitement < 0.5) {
      return 'upbeat';
    }

    return 'balanced';
  }

  // ==========================================================================
  // GENRE SELECTION
  // ==========================================================================

  private selectGenres(mood: MusicMood, context: DrivingContext): string[] {
    const genreMap: Record<MusicMood, string[]> = {
      calm: ['ambient', 'acoustic', 'classical', 'lo-fi'],
      relaxed: ['jazz', 'soul', 'soft rock', 'indie folk'],
      balanced: ['pop', 'indie', 'alternative', 'r&b'],
      upbeat: ['pop', 'dance', 'funk', 'disco'],
      energetic: ['electronic', 'rock', 'hip-hop', 'edm'],
      focused: ['instrumental', 'post-rock', 'minimal', 'study beats'],
      adventurous: ['world', 'indie rock', 'alternative', 'road trip classics'],
      romantic: ['soul', 'r&b', 'soft pop', 'ballads'],
      nostalgic: ['classic rock', '80s', '90s', 'oldies'],
    };

    let genres = genreMap[mood] || genreMap.balanced;

    // Adjust for time of day
    if (context.timeOfDay === 'night') {
      genres = genres.filter(g => !['edm', 'rock'].includes(g));
      genres.push('chill');
    }

    // Adjust for long trips
    if (context.route && context.route.duration > 120) {
      genres.push('road trip');
    }

    return genres.slice(0, 4);
  }

  // ==========================================================================
  // TEMPO & ENERGY
  // ==========================================================================

  private determineTempo(context: DrivingContext): TempoRange {
    const speed = context.driving?.speed || 50;
    const soc = context.battery.stateOfCharge || 50;

    if (soc < 20) return 'slow';
    if (speed > 120) return 'fast';
    if (speed > 80) return 'upbeat';
    if (speed < 40) return 'moderate';

    return 'varied';
  }

  private calculateEnergyLevel(context: DrivingContext): EnergyLevel {
    const soc = context.battery.stateOfCharge || 50;
    const mode = context.driving?.drivingMode;

    if (soc < 25) return 'low';
    if (mode === 'sport') return 'high';
    if (mode === 'eco') return 'low';
    if (context.route?.routeType === 'scenic') return 'dynamic';

    return 'medium';
  }

  // ==========================================================================
  // PLAYLIST GENERATION
  // ==========================================================================

  private generatePlaylistSuggestions(
    mood: MusicMood,
    genres: string[],
    context: DrivingContext
  ): PlaylistSuggestion[] {
    const duration = context.route?.estimatedDuration || 60;
    const playlists: PlaylistSuggestion[] = [];

    // Primary mood playlist
    playlists.push({
      name: `${mood.charAt(0).toUpperCase() + mood.slice(1)} Drive`,
      description: `Perfect ${mood} music for your journey`,
      genres,
      trackCount: Math.ceil(duration / 3.5),
      duration,
      source: 'spotify',
    });

    // Time-based playlist
    const timePlaylist = this.getTimeBasedPlaylist(context.timeOfDay, duration);
    if (timePlaylist) playlists.push(timePlaylist);

    // EV-themed playlist
    playlists.push({
      name: 'Electric Dreams',
      description: 'Futuristic sounds for your electric journey',
      genres: ['electronic', 'synth', 'ambient'],
      trackCount: Math.ceil(duration / 4),
      duration,
      source: 'spotify',
    });

    // Route-specific playlist
    if (context.route?.routeType === 'scenic') {
      playlists.push({
        name: 'Scenic Route',
        description: 'Music to match the beautiful views',
        genres: ['world', 'acoustic', 'instrumental'],
        trackCount: Math.ceil(duration / 4),
        duration,
        source: 'spotify',
      });
    }

    return playlists.slice(0, 4);
  }

  private getTimeBasedPlaylist(timeOfDay: string, duration: number): PlaylistSuggestion | null {
    switch (timeOfDay) {
      case 'morning':
        return {
          name: 'Morning Commute',
          description: 'Start your day right with uplifting tunes',
          genres: ['pop', 'indie', 'coffee shop'],
          trackCount: Math.ceil(duration / 3.5),
          duration,
          source: 'spotify',
        };
      case 'evening':
        return {
          name: 'Evening Wind Down',
          description: 'Relaxing music for the drive home',
          genres: ['chill', 'jazz', 'acoustic'],
          trackCount: Math.ceil(duration / 4),
          duration,
          source: 'spotify',
        };
      case 'night':
        return {
          name: 'Night Drive',
          description: 'Atmospheric sounds for after dark',
          genres: ['synthwave', 'ambient', 'lo-fi'],
          trackCount: Math.ceil(duration / 4),
          duration,
          source: 'spotify',
        };
      default:
        return null;
    }
  }

  // ==========================================================================
  // VOICE ANNOUNCEMENTS
  // ==========================================================================

  private generateReasonExplanation(factors: MoodFactors, context: DrivingContext): string {
    const reasons: string[] = [];

    if (factors.batteryAnxiety > 0.5) {
      reasons.push('calm music to help with low battery');
    }

    if (factors.trafficStress > 0.5) {
      reasons.push('focused beats for heavy traffic');
    }

    if (factors.routeExcitement > 0.6) {
      reasons.push('adventurous tracks for your scenic route');
    }

    if (context.timeOfDay === 'morning') {
      reasons.push('uplifting tunes to start your day');
    }

    if (reasons.length === 0) {
      reasons.push('balanced playlist for comfortable driving');
    }

    return `Selected ${reasons.join(' and ')}.`;
  }

  private generateVoiceAnnouncement(mood: MusicMood, context: DrivingContext): string {
    const soc = context.battery.stateOfCharge || 50;
    const range = (context.battery as { estimatedRange?: number }).estimatedRange || 200;

    let announcement = '';

    // Battery status announcement
    if (soc < 20) {
      announcement += `Battery at ${soc}%. Range is ${range} kilometers. I've selected calming music to help you relax while we find a charging station. `;
    } else if (soc > 90) {
      announcement += `Fully charged and ready to go! `;
    }

    // Music selection announcement
    announcement += `Now playing ${mood} music for your drive. `;

    // Route-specific
    if (context.route) {
      const mins = context.route.estimatedDuration;
      announcement += `${mins} minute journey ahead. Enjoy the ride!`;
    }

    return announcement;
  }

  // ==========================================================================
  // EV STATUS ANNOUNCEMENTS
  // ==========================================================================

  generateEVAnnouncement(battery: Partial<BatteryState>): DrivingAnnouncement | null {
    const soc = battery.stateOfCharge || 50;

    if (soc <= 10) {
      return {
        type: 'ev_status',
        message: `Critical: Battery at ${soc} percent. Please charge immediately.`,
        priority: 'high',
        interruptMusic: true,
      };
    }

    if (soc <= 20) {
      return {
        type: 'ev_status',
        message: `Low battery: ${soc} percent remaining. Consider finding a charging station.`,
        priority: 'medium',
        interruptMusic: true,
      };
    }

    if (battery.chargingStatus === 'charging') {
      return {
        type: 'ev_status',
        message: `Charging in progress. Currently at ${soc} percent.`,
        priority: 'low',
        interruptMusic: false,
      };
    }

    return null;
  }

  // ==========================================================================
  // ADAPTIVE UPDATES
  // ==========================================================================

  async updateContext(updates: Partial<DrivingContext>): Promise<MusicRecommendation | null> {
    if (!this.currentContext) return null;

    const newContext: DrivingContext = {
      ...this.currentContext,
      ...updates,
      battery: { ...this.currentContext.battery, ...updates.battery },
      weather: { ...this.currentContext.weather, ...updates.weather },
      driving: { ...this.currentContext.driving, ...updates.driving },
    };

    // Check if significant change requires new recommendation
    if (this.shouldUpdateRecommendation(this.currentContext, newContext)) {
      return this.getRecommendation(newContext);
    }

    this.currentContext = newContext;
    return null;
  }

  private shouldUpdateRecommendation(
    oldContext: DrivingContext,
    newContext: DrivingContext
  ): boolean {
    // Significant battery change
    const oldSoc = oldContext.battery.stateOfCharge || 50;
    const newSoc = newContext.battery.stateOfCharge || 50;
    if (Math.abs(oldSoc - newSoc) > 20) return true;

    // Low battery threshold crossed
    if (oldSoc > 20 && newSoc <= 20) return true;

    // Route type changed
    if (oldContext.route?.routeType !== newContext.route?.routeType) return true;

    // Driving mode changed
    if (oldContext.driving?.drivingMode !== newContext.driving?.drivingMode) return true;

    return false;
  }
}

// ============================================================================
// TYPES HELPER
// ============================================================================

interface MoodFactors {
  batteryAnxiety: number;
  timeEnergy: number;
  weatherInfluence: number;
  routeExcitement: number;
  trafficStress: number;
  drivingDynamics: number;
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let musicServiceInstance: DrivingMusicService | null = null;

export function getDrivingMusicService(): DrivingMusicService {
  if (!musicServiceInstance) {
    musicServiceInstance = DrivingMusicService.getInstance();
  }
  return musicServiceInstance;
}

export default DrivingMusicService;
