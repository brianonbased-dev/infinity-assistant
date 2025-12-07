/**
 * Life Context Detection Service
 * 
 * Detects user's life context, interests, and personal situation from queries
 * Used for companion mode knowledge collection and personalization
 */

import logger from '@/utils/logger';

export type LifeStage =
  | 'student'
  | 'parent'
  | 'retiree'
  | 'hobbyist'
  | 'caregiver'
  | 'life-transition'
  | 'professional-personal'
  | 'general'
  | 'unknown';

export type InterestCategory =
  | 'hobbies-creative'
  | 'hobbies-outdoor'
  | 'hobbies-indoor'
  | 'learning-education'
  | 'health-fitness'
  | 'travel-adventure'
  | 'cooking-food'
  | 'technology-personal'
  | 'entertainment-media'
  | 'family-relationships'
  | 'pets-animals'
  | 'home-garden'
  | 'finance-personal'
  | 'general'
  | 'unknown';

export interface LifeContextResult {
  lifeStage: LifeStage;
  lifeStageConfidence: number; // 0-1
  interests: InterestCategory[];
  interestConfidence: number; // 0-1
  relationshipContext?: string[]; // family members, pets, etc.
  keywords: string[];
}

export interface LifeContextQuery {
  query: string;
  conversationHistory?: string[];
  userProfile?: {
    interests?: string[];
    familyMembers?: string[];
    lifeStage?: string;
  };
}

/**
 * Life Context Detection Service
 * Detects life stage, interests, and personal context from queries
 */
export class LifeContextDetectionService {
  private lifeStageKeywords: Record<LifeStage, string[]> = {
    'student': [
      'homework', 'assignment', 'study', 'exam', 'test', 'essay', 'project',
      'school', 'college', 'university', 'class', 'course', 'lecture',
      'student', 'grade', 'gpa', 'scholarship', 'tuition', 'campus'
    ],
    'parent': [
      'child', 'children', 'kid', 'kids', 'baby', 'toddler', 'teenager',
      'parenting', 'parent', 'mom', 'dad', 'mother', 'father',
      'diaper', 'feeding', 'bedtime', 'homework help', 'school',
      'playdate', 'birthday party', 'soccer practice', 'parent teacher'
    ],
    'retiree': [
      'retirement', 'retired', 'pension', 'social security',
      'grandchildren', 'grandkids', 'senior', 'elderly',
      'health insurance', 'medicare', 'estate planning', 'will'
    ],
    'hobbyist': [
      'hobby', 'project', 'craft', 'diy', 'build', 'create',
      'photography', 'painting', 'drawing', 'knitting', 'sewing',
      'woodworking', 'gardening', 'collecting', 'model building'
    ],
    'caregiver': [
      'caregiver', 'elder care', 'taking care of', 'assisted living',
      'nursing home', 'medical care', 'healthcare', 'medication',
      'doctor appointment', 'hospital', 'recovery', 'rehabilitation'
    ],
    'life-transition': [
      'moving', 'relocating', 'new job', 'career change', 'divorce',
      'marriage', 'engagement', 'pregnancy', 'new baby',
      'empty nest', 'retirement planning', 'starting over'
    ],
    'professional-personal': [
      'work life balance', 'burnout', 'stress', 'time management',
      'career change', 'job search', 'interview', 'resume',
      'networking', 'professional development'
    ],
    'general': [],
    'unknown': []
  };

  private interestKeywords: Record<InterestCategory, string[]> = {
    'hobbies-creative': [
      'photography', 'painting', 'drawing', 'art', 'sketch', 'illustration',
      'music', 'guitar', 'piano', 'singing', 'songwriting', 'composing',
      'writing', 'poetry', 'creative writing', 'novel', 'story',
      'knitting', 'crochet', 'sewing', 'embroidery', 'quilt'
    ],
    'hobbies-outdoor': [
      'hiking', 'camping', 'fishing', 'hunting', 'gardening', 'landscaping',
      'outdoor', 'nature', 'park', 'trail', 'beach', 'mountain',
      'biking', 'cycling', 'running', 'jogging', 'walking',
      'sports', 'tennis', 'golf', 'basketball', 'soccer'
    ],
    'hobbies-indoor': [
      'reading', 'books', 'novel', 'library', 'book club',
      'puzzles', 'crossword', 'sudoku', 'board games', 'video games',
      'gaming', 'collecting', 'stamps', 'coins', 'antiques',
      'model building', 'lego', 'crafts', 'diy'
    ],
    'learning-education': [
      'learn', 'learning', 'course', 'class', 'tutorial', 'lesson',
      'language', 'spanish', 'french', 'german', 'italian',
      'skill', 'certification', 'online course', 'mooc',
      'history', 'science', 'math', 'literature'
    ],
    'health-fitness': [
      'exercise', 'workout', 'fitness', 'gym', 'yoga', 'pilates',
      'diet', 'nutrition', 'healthy eating', 'weight loss', 'weight gain',
      'meditation', 'mindfulness', 'mental health', 'therapy',
      'running', 'cycling', 'swimming', 'strength training'
    ],
    'travel-adventure': [
      'travel', 'trip', 'vacation', 'holiday', 'destination',
      'hotel', 'flight', 'booking', 'itinerary', 'sightseeing',
      'adventure', 'explore', 'backpacking', 'cruise',
      'passport', 'visa', 'travel insurance'
    ],
    'cooking-food': [
      'cooking', 'recipe', 'baking', 'cuisine', 'meal prep',
      'restaurant', 'food', 'dining', 'ingredients', 'kitchen',
      'grill', 'bbq', 'barbecue', 'dessert', 'cake', 'bread'
    ],
    'technology-personal': [
      'smartphone', 'phone', 'app', 'software', 'computer',
      'laptop', 'tablet', 'smart home', 'iot', 'gadget',
      'tech', 'device', 'setup', 'troubleshoot'
    ],
    'entertainment-media': [
      'movie', 'film', 'tv show', 'series', 'netflix', 'streaming',
      'music', 'album', 'song', 'podcast', 'audiobook',
      'book', 'novel', 'reading', 'magazine', 'news'
    ],
    'family-relationships': [
      'family', 'spouse', 'partner', 'husband', 'wife',
      'children', 'kids', 'siblings', 'brother', 'sister',
      'parents', 'grandparents', 'relatives', 'family gathering',
      'wedding', 'anniversary', 'birthday', 'holiday'
    ],
    'pets-animals': [
      'pet', 'dog', 'cat', 'puppy', 'kitten', 'animal',
      'veterinarian', 'vet', 'pet care', 'training', 'grooming',
      'adoption', 'rescue', 'breed', 'feeding', 'health'
    ],
    'home-garden': [
      'home', 'house', 'apartment', 'decorating', 'interior design',
      'furniture', 'renovation', 'remodel', 'diy', 'home improvement',
      'garden', 'gardening', 'plants', 'landscaping', 'yard',
      'cleaning', 'organization', 'storage'
    ],
    'finance-personal': [
      'budget', 'saving', 'investment', 'retirement', '401k',
      'credit card', 'debt', 'loan', 'mortgage', 'insurance',
      'tax', 'filing', 'expense', 'financial planning', 'money'
    ],
    'general': [],
    'unknown': []
  };

  /**
   * Detect life context from query
   */
  detectLifeContext(context: LifeContextQuery): LifeContextResult {
    const { query, conversationHistory, userProfile } = context;
    
    // Check user profile first (highest confidence)
    if (userProfile?.lifeStage) {
      const profileMatch = this.matchFromProfile(userProfile);
      if (profileMatch) {
        return profileMatch;
      }
    }

    const queryLower = query.toLowerCase();
    
    // Detect life stage
    const lifeStageScores: Record<LifeStage, number> = {} as Record<LifeStage, number>;
    Object.keys(this.lifeStageKeywords).forEach(stage => {
      lifeStageScores[stage as LifeStage] = 0;
    });

    Object.entries(this.lifeStageKeywords).forEach(([stage, keywords]) => {
      keywords.forEach(keyword => {
        if (queryLower.includes(keyword.toLowerCase())) {
          lifeStageScores[stage as LifeStage] += 1;
        }
      });
    });

    // Check conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      const historyText = conversationHistory.join(' ').toLowerCase();
      Object.entries(this.lifeStageKeywords).forEach(([stage, keywords]) => {
        keywords.forEach(keyword => {
          if (historyText.includes(keyword.toLowerCase())) {
            lifeStageScores[stage as LifeStage] += 0.5;
          }
        });
      });
    }

    // Find best life stage match
    let bestLifeStage: LifeStage = 'unknown';
    let bestLifeStageScore = 0;
    const matchedKeywords: string[] = [];

    Object.entries(lifeStageScores).forEach(([stage, score]) => {
      if (score > bestLifeStageScore && stage !== 'general' && stage !== 'unknown') {
        bestLifeStageScore = score;
        bestLifeStage = stage as LifeStage;
      }
    });

    // Collect matched keywords
    if (bestLifeStage !== 'unknown') {
      this.lifeStageKeywords[bestLifeStage].forEach(keyword => {
        if (queryLower.includes(keyword.toLowerCase())) {
          matchedKeywords.push(keyword);
        }
      });
    }

    // Detect interests
    const interestScores: Record<InterestCategory, number> = {} as Record<InterestCategory, number>;
    Object.keys(this.interestKeywords).forEach(interest => {
      interestScores[interest as InterestCategory] = 0;
    });

    Object.entries(this.interestKeywords).forEach(([interest, keywords]) => {
      keywords.forEach(keyword => {
        if (queryLower.includes(keyword.toLowerCase())) {
          interestScores[interest as InterestCategory] += 1;
        }
      });
    });

    // Check user profile interests
    if (userProfile?.interests) {
      const profileInterestsLower = userProfile.interests.map(i => i.toLowerCase());
      Object.entries(this.interestKeywords).forEach(([interest, keywords]) => {
        keywords.forEach(keyword => {
          if (profileInterestsLower.some(pi => pi.includes(keyword.toLowerCase()))) {
            interestScores[interest as InterestCategory] += 1;
          }
        });
      });
    }

    // Get top interests (top 3)
    const sortedInterests = Object.entries(interestScores)
      .filter(([_, score]) => score > 0)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 3)
      .map(([interest]) => interest as InterestCategory);

    // Calculate confidences
    const lifeStageConfidence = Math.min(bestLifeStageScore / 3, 1);
    const interestConfidence = sortedInterests.length > 0 
      ? Math.min(interestScores[sortedInterests[0]] / 3, 1)
      : 0;

    // Extract relationship context
    const relationshipContext = this.extractRelationshipContext(query, userProfile);

    return {
      lifeStage: bestLifeStageScore > 0 ? bestLifeStage : 'general',
      lifeStageConfidence,
      interests: sortedInterests.length > 0 ? sortedInterests : ['general'],
      interestConfidence,
      relationshipContext,
      keywords: matchedKeywords
    };
  }

  /**
   * Match from user profile
   */
  private matchFromProfile(profile: { lifeStage?: string; interests?: string[] }): LifeContextResult | null {
    const text = `${profile.lifeStage || ''} ${profile.interests?.join(' ') || ''}`.toLowerCase();
    
    // Check life stage
    for (const [stage, keywords] of Object.entries(this.lifeStageKeywords)) {
      for (const keyword of keywords) {
        if (text.includes(keyword.toLowerCase()) || (profile.lifeStage && profile.lifeStage.toLowerCase().includes(stage))) {
          // Check interests
          const matchedInterests: InterestCategory[] = [];
          if (profile.interests) {
            for (const [interest, interestKeywords] of Object.entries(this.interestKeywords)) {
              for (const interestKeyword of interestKeywords) {
                if (profile.interests.some(i => i.toLowerCase().includes(interestKeyword.toLowerCase()))) {
                  if (!matchedInterests.includes(interest as InterestCategory)) {
                    matchedInterests.push(interest as InterestCategory);
                  }
                }
              }
            }
          }

          return {
            lifeStage: stage as LifeStage,
            lifeStageConfidence: 0.9,
            interests: matchedInterests.length > 0 ? matchedInterests : ['general'],
            interestConfidence: matchedInterests.length > 0 ? 0.8 : 0.5,
            relationshipContext: [],
            keywords: [keyword]
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Extract relationship context (family members, pets, etc.)
   */
  private extractRelationshipContext(query: string, userProfile?: { familyMembers?: string[] }): string[] {
    const context: string[] = [];
    const queryLower = query.toLowerCase();

    // Family members from profile
    if (userProfile?.familyMembers) {
      userProfile.familyMembers.forEach(member => {
        if (queryLower.includes(member.toLowerCase())) {
          context.push(member);
        }
      });
    }

    // Common family terms
    const familyTerms = ['spouse', 'partner', 'husband', 'wife', 'child', 'children', 'kid', 'kids', 'son', 'daughter', 'parent', 'mom', 'dad'];
    familyTerms.forEach(term => {
      if (queryLower.includes(term) && !context.includes(term)) {
        context.push(term);
      }
    });

    // Pet terms
    const petTerms = ['pet', 'dog', 'cat', 'puppy', 'kitten'];
    petTerms.forEach(term => {
      if (queryLower.includes(term) && !context.includes(term)) {
        context.push(term);
      }
    });

    return context;
  }

  /**
   * Get life stage display name
   */
  getLifeStageDisplayName(stage: LifeStage): string {
    const names: Record<LifeStage, string> = {
      'student': 'Student',
      'parent': 'Parent',
      'retiree': 'Retiree',
      'hobbyist': 'Hobbyist',
      'caregiver': 'Caregiver',
      'life-transition': 'Life Transition',
      'professional-personal': 'Work-Life Balance',
      'general': 'General',
      'unknown': 'Unknown'
    };
    return names[stage];
  }

  /**
   * Get interest category display name
   */
  getInterestDisplayName(interest: InterestCategory): string {
    const names: Record<InterestCategory, string> = {
      'hobbies-creative': 'Creative Hobbies',
      'hobbies-outdoor': 'Outdoor Activities',
      'hobbies-indoor': 'Indoor Hobbies',
      'learning-education': 'Learning & Education',
      'health-fitness': 'Health & Fitness',
      'travel-adventure': 'Travel & Adventure',
      'cooking-food': 'Cooking & Food',
      'technology-personal': 'Personal Technology',
      'entertainment-media': 'Entertainment & Media',
      'family-relationships': 'Family & Relationships',
      'pets-animals': 'Pets & Animals',
      'home-garden': 'Home & Garden',
      'finance-personal': 'Personal Finance',
      'general': 'General',
      'unknown': 'Unknown'
    };
    return names[interest];
  }
}

// Singleton instance
let lifeContextDetectionServiceInstance: LifeContextDetectionService | null = null;

export function getLifeContextDetectionService(): LifeContextDetectionService {
  if (!lifeContextDetectionServiceInstance) {
    lifeContextDetectionServiceInstance = new LifeContextDetectionService();
  }
  return lifeContextDetectionServiceInstance;
}

