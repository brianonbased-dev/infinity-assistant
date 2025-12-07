# Companion Mode Knowledge Collection Implementation

**Date**: 2025-02-05  
**Status**: Complete  
**Complements**: Job-Specific Knowledge Collection

---

## 🎯 Overview

Implemented comprehensive companion mode knowledge collection and tracking system to match the professional mode structure. This ensures companion users' queries are tracked by personal interests and life context, not as "general" or "unknown".

---

## 📁 Files Created

### Core Services

#### `src/lib/life-context/LifeContextDetectionService.ts`
- **Purpose**: Detects user's life context, interests, and personal situation from queries
- **Features**:
  - Life stage detection (student, parent, retiree, hobbyist, etc.)
  - Interest category detection (hobbies, learning, health, travel, etc.)
  - Relationship context extraction (family members, pets)
  - Confidence scoring (0-1)
  - User profile integration
  - Conversation history analysis
- **Life Stages**: 7 major stages + general/unknown
- **Interest Categories**: 13 major categories + general/unknown

#### `src/lib/life-context/InterestKnowledgeTracker.ts`
- **Purpose**: Tracks knowledge accumulation by life context and interests
- **Features**:
  - Query tracking per life stage + interest combination
  - Knowledge gap detection
  - Experimental knowledge tracking
  - Canonical knowledge promotion tracking
  - Top queries per combination
  - Statistics and analytics
- **Metrics Tracked**:
  - Total queries per life stage/interest
  - Knowledge gaps identified
  - Experimental knowledge created
  - Canonical knowledge promoted
  - Last updated timestamp
  - Top 10 queries per combination

#### `src/lib/life-context/index.ts`
- **Purpose**: Module exports for life context detection system

### UI Components

#### `src/components/CompanionSpecificSections.tsx`
- **Purpose**: Landing page sections for life contexts
- **Features**:
  - 4 major life contexts displayed
  - Example use cases per context
  - Expandable sections
  - Click to open chat with life context
- **Sections Shown**:
  - For Students
  - For Parents
  - For Hobbyists
  - Life Transitions

### API Endpoints

#### `src/app/api/companion/tracking/route.ts`
- **GET**: Retrieve knowledge accumulation statistics
  - All data: `/api/companion/tracking`
  - By life stage: `/api/companion/tracking?lifeStage=student`
  - By interest: `/api/companion/tracking?interest=hobbies-creative`
  - Combined: `/api/companion/tracking?lifeStage=student&interest=learning-education`
  - Export format: `/api/companion/tracking?format=export`
- **POST**: Track knowledge events
  - `track_query`: Track a query for a life context/interest
  - `track_experimental`: Track experimental knowledge creation
  - `track_canonical`: Track canonical knowledge promotion

### Documentation

#### `docs/COMPANION_VS_PROFESSIONAL_ANALYSIS.md`
- **Purpose**: Analysis of companion vs professional mode needs
- **Contents**:
  - Current state comparison
  - What companion mode needs
  - Implementation recommendations
  - Key differences

---

## 🔧 Integration Points

### Chat API Integration (`src/app/api/chat/route.ts`)

**Mode Detection**:
```typescript
const isCompanionMode = preferences?.assistantMode === 'companion' || 
                        (!preferences?.assistantMode && !preferences?.role);
```

**Life Context Detection (Companion Mode)**:
```typescript
if (isCompanionMode) {
  const lifeContextResult = lifeContextService.detectLifeContext({
    query: filteredRequest.message,
    conversationHistory: userContext ? [userContext] : undefined,
    userProfile: preferences ? {
      interests: preferences.interests,
      familyMembers: preferences.essence?.familyMembers,
      lifeStage: undefined
    } : undefined
  });
}
```

**Job Detection (Professional Mode)**:
```typescript
else {
  const jobResult = jobDetectionService.detectJob({
    query: filteredRequest.message,
    conversationHistory: userContext ? [userContext] : undefined,
    userProfile: preferences ? {
      profession: preferences.role,
      role: preferences.role,
      industry: preferences.interests?.[0]
    } : undefined
  });
}
```

**Knowledge Gap Detection & Tracking**:
- Companion mode: Tracks by life context and interests
- Professional mode: Tracks by job category
- Both modes detect knowledge gaps and track experimental knowledge

### Landing Page Integration (`src/app/page.tsx`)

**Companion Sections**:
- Added `<CompanionSpecificSections />` component
- Positioned after Job-Specific Sections
- Displays 4 major life contexts with examples

---

## 📊 Life Contexts & Interests

### Life Stages

1. **Student**: K-12, college, graduate students
2. **Parent**: New parent, experienced parent, empty nester
3. **Retiree**: Retirement, senior living, estate planning
4. **Hobbyist**: Creative, outdoor, indoor hobbies
5. **Caregiver**: Elder care, medical care, recovery
6. **Life Transition**: Moving, career change, major life events
7. **Professional-Personal**: Work-life balance, burnout, stress

### Interest Categories

1. **Hobbies - Creative**: Photography, art, music, writing, crafts
2. **Hobbies - Outdoor**: Hiking, camping, gardening, sports
3. **Hobbies - Indoor**: Reading, puzzles, games, collecting
4. **Learning & Education**: Courses, languages, skills, certifications
5. **Health & Fitness**: Exercise, nutrition, mental health, wellness
6. **Travel & Adventure**: Trips, vacations, destinations, itineraries
7. **Cooking & Food**: Recipes, baking, restaurants, meal prep
8. **Technology - Personal**: Smartphones, apps, smart home, gadgets
9. **Entertainment & Media**: Movies, TV, music, podcasts, books
10. **Family & Relationships**: Family, spouse, children, relatives
11. **Pets & Animals**: Pet care, training, adoption, health
12. **Home & Garden**: Decorating, renovation, gardening, organization
13. **Finance - Personal**: Budget, saving, investment, retirement

---

## 🚀 Knowledge Accumulation Flow

### Phase 1: Mode Detection
1. System detects if user is in companion or professional mode
2. Based on `assistantMode` preference or presence of `role`

### Phase 2: Context Detection
1. **Companion Mode**: Detects life stage and interests from query
2. **Professional Mode**: Detects job category from query

### Phase 3: Knowledge Gap Detection
1. System checks if knowledge exists for query
2. If gap detected, marks as knowledge gap
3. Triggers research if needed

### Phase 4: Knowledge Creation
1. Experimental knowledge created from query/response
2. Tagged with life context/interest (companion) or job category (professional)
3. Tracked in appropriate tracker

### Phase 5: Analytics
1. Statistics updated in real-time
2. Top queries tracked per life context/interest or job category
3. Growth metrics calculated

---

## 📈 Expected Outcomes

### Short-Term (0-3 months)
- Life context detection accuracy: 70-80%
- Interest detection accuracy: 75-85%
- Knowledge gaps identified: 100+ per major life stage
- Experimental knowledge: 500+ items across interests

### Medium-Term (3-6 months)
- Life context detection accuracy: 85-90%
- Interest detection accuracy: 90%+
- Knowledge gaps identified: 500+ per major life stage
- Experimental knowledge: 2,000+ items
- Canonical knowledge: 200+ items

### Long-Term (6-12 months)
- Deep expertise per life context
- Predictive assistance for personal interests
- Family-specific knowledge accumulation
- Life transition support capabilities

---

## 🔍 Comparison: Companion vs Professional

| Feature | Professional Mode | Companion Mode |
|---------|------------------|----------------|
| **Detection** | Job category | Life stage + interests |
| **Tracking** | By profession | By interest/life stage |
| **Sections** | Job-specific examples | Life context examples |
| **Context** | Work, career, industry | Personal, family, hobbies |
| **Knowledge Gaps** | Professional topics | Personal interests, hobbies |
| **Metrics** | Queries per job category | Queries per interest/life stage |
| **API Endpoint** | `/api/jobs/tracking` | `/api/companion/tracking` |

---

## ✅ Implementation Status

- [x] Life context detection service
- [x] Interest knowledge tracker
- [x] Chat API integration with mode detection
- [x] Companion landing sections
- [x] Companion tracking API endpoints
- [x] Analysis documentation
- [ ] Analytics dashboard (future)
- [ ] ML-based detection (future)
- [ ] Life context landing pages (future)

---

**Status**: Complete  
**Last Updated**: 2025-02-05

