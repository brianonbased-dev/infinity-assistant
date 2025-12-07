/**
 * Companion-Specific Landing Page Sections
 * 
 * Displays life context sections on the landing page
 * to help companion mode users find relevant information
 */

'use client';

import { useState } from 'react';
import { Heart, ArrowRight, TrendingUp, Clock, GraduationCap, Baby, Palette, Home } from 'lucide-react';
import type { LifeStage, InterestCategory } from '@/lib/life-context';
import { getLifeContextDetectionService } from '@/lib/life-context';

interface CompanionSection {
  lifeStage: LifeStage;
  title: string;
  description: string;
  examples: string[];
  icon: React.ReactNode;
}

const companionSections: CompanionSection[] = [
  {
    lifeStage: 'student',
    title: 'For Students',
    description: 'Study help, homework assistance, and learning resources',
    examples: ['Homework help', 'Study strategies', 'Essay writing', 'Test preparation'],
    icon: <GraduationCap className="w-6 h-6" />
  },
  {
    lifeStage: 'parent',
    title: 'For Parents',
    description: 'Parenting tips, family activities, and child development',
    examples: ['Parenting advice', 'Activity ideas', 'Child development', 'Family planning'],
    icon: <Baby className="w-6 h-6" />
  },
  {
    lifeStage: 'hobbyist',
    title: 'For Hobbyists',
    description: 'Project ideas, techniques, and community resources',
    examples: ['Project ideas', 'Techniques & tips', 'Tool recommendations', 'Community resources'],
    icon: <Palette className="w-6 h-6" />
  },
  {
    lifeStage: 'life-transition',
    title: 'Life Transitions',
    description: 'Guidance and support for major life changes',
    examples: ['Moving guidance', 'Career changes', 'Life planning', 'Support resources'],
    icon: <Home className="w-6 h-6" />
  }
];

interface CompanionSpecificSectionsProps {
  onSectionClick?: (lifeStage: LifeStage) => void;
  maxSections?: number;
}

export function CompanionSpecificSections({ onSectionClick, maxSections = 4 }: CompanionSpecificSectionsProps) {
  const [expandedSection, setExpandedSection] = useState<LifeStage | null>(null);

  const displaySections = companionSections.slice(0, maxSections);

  const handleSectionClick = (lifeStage: LifeStage) => {
    if (onSectionClick) {
      onSectionClick(lifeStage);
    } else {
      // Default: open chat with life context
      window.location.href = `/?view=chat&lifeStage=${lifeStage}`;
    }
  };

  return (
    <section className="container mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
          Your Personal AI Companion
        </h2>
        <p className="text-lg text-gray-300 max-w-2xl mx-auto">
          Whether you're a student, parent, hobbyist, or navigating life changes—Infinity Assistant provides personalized help for your unique situation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {displaySections.map((section) => {
          const isExpanded = expandedSection === section.lifeStage;

          return (
            <div
              key={section.lifeStage}
              className="bg-gradient-to-br from-pink-900/40 to-purple-900/40 border border-pink-500/20 rounded-lg p-6 hover:border-pink-500/40 transition-all cursor-pointer group"
              onClick={() => {
                setExpandedSection(isExpanded ? null : section.lifeStage);
                handleSectionClick(section.lifeStage);
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-pink-500/20 rounded-lg text-pink-400 group-hover:bg-pink-500/30 transition-colors">
                  {section.icon}
                </div>
                <Heart className="w-5 h-5 text-pink-400 opacity-50" />
              </div>

              <h3 className="text-xl font-semibold mb-2 text-white group-hover:text-pink-300 transition-colors">
                {section.title}
              </h3>

              <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                {section.description}
              </p>

              {isExpanded && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Examples
                  </p>
                  <ul className="space-y-1">
                    {section.examples.map((example, idx) => (
                      <li key={idx} className="text-sm text-gray-300 flex items-center gap-2">
                        <ArrowRight className="w-3 h-3 text-pink-400" />
                        {example}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 flex items-center text-pink-400 text-sm font-medium group-hover:text-pink-300 transition-colors">
                <span>Learn more</span>
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-12 text-center">
        <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30 rounded-full">
          <TrendingUp className="w-5 h-5 text-pink-400" />
          <span className="text-gray-300">
            <strong className="text-white">Gets smarter with every conversation</strong> about your interests and life
          </span>
        </div>
      </div>
    </section>
  );
}

