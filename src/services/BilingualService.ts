/**
 * BilingualService - Language detection and translation for Infinity Assistant
 *
 * Ported from uaa2-service CustomerServiceAgent for consistent bilingual support.
 *
 * Features:
 * - Automatic language detection (10 languages)
 * - Bilingual responses (English + detected language)
 * - Session language preferences
 * - AI-powered translation via system prompts
 *
 * @since 2025-11-29
 */

export type SupportedLanguage = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh' | 'ar';

export interface LanguageDetectionResult {
  language: SupportedLanguage;
  confidence: number;
  detectedText: string;
}

export interface LanguageConfig {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  greeting: string;
  helpOffer: string;
}

// Language configurations
export const SUPPORTED_LANGUAGES: Record<SupportedLanguage, LanguageConfig> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    greeting: 'Hello!',
    helpOffer: 'How can I help you today?',
  },
  es: {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Espanol',
    greeting: 'Hola!',
    helpOffer: 'Como puedo ayudarte hoy?',
  },
  fr: {
    code: 'fr',
    name: 'French',
    nativeName: 'Francais',
    greeting: 'Bonjour!',
    helpOffer: "Comment puis-je vous aider aujourd'hui?",
  },
  de: {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    greeting: 'Hallo!',
    helpOffer: 'Wie kann ich Ihnen heute helfen?',
  },
  it: {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    greeting: 'Ciao!',
    helpOffer: 'Come posso aiutarti oggi?',
  },
  pt: {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Portugues',
    greeting: 'Ola!',
    helpOffer: 'Como posso ajuda-lo hoje?',
  },
  ja: {
    code: 'ja',
    name: 'Japanese',
    nativeName: '',
    greeting: '',
    helpOffer: '',
  },
  ko: {
    code: 'ko',
    name: 'Korean',
    nativeName: '',
    greeting: '',
    helpOffer: '',
  },
  zh: {
    code: 'zh',
    name: 'Chinese',
    nativeName: '',
    greeting: '',
    helpOffer: '',
  },
  ar: {
    code: 'ar',
    name: 'Arabic',
    nativeName: '',
    greeting: '',
    helpOffer: '',
  },
};

// Language detection patterns
const LANGUAGE_PATTERNS: Record<
  SupportedLanguage,
  {
    keywords: string[];
    characters: RegExp[];
    commonPhrases: string[];
  }
> = {
  en: {
    keywords: ['the', 'and', 'you', 'that', 'for', 'are', 'with', 'this', 'how', 'what'],
    characters: [/^[a-zA-Z\s.,!?'"\-]+$/],
    commonPhrases: ['hello', 'how are you', 'thank you', 'please', 'yes', 'no'],
  },
  es: {
    keywords: ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'ser', 'se', 'como', 'para'],
    characters: [/[aeioun?!]/],
    commonPhrases: ['hola', 'gracias', 'por favor', 'si', 'no', 'como estas', 'mucho gusto', 'ayuda'],
  },
  fr: {
    keywords: ['le', 'de', 'et', 'a', 'un', 'il', 'etre', 'et', 'en', 'avoir', 'je', 'nous'],
    characters: [/[aaeeeiiouuc]/],
    commonPhrases: ['bonjour', 'merci', "s'il vous plait", 'oui', 'non', 'comment allez-vous'],
  },
  de: {
    keywords: ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich', 'ich'],
    characters: [/[aou]/],
    commonPhrases: ['hallo', 'danke', 'bitte', 'ja', 'nein', 'wie geht es'],
  },
  it: {
    keywords: ['il', 'di', 'che', 'e', 'la', 'a', 'per', 'un', 'in', 'essere', 'io'],
    characters: [/[aeiou]/],
    commonPhrases: ['ciao', 'grazie', 'per favore', 'si', 'no', 'come stai'],
  },
  pt: {
    keywords: ['o', 'de', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'e', 'eu'],
    characters: [/[aaaaeeioouuc]/],
    commonPhrases: ['ola', 'obrigado', 'por favor', 'sim', 'nao', 'como esta'],
  },
  ja: {
    keywords: ['', '', '', '', '', '', '', '', '', ''],
    characters: [/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/],
    commonPhrases: ['', '', '', '', ''],
  },
  ko: {
    keywords: ['', '', '', '', '', '', '', '', '', ''],
    characters: [/[\uAC00-\uD7AF]/],
    commonPhrases: ['', '', '', '', ''],
  },
  zh: {
    keywords: ['', '', '', '', '', '', '', '', '', ''],
    characters: [/[\u4E00-\u9FAF]/],
    commonPhrases: ['', '', '', '', '', ''],
  },
  ar: {
    keywords: ['', '', '', '', '', '', '', '', '', ''],
    characters: [/[\u0600-\u06FF]/],
    commonPhrases: ['', '', '', '', ''],
  },
};

/**
 * Detect language from text using pattern matching
 */
export function detectLanguage(text: string): LanguageDetectionResult {
  if (!text || text.trim().length === 0) {
    return {
      language: 'en',
      confidence: 0,
      detectedText: text,
    };
  }

  const lowerText = text.toLowerCase();
  const scores: Record<SupportedLanguage, number> = {
    en: 0,
    es: 0,
    fr: 0,
    de: 0,
    it: 0,
    pt: 0,
    ja: 0,
    ko: 0,
    zh: 0,
    ar: 0,
  };

  // Score based on patterns
  for (const [lang, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
    const langKey = lang as SupportedLanguage;

    // Keyword matching
    for (const keyword of patterns.keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(lowerText)) {
        scores[langKey] += 2;
      }
    }

    // Character pattern matching (most reliable for non-Latin scripts)
    for (const regex of patterns.characters) {
      if (regex.test(text)) {
        scores[langKey] += 5;
      }
    }

    // Common phrases matching
    for (const phrase of patterns.commonPhrases) {
      if (lowerText.includes(phrase)) {
        scores[langKey] += 3;
      }
    }
  }

  // Find language with highest score
  let detectedLang: SupportedLanguage = 'en';
  let maxScore = scores.en;

  for (const [lang, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedLang = lang as SupportedLanguage;
    }
  }

  // Calculate confidence (0-1 scale)
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? Math.min(maxScore / (totalScore / 2), 1) : 0.5;

  return {
    language: detectedLang,
    confidence,
    detectedText: text,
  };
}

/**
 * Get language name from code
 */
export function getLanguageName(code: SupportedLanguage): string {
  return SUPPORTED_LANGUAGES[code]?.name || 'English';
}

/**
 * Get native language name
 */
export function getNativeLanguageName(code: SupportedLanguage): string {
  return SUPPORTED_LANGUAGES[code]?.nativeName || SUPPORTED_LANGUAGES[code]?.name || 'English';
}

/**
 * Generate system prompt addendum for bilingual responses
 */
export function generateBilingualPrompt(language: SupportedLanguage): string {
  if (language === 'en') {
    return ''; // No special prompt needed for English
  }

  const langConfig = SUPPORTED_LANGUAGES[language];
  const langName = langConfig?.name || 'the user\'s language';

  return `

IMPORTANT - BILINGUAL RESPONSE REQUIRED:
The user is communicating in ${langName}. You MUST respond in BOTH languages:
1. First, provide your complete response in ${langName}
2. Then add a separator line: "---"
3. Finally, provide the same response translated to English

This ensures the user can read in their preferred language while also seeing the English version.
Format your response exactly like this:

[Your response in ${langName}]

---

[Same response in English]

Always maintain this bilingual format for all responses when the user communicates in ${langName}.`;
}

/**
 * Get greeting in specified language
 */
export function getGreeting(language: SupportedLanguage): string {
  const config = SUPPORTED_LANGUAGES[language];
  if (config?.greeting && config?.helpOffer) {
    return `${config.greeting} ${config.helpOffer}`;
  }
  return 'Hello! How can I help you today?';
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(code: string): code is SupportedLanguage {
  return code in SUPPORTED_LANGUAGES;
}

/**
 * Get all supported languages for UI dropdown
 */
export function getSupportedLanguagesList(): Array<{ code: SupportedLanguage; name: string; nativeName: string }> {
  return Object.values(SUPPORTED_LANGUAGES).map((lang) => ({
    code: lang.code,
    name: lang.name,
    nativeName: lang.nativeName,
  }));
}

export default {
  detectLanguage,
  getLanguageName,
  getNativeLanguageName,
  generateBilingualPrompt,
  getGreeting,
  isLanguageSupported,
  getSupportedLanguagesList,
  SUPPORTED_LANGUAGES,
};
