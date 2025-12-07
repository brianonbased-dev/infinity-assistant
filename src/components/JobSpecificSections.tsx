/**
 * Job-Specific Landing Page Sections
 * 
 * Displays job category sections on the landing page
 * to help users find relevant information for their profession
 */

'use client';

import { useState } from 'react';
import { Briefcase, ArrowRight, TrendingUp, Clock, Sparkles } from 'lucide-react';
import type { JobCategory } from '@/lib/job-detection';
import { getJobDetectionService } from '@/lib/job-detection';

interface JobSection {
  category: JobCategory;
  title: string;
  description: string;
  examples: string[];
  timeSaved: string;
  icon: React.ReactNode;
}

const jobSections: JobSection[] = [
  {
    category: 'management-business',
    title: 'Management & Business',
    description: 'Strategic planning, decision-making, and business operations support',
    examples: ['Market research', 'Strategic planning', 'Stakeholder communication', 'Process optimization'],
    timeSaved: '20-40%',
    icon: <Briefcase className="w-6 h-6" />
  },
  {
    category: 'technology-engineering',
    title: 'Technology & Engineering',
    description: 'Code explanations, debugging, architecture, and technical documentation',
    examples: ['Code explanations', 'Debugging help', 'Architecture guidance', 'Learning new tech'],
    timeSaved: '20-40%',
    icon: <Sparkles className="w-6 h-6" />
  },
  {
    category: 'healthcare-medical',
    title: 'Healthcare & Medical',
    description: 'Medical research, treatment protocols, patient education, and continuing education',
    examples: ['Medical research', 'Treatment protocols', 'Patient education', 'Drug information'],
    timeSaved: '20-40%',
    icon: <Briefcase className="w-6 h-6" />
  },
  {
    category: 'education-training',
    title: 'Education & Training',
    description: 'Lesson planning, curriculum development, and educational resources',
    examples: ['Lesson planning', 'Curriculum development', 'Student assessment', 'Parent communication'],
    timeSaved: '15-30%',
    icon: <Briefcase className="w-6 h-6" />
  },
  {
    category: 'creative-arts',
    title: 'Creative & Arts',
    description: 'Design trends, creative techniques, and portfolio guidance',
    examples: ['Design trends', 'Creative techniques', 'Portfolio guidance', 'Tool recommendations'],
    timeSaved: '15-30%',
    icon: <Briefcase className="w-6 h-6" />
  },
  {
    category: 'legal-compliance',
    title: 'Legal & Compliance',
    description: 'Case law research, document drafting, and legal analysis',
    examples: ['Case law research', 'Document drafting', 'Case analysis', 'Client communication'],
    timeSaved: '20-40%',
    icon: <Briefcase className="w-6 h-6" />
  },
  {
    category: 'sales-marketing',
    title: 'Sales & Marketing',
    description: 'Campaign planning, market research, and content creation',
    examples: ['Campaign planning', 'Market research', 'Content creation', 'Competitive analysis'],
    timeSaved: '15-30%',
    icon: <Briefcase className="w-6 h-6" />
  },
  {
    category: 'finance-accounting',
    title: 'Finance & Accounting',
    description: 'Financial analysis, tax guidance, and accounting best practices',
    examples: ['Financial analysis', 'Tax guidance', 'Budget planning', 'Accounting best practices'],
    timeSaved: '15-30%',
    icon: <Briefcase className="w-6 h-6" />
  }
];

interface JobSpecificSectionsProps {
  onCategoryClick?: (category: JobCategory) => void;
  maxSections?: number;
}

export function JobSpecificSections({ onCategoryClick, maxSections = 8 }: JobSpecificSectionsProps) {
  const [expandedCategory, setExpandedCategory] = useState<JobCategory | null>(null);

  const displaySections = jobSections.slice(0, maxSections);

  const handleCategoryClick = (category: JobCategory) => {
    if (onCategoryClick) {
      onCategoryClick(category);
    } else {
      // Default: open chat with category context
      window.location.href = `/?view=chat&job=${category}`;
    }
  };

  return (
    <section className="container mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          How Infinity Assistant Helps Your Profession
        </h2>
        <p className="text-lg text-gray-300 max-w-2xl mx-auto">
          From doctors to designers, lawyers to developers—Infinity Assistant provides research, analysis, and assistance tailored to your profession.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {displaySections.map((section) => {
          const isExpanded = expandedCategory === section.category;

          return (
            <div
              key={section.category}
              className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 border border-purple-500/20 rounded-lg p-6 hover:border-purple-500/40 transition-all cursor-pointer group"
              onClick={() => {
                setExpandedCategory(isExpanded ? null : section.category);
                handleCategoryClick(section.category);
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-purple-500/20 rounded-lg text-purple-400 group-hover:bg-purple-500/30 transition-colors">
                  {section.icon}
                </div>
                <div className="flex items-center gap-2 text-sm text-green-400">
                  <Clock className="w-4 h-4" />
                  <span className="font-semibold">{section.timeSaved}</span>
                </div>
              </div>

              <h3 className="text-xl font-semibold mb-2 text-white group-hover:text-purple-300 transition-colors">
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
                        <ArrowRight className="w-3 h-3 text-purple-400" />
                        {example}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 flex items-center text-purple-400 text-sm font-medium group-hover:text-purple-300 transition-colors">
                <span>Learn more</span>
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-12 text-center">
        <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-full">
          <TrendingUp className="w-5 h-5 text-purple-400" />
          <span className="text-gray-300">
            <strong className="text-white">The more you use it, the smarter it gets</strong> for your profession
          </span>
        </div>
      </div>
    </section>
  );
}

