/**
 * Job Detection Service
 * 
 * Detects user's profession/job category from queries and context
 * Used for job-specific knowledge collection and personalization
 */

import logger from '@/utils/logger';

export type JobCategory =
  | 'management-business'
  | 'technology-engineering'
  | 'healthcare-medical'
  | 'education-training'
  | 'creative-arts'
  | 'legal-compliance'
  | 'sales-marketing'
  | 'finance-accounting'
  | 'operations-logistics'
  | 'customer-service'
  | 'research-analysis'
  | 'skilled-trades'
  | 'agriculture-natural-resources'
  | 'hospitality-tourism'
  | 'public-safety-security'
  | 'social-services'
  | 'media-communications'
  | 'real-estate-construction'
  | 'general'
  | 'unknown';

export interface JobDetectionResult {
  category: JobCategory;
  confidence: number; // 0-1
  specificRole?: string; // e.g., "software engineer", "marketing manager"
  keywords: string[];
}

export interface JobContext {
  query: string;
  conversationHistory?: string[];
  userProfile?: {
    profession?: string;
    industry?: string;
    role?: string;
  };
}

/**
 * Job Detection Service
 * Detects profession from queries using keyword matching and context analysis
 */
export class JobDetectionService {
  private jobKeywords: Record<JobCategory, string[]> = {
    'management-business': [
      'ceo', 'executive', 'manager', 'director', 'lead', 'supervisor',
      'project manager', 'business analyst', 'operations manager',
      'strategic planning', 'stakeholder', 'resource planning',
      'team management', 'process optimization', 'business strategy'
    ],
    'technology-engineering': [
      'software engineer', 'developer', 'programmer', 'coder',
      'data scientist', 'devops', 'system engineer', 'architect',
      'debug', 'code', 'algorithm', 'framework', 'api', 'database',
      'infrastructure', 'deployment', 'configuration', 'technical'
    ],
    'healthcare-medical': [
      'doctor', 'physician', 'nurse', 'patient', 'medical', 'healthcare',
      'diagnosis', 'treatment', 'medication', 'clinical', 'hospital',
      'therapy', 'surgery', 'pharmacy', 'health', 'disease', 'symptom'
    ],
    'education-training': [
      'teacher', 'professor', 'student', 'curriculum', 'lesson plan',
      'education', 'training', 'learning', 'instruction', 'pedagogy',
      'classroom', 'academic', 'school', 'university', 'tutor'
    ],
    'creative-arts': [
      'designer', 'artist', 'creative', 'graphic design', 'illustration',
      'writer', 'author', 'content creator', 'video', 'photography',
      'music', 'composer', 'filmmaker', 'branding', 'visual'
    ],
    'legal-compliance': [
      'lawyer', 'attorney', 'legal', 'case', 'contract', 'compliance',
      'regulation', 'litigation', 'court', 'law', 'statute', 'precedent',
      'paralegal', 'legal research', 'client', 'jurisdiction'
    ],
    'sales-marketing': [
      'sales', 'marketing', 'campaign', 'customer', 'client', 'lead',
      'revenue', 'conversion', 'brand', 'advertising', 'promotion',
      'market research', 'social media', 'content marketing', 'seo'
    ],
    'finance-accounting': [
      'accountant', 'financial', 'finance', 'budget', 'tax', 'audit',
      'investment', 'revenue', 'expense', 'accounting', 'financial analysis',
      'bookkeeping', 'fiscal', 'portfolio', 'trading', 'banking'
    ],
    'operations-logistics': [
      'supply chain', 'logistics', 'warehouse', 'procurement', 'vendor',
      'inventory', 'shipping', 'distribution', 'operations', 'fulfillment',
      'transportation', 'sourcing', 'supplier'
    ],
    'customer-service': [
      'customer service', 'support', 'help desk', 'ticket', 'complaint',
      'customer success', 'client relations', 'call center', 'service',
      'customer experience', 'satisfaction', 'retention'
    ],
    'research-analysis': [
      'researcher', 'analyst', 'research', 'data analysis', 'study',
      'methodology', 'hypothesis', 'experiment', 'survey', 'statistics',
      'market research', 'business intelligence', 'insights'
    ],
    'skilled-trades': [
      'electrician', 'plumber', 'carpenter', 'mechanic', 'technician',
      'construction', 'repair', 'installation', 'maintenance', 'trade',
      'hvac', 'welder', 'mason', 'contractor'
    ],
    'agriculture-natural-resources': [
      'farmer', 'agriculture', 'crop', 'livestock', 'forestry', 'farming',
      'sustainability', 'environmental', 'conservation', 'natural resources',
      'harvest', 'irrigation', 'soil'
    ],
    'hospitality-tourism': [
      'hotel', 'restaurant', 'chef', 'cook', 'hospitality', 'tourism',
      'event planning', 'travel', 'guest', 'service', 'catering',
      'tourism', 'destination', 'vacation'
    ],
    'public-safety-security': [
      'police', 'officer', 'security', 'firefighter', 'safety', 'emergency',
      'law enforcement', 'patrol', 'investigation', 'protection', 'guard'
    ],
    'social-services': [
      'social worker', 'counselor', 'therapist', 'case worker', 'human resources',
      'hr', 'recruitment', 'hiring', 'employee', 'workplace', 'welfare'
    ],
    'media-communications': [
      'journalist', 'reporter', 'media', 'public relations', 'pr', 'broadcast',
      'news', 'communication', 'press', 'publicity', 'editor', 'publishing'
    ],
    'real-estate-construction': [
      'real estate', 'agent', 'property', 'construction', 'architect', 'builder',
      'realty', 'mortgage', 'housing', 'development', 'contractor', 'building'
    ],
    'general': [],
    'unknown': []
  };

  /**
   * Detect job category from query and context
   */
  detectJob(context: JobContext): JobDetectionResult {
    const { query, conversationHistory, userProfile } = context;
    
    // Check user profile first (highest confidence)
    if (userProfile?.profession || userProfile?.role) {
      const profileMatch = this.matchFromProfile(userProfile);
      if (profileMatch) {
        return profileMatch;
      }
    }

    // Analyze query
    const queryLower = query.toLowerCase();
    const scores: Record<JobCategory, number> = {} as Record<JobCategory, number>;
    
    // Initialize scores
    Object.keys(this.jobKeywords).forEach(cat => {
      scores[cat as JobCategory] = 0;
    });

    // Score by keyword matches
    Object.entries(this.jobKeywords).forEach(([category, keywords]) => {
      keywords.forEach(keyword => {
        if (queryLower.includes(keyword.toLowerCase())) {
          scores[category as JobCategory] += 1;
        }
      });
    });

    // Check conversation history for context
    if (conversationHistory && conversationHistory.length > 0) {
      const historyText = conversationHistory.join(' ').toLowerCase();
      Object.entries(this.jobKeywords).forEach(([category, keywords]) => {
        keywords.forEach(keyword => {
          if (historyText.includes(keyword.toLowerCase())) {
            scores[category as JobCategory] += 0.5; // Lower weight for history
          }
        });
      });
    }

    // Find best match
    let bestCategory: JobCategory = 'unknown';
    let bestScore = 0;
    const matchedKeywords: string[] = [];

    Object.entries(scores).forEach(([category, score]) => {
      if (score > bestScore && category !== 'general' && category !== 'unknown') {
        bestScore = score;
        bestCategory = category as JobCategory;
      }
    });

    // Collect matched keywords
    if (bestCategory !== 'unknown') {
      this.jobKeywords[bestCategory].forEach(keyword => {
        if (queryLower.includes(keyword.toLowerCase())) {
          matchedKeywords.push(keyword);
        }
      });
    }

    // Calculate confidence (0-1)
    const confidence = Math.min(bestScore / 3, 1); // Normalize to 0-1

    // Extract specific role if possible
    const specificRole = this.extractSpecificRole(query, bestCategory);

    return {
      category: bestScore > 0 ? bestCategory : 'general',
      confidence,
      specificRole,
      keywords: matchedKeywords
    };
  }

  /**
   * Match from user profile
   */
  private matchFromProfile(profile: { profession?: string; role?: string; industry?: string }): JobDetectionResult | null {
    const text = `${profile.profession || ''} ${profile.role || ''} ${profile.industry || ''}`.toLowerCase();
    
    for (const [category, keywords] of Object.entries(this.jobKeywords)) {
      for (const keyword of keywords) {
        if (text.includes(keyword.toLowerCase())) {
          return {
            category: category as JobCategory,
            confidence: 0.9, // High confidence from profile
            specificRole: profile.role || profile.profession,
            keywords: [keyword]
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Extract specific role from query
   */
  private extractSpecificRole(query: string, category: JobCategory): string | undefined {
    const queryLower = query.toLowerCase();
    
    // Common role patterns
    const rolePatterns: Record<JobCategory, string[]> = {
      'management-business': ['manager', 'director', 'executive', 'ceo', 'analyst'],
      'technology-engineering': ['engineer', 'developer', 'architect', 'scientist', 'devops'],
      'healthcare-medical': ['doctor', 'nurse', 'physician', 'therapist', 'pharmacist'],
      'education-training': ['teacher', 'professor', 'instructor', 'trainer', 'educator'],
      'creative-arts': ['designer', 'artist', 'writer', 'creator', 'composer'],
      'legal-compliance': ['lawyer', 'attorney', 'paralegal', 'compliance officer'],
      'sales-marketing': ['sales', 'marketer', 'marketing manager', 'brand manager'],
      'finance-accounting': ['accountant', 'analyst', 'advisor', 'planner', 'auditor'],
      'operations-logistics': ['manager', 'coordinator', 'specialist', 'planner'],
      'customer-service': ['representative', 'agent', 'specialist', 'manager'],
      'research-analysis': ['researcher', 'analyst', 'scientist', 'specialist'],
      'skilled-trades': ['electrician', 'plumber', 'carpenter', 'mechanic', 'technician'],
      'agriculture-natural-resources': ['farmer', 'forester', 'scientist', 'manager'],
      'hospitality-tourism': ['manager', 'chef', 'agent', 'planner', 'coordinator'],
      'public-safety-security': ['officer', 'guard', 'firefighter', 'agent'],
      'social-services': ['worker', 'counselor', 'therapist', 'specialist'],
      'media-communications': ['journalist', 'reporter', 'editor', 'specialist'],
      'real-estate-construction': ['agent', 'manager', 'architect', 'contractor'],
      'general': [],
      'unknown': []
    };

    const patterns = rolePatterns[category] || [];
    for (const pattern of patterns) {
      if (queryLower.includes(pattern)) {
        return pattern;
      }
    }

    return undefined;
  }

  /**
   * Get job category display name
   */
  getCategoryDisplayName(category: JobCategory): string {
    const names: Record<JobCategory, string> = {
      'management-business': 'Management & Business',
      'technology-engineering': 'Technology & Engineering',
      'healthcare-medical': 'Healthcare & Medical',
      'education-training': 'Education & Training',
      'creative-arts': 'Creative & Arts',
      'legal-compliance': 'Legal & Compliance',
      'sales-marketing': 'Sales & Marketing',
      'finance-accounting': 'Finance & Accounting',
      'operations-logistics': 'Operations & Logistics',
      'customer-service': 'Customer Service',
      'research-analysis': 'Research & Analysis',
      'skilled-trades': 'Skilled Trades',
      'agriculture-natural-resources': 'Agriculture & Natural Resources',
      'hospitality-tourism': 'Hospitality & Tourism',
      'public-safety-security': 'Public Safety & Security',
      'social-services': 'Social Services',
      'media-communications': 'Media & Communications',
      'real-estate-construction': 'Real Estate & Construction',
      'general': 'General',
      'unknown': 'Unknown'
    };
    return names[category];
  }
}

// Singleton instance
let jobDetectionServiceInstance: JobDetectionService | null = null;

export function getJobDetectionService(): JobDetectionService {
  if (!jobDetectionServiceInstance) {
    jobDetectionServiceInstance = new JobDetectionService();
  }
  return jobDetectionServiceInstance;
}


