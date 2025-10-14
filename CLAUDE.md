# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Characify is a Next.js application that combines a Slate.js rich text editor with AI-powered character analysis. Users write stories, and the system automatically extracts characters and identifies all coreferences (pronouns, mentions) for highlighting.

**Tech Stack:**
- **Framework**: Next.js 15 with Turbopack
- **Editor**: Slate.js with custom normalization
- **AI**: OpenAI gpt-4.1 for NLP tasks
- **State**: Zustand with localStorage persistence
- **Styling**: Tailwind CSS

## Development Commands

```bash
# Development server (uses Turbopack)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Type checking
npx tsc --noEmit
```

## Environment Setup

Create `.env.local` with:
```
OPENAI_API_KEY=your_openai_api_key

# Optional: Enable evidence-first architecture (experimental)
NEXT_PUBLIC_USE_EVIDENCE_FIRST=false
```

## Architecture

### Core Data Flow

```
User writes story in TextEditor (Slate.js)
    OR
User adds characters manually (cold start)
    ↓
Click "Extract Characters"
    ↓
1. /api/character → Extract character names
2. /api/coreference → Find references for each character in each sentence
3. Attribute extraction (two architectures available):

   OLD ARCHITECTURE (default):
   - /api/attributes/{physiology,psychology,sociology} → Extract attributes directly
   - /api/conflicts → Detect conflicting attributes

   EVIDENCE-FIRST ARCHITECTURE (experimental, USE_EVIDENCE_FIRST=true):
   Phase 1: /api/evidence/extract → Extract indicator phrases (5 calls per sentence)
   Phase 2: /api/evidence/classify → Classify phrases (1 call per phrase)
   Phase 3: /api/evidence/infer → Infer attributes (3 calls per irrelevant phrase)

4. Smart caching system → Only process changed sentences
    ↓
Results saved to Zustand stores (persisted to localStorage)
    ↓
User can manually add/edit/delete attributes at any time
    ↓
Click character → Highlight all coreferences in editor
```

### Key Components

#### 1. TextEditor ([components/TextEditor.tsx](components/TextEditor.tsx))

Custom Slate.js editor with:
- **Single-paragraph normalization**: Forces all content into one paragraph (using `\n` for line breaks)
- **Highlighting system**: Decorates text ranges for coreference matches
- **Keyword search**: Falls back to simple search when no character selected

#### 2. API Routes

##### Core Extraction APIs

**[/api/character](app/api/character/route.tsx)**: Extracts character names from story
- Input: `{ story: string }`
- Output: `{ characters: string[] }`
- Model: gpt-4.1

**[/api/coreference](app/api/coreference/route.tsx)**: Finds character references in a sentence
- Input: `{ story: string, characterName: string, sentence: string }`
- Output: `{ coreferences: string[] }` - e.g., `["he", "him", "John"]`
- **Critical**: Returns text strings only (not indices) to avoid LLM hallucination

##### Old Architecture (Default)

**[/api/attributes/physiology](app/api/attributes/physiology/route.tsx)**: Extract physiology attributes
- Input: `{ story, characterName, sentence, coreferences }`
- Output: `{ attributes: [{ name, evidence: [{ text, indicatorType }] }] }`
- Model: gpt-4.1

**[/api/attributes/psychology](app/api/attributes/psychology/route.tsx)**: Extract psychology attributes
**[/api/attributes/sociology](app/api/attributes/sociology/route.tsx)**: Extract sociology attributes

**[/api/conflicts](app/api/conflicts/route.tsx)**: Detect conflicting attributes
- Input: `{ story, characterName, sentence, coreferences, existingAttributes }`
- Output: `{ conflicts: [{ category, attributeName, severity, reason, evidence }] }`

##### Evidence-First Architecture (Experimental)

**[/api/evidence/extract](app/api/evidence/extract/route.tsx)**: Phase 1 - Extract indicator phrases
- Input: `{ story, sentence, characterName, indicatorType }`
- Output: `{ phrases: [{ text, startOffset }] }`
- Model: gpt-4.1 (efficiency optimized)
- **Called 5x per sentence** (once per indicator type)

**[/api/evidence/classify](app/api/evidence/classify/route.tsx)**: Phase 2 - Classify phrases
- Input: `{ story, sentence, characterName, phrase, existingAttributes }`
- Output: `{ result: "matching" | "conflicting" | "irrelevant", matchedAttributeId?, conflictAttributeId?, conflictReason?, conflictSeverity? }`
- Model: gpt-4.1
- **Called once per extracted phrase**
- **Branching logic**:
  - If `matching`: Link to existing attribute, STOP
  - If `conflicting`: Save conflict, STOP
  - If `irrelevant`: Proceed to Phase 3

**[/api/evidence/infer](app/api/evidence/infer/route.tsx)**: Phase 3 - Infer attributes from irrelevant phrases
- Input: `{ story, sentence, characterName, phrase, category }`
- Output: `{ hasAttribute, attributeName?, confidence? }`
- Model: gpt-4.1
- **Called 3x per irrelevant phrase** (once per category)
- Only called for phrases classified as "irrelevant"

#### 3. State Management (Zustand Stores)

All stores use `persist` middleware for localStorage persistence:

**[characterStore](lib/stores/characterStore.ts)**: Character data with CRUD operations
```typescript
{
  characters: [{
    name: "John",
    source: "manual" | "ai-extracted",  // Character creation source
    coreferenceMatches: [{
      sentenceIndex: 5,
      startIndex: 123,  // Absolute position in story
      endIndex: 125,
      text: "he"
    }],
    attributes: [{
      category: "physiology" | "psychology" | "sociology",
      name: "elderly",
      evidence: [{
        text: "old man",
        indicatorType: "directDefinition",
        relativeIndex: 18  // Position within sentence
      }]
    }],
    conflicts: [{
      category: "physiology",
      attributeName: "young",
      severity: "high",
      reason: "Conflicts with existing 'elderly' attribute",
      evidence: { text: "teenager", indicatorType: "directDefinition", relativeIndex: 5 }
    }]
  }]
}

// Methods:
createManualCharacter(name: string)           // Add character manually
removeCharacter(name: string)                 // Delete character (manual only)
updateCharacterName(oldName, newName)         // Rename character
addAttributeToCharacter(name, category, value) // Add manual attribute
removeAttributeFromCharacter(name, category, value) // Delete any attribute
setCharacters(characters[])                   // Update from AI extraction (merges with manual)
```

**[sentenceCacheStore](lib/stores/sentenceCacheStore.ts)**: Smart caching with relative indices
```typescript
{
  sentenceCaches: [{
    text: "John went home.",
    characterRefs: {
      "John": [{ text: "John", relativeIndex: 0 }]  // Position within sentence
    }
  }],
  cachedCharacterNames: ["John", "Mary"]
}
```

**[editorStore](lib/stores/editorStore.ts)**: Editor state and match highlighting
```typescript
{
  value: Descendant[],  // Slate document state
  matches: [{ start: 123, end: 125 }],  // Positions to highlight
  filter: [start, end] | null  // Optional view filter
}
```

### Smart Caching System

**Problem**: Re-processing the entire story for every edit is slow and wasteful.

**Solution**: Content-based diff algorithm with sentence-level caching.

#### How It Works

1. **Sentence Splitting**: Story → array of `{ text, startIndex }` (absolute positions)

2. **Content-Based Matching** ([coreferenceUtils.ts:16](lib/utils/coreferenceUtils.ts)):
   ```typescript
   // Build map of cached sentences by text content
   cacheTextMap = { "John went home.": [0], "Mary left.": [1] }

   // Match current sentences to cache by content (not position!)
   for each current sentence:
     find unused cached sentence with matching text
     if found: reuse cache
     else: mark as new (needs processing)
   ```

3. **Relative Indices**: Cache stores positions within sentences, not absolute story positions
   - When sentence moves: recalculate absolute position (no API calls needed)
   - When sentence changes: re-process only that sentence

4. **Index Recalculation** ([coreferenceUtils.ts:53](lib/utils/coreferenceUtils.ts)):
   ```typescript
   absoluteIndex = sentenceStartIndex + relativeIndex
   ```

#### Why Content-Based Matching?

**Scenario**: 16 sentences → insert 1 new sentence at position 5

- **Index-based** (wrong): Compares position 5 in cache with position 5 in current
  - Result: 11 sentences appear "modified" (false positives)

- **Content-based** (correct): Finds sentences by text content
  - Result: 16 reused, 1 new (only processes the new sentence)

### Utilities

#### SlateUtils ([lib/utils/slateUtils.tsx](lib/utils/slateUtils.tsx))

Bidirectional conversion between Slate state and text positions:

- `toSlatePoint(state, strIndex)`: String index → Slate Point (for decorations)
- `toStrIndex(state, point)`: Slate Point → string index
- `stateToText(state)`: Slate nodes → plain text (filters `.removed` nodes)

**Critical**: Handles the `.removed` property for nodes marked for deletion.

#### TextUtils ([lib/utils/textUtils.tsx](lib/utils/textUtils.tsx))

String matching utilities:

- `findAllMatches(str, search)`: Find all occurrences (simple indexOf loop)
- `findAllWordMatches(str, search)`: Find whole words only (uses `\b` word boundaries)
  - **Important**: Prevents "he" matching inside "the"
- `splitIntoSentences(text)`: Split on `.!?` with start indices tracked

#### CoreferenceUtils ([lib/utils/coreferenceUtils.ts](lib/utils/coreferenceUtils.ts))

Main orchestration for character extraction:

- `extractAllCoreferencesWithCache()`: Smart extraction with caching
  - Detects sentence changes using content-based diff
  - Only processes new/modified sentences
  - Accepts `existingCharacters` for conflict detection
  - Returns `{ characters, sentenceCaches }`

- `extractAllCoreferences()`: Legacy method (calls `WithCache` internally)

- `processSentence()`: Process one sentence (OLD architecture)
  - Calls `/api/attributes/*` for each category
  - Calls `/api/conflicts` for conflict detection
  - Parallelizes all API calls

#### EvidenceProcessor ([lib/utils/evidenceProcessor.ts](lib/utils/evidenceProcessor.ts))

New evidence-first processing implementation:

- `processSentenceEvidenceFirst()`: Three-phase evidence processing
  - **Phase 1**: Extract phrases (5 parallel calls per sentence)
  - **Phase 2**: Classify phrases (N parallel calls, N = phrase count)
  - **Phase 3**: Infer attributes (3 parallel calls per irrelevant phrase)
  - Converts results to compatible data structure
  - Used when `USE_EVIDENCE_FIRST=true`

## Critical Implementation Details

### 1. Single-Paragraph Editor

The editor normalizes all content into a single paragraph with `\n` for line breaks. This is enforced in TextEditor's `normalizeNode` override.

**Why**: Simplifies text extraction and position calculations.

### 2. Parallel API Processing

All API calls are parallelized using `Promise.all()`:
- For 3 characters × 10 sentences = 30 parallel API calls
- Typical processing time: 2-3 seconds

### 3. Word Boundary Matching

**Always use** `TextUtils.findAllWordMatches()` for coreference matching:
```typescript
// ❌ Wrong: Matches "he" in "the", "she", "them"
TextUtils.findAllMatches(text, "he")

// ✅ Correct: Matches "he" as complete word only
TextUtils.findAllWordMatches(text, "he")
```

### 4. Relative vs Absolute Indices

**In cache**: Store relative indices (position within sentence)
```typescript
{ text: "he", relativeIndex: 18 }  // 18 chars into this sentence
```

**In characterStore**: Store absolute indices (position in full story)
```typescript
{ text: "he", startIndex: 143, endIndex: 145 }  // Position in story
```

**Conversion**: Always happens in `sentenceCacheToMatches()`:
```typescript
absoluteIndex = sentenceStartIndex + relativeIndex
```

### 5. Content-Based Diff Algorithm

When comparing current story with cached sentences:

1. Build map: `cacheTextMap[sentenceText] = [cacheIndices]`
2. For each current sentence, find first unused cache entry with matching text
3. Track which cache entries were reused
4. Mark remaining current sentences as "new"

This handles:
- ✅ Insertions at any position
- ✅ Deletions (cache entries not matched)
- ✅ Reordering (matches by content)
- ✅ Modifications (text doesn't match → marked new)

### 6. LLM Number Handling

**Critical**: LLMs are bad at calculating positions. The system architecture avoids this:

- LLM returns: `["he", "John"]` (just the text strings)
- JavaScript calculates: Exact positions using `findAllWordMatches()`

Never ask LLM to return indices or positions!

### 7. Manual Character Management

The system supports creating and editing characters independently of AI extraction:

**Cold Start**: Users can add characters before writing any story
- Click "+ Add Character" button
- Add manual attributes using inline editors
- All three categories (Physiology, Psychology, Sociology) available

**Attribute Management**:
- Manual attributes have no evidence (empty evidence array)
- AI attributes have evidence from text
- When AI finds same attribute name as manual: **MERGE** evidence arrays
- All attributes deletable regardless of source

**Character Deletion**:
- Manual characters: Can be deleted anytime
- AI-extracted characters: Cannot be deleted (would be re-extracted)
- Deleted characters automatically removed from selection and graph

**Data Merging Logic** ([CharacterSidebar.tsx:handleExtractComplete](components/CharacterSidebar.tsx)):
```typescript
// When AI extraction completes:
1. For each AI character:
   - If character exists: Merge attributes by name
     - Same attribute name → combine evidence arrays
     - Different attributes → keep both
   - If new character: Add as-is
2. For each existing character not found by AI:
   - Keep in character list (preserves manual characters)
```

### 8. Evidence-First Architecture

**Why the change?**
- Old: Extract attributes directly → harder to verify and link evidence
- New: Extract evidence first → more precise attribute inference

**Three-Phase Pipeline**:

**Phase 1: Evidence Extraction**
- For each sentence with character coreference
- Extract phrases for 5 indicator types in parallel:
  - `directDefinition`: Explicit statements ("old man", "tall")
  - `actions`: Physical actions revealing traits ("moved slowly")
  - `speech`: Dialogue patterns revealing traits
  - `appearance`: Visual descriptions ("gray hair")
  - `environment`: Surroundings suggesting traits
- Returns: `{ text, startOffset }` for each phrase

**Phase 2: Classification** (for each phrase)
- Compare phrase against existing attributes (manual + AI)
- Returns one of:
  - `matching`: Phrase supports existing attribute → Link and STOP
  - `conflicting`: Phrase contradicts existing attribute → Save conflict and STOP
  - `irrelevant`: Phrase not related to existing attributes → Proceed to Phase 3

**Phase 3: Inference** (only for irrelevant phrases)
- Check what attributes the phrase demonstrates
- 3 parallel calls (Physiology, Psychology, Sociology)
- Returns: `{ hasAttribute, attributeName, confidence }`

**API Call Complexity**:
```
Old architecture (20 sentences, 3 characters):
- 20 × 3 × 3 = 180 attribute extraction calls
- 20 × 3 × 1 = 60 conflict detection calls
Total: 240 calls

New architecture (assume 10 phrases per sentence, 30% irrelevant):
- 20 × 3 × 5 = 300 extraction calls (Phase 1)
- 20 × 3 × 10 = 600 classification calls (Phase 2)
- 600 × 0.3 × 3 = 540 inference calls (Phase 3)
Total: 1440 calls

Mitigation:
- All calls maximally parallelized
- Sentence-level caching (unchanged sentences reuse results)
- Early termination for matching/conflicting (70% skip Phase 3)
- Uses gpt-4.1 for Phase 1 (10x cheaper)
```

**Feature Flag System**:
```typescript
// In coreferenceUtils.ts
const USE_EVIDENCE_FIRST = process.env.NEXT_PUBLIC_USE_EVIDENCE_FIRST === "true";

// Conditional processing:
processSentence = USE_EVIDENCE_FIRST
  ? EvidenceProcessor.processSentenceEvidenceFirst(...)
  : CoreferenceUtils.processSentence(...)
```

**Data Compatibility**:
- Both architectures produce same output structure
- Evidence-first converts to old format in final step
- Switching architectures doesn't break existing data

## Common Development Patterns

### Adding New Character Analysis Features

1. Create API route in `app/api/your-feature/route.tsx`
2. Add utility function to process results
3. Add store if state needs persistence
4. Wire up to TextEditor button/interaction

### Debugging Cache Issues

Console logs are already in place:
```typescript
console.log('Cache analysis: X reused, Y new sentences')
console.log('Cache mapping:', ...)  // Shows sentence-to-cache matching
```

To force cache clear:
```typescript
useSentenceCacheStore.getState().clearCache()
```

### Testing Sentence Diff Algorithm

Test scenarios:
- Insert sentence at beginning/middle/end
- Delete sentence
- Modify sentence text
- Reorder sentences
- Add multiple sentences

Expected: Only new/modified sentences processed, all others reused from cache.

## Project Structure

```
app/
  api/
    character/route.tsx            # Extract character names
    coreference/route.tsx          # Find character references
    attributes/
      physiology/route.tsx         # OLD: Extract physiology attributes
      psychology/route.tsx         # OLD: Extract psychology attributes
      sociology/route.tsx          # OLD: Extract sociology attributes
    conflicts/route.tsx            # OLD: Detect attribute conflicts
    evidence/
      extract/route.tsx            # NEW: Phase 1 - Extract phrases
      classify/route.tsx           # NEW: Phase 2 - Classify phrases
      infer/route.tsx              # NEW: Phase 3 - Infer attributes
  page.tsx                         # Main page (renders EditorPage)
  layout.tsx                       # Root layout

components/
  EditorPage.tsx                   # Main container with state management
  TextEditor.tsx                   # Slate editor component
  Leaf.tsx                         # Slate leaf rendering (for highlights)
  CharacterSidebar.tsx             # Character list with add button
  CharacterSheet.tsx               # Character detail view with editing
  AddCharacterModal.tsx            # Modal for creating characters
  AttributeEditor.tsx              # Inline attribute input component
  RelationshipGraph.tsx            # Character relationship visualization
  Toolbar.tsx                      # Extract characters button

lib/
  stores/
    characterStore.ts              # Character CRUD with persistence
    sentenceCacheStore.ts          # Smart sentence caching
    editorStore.ts                 # Editor state
    relationshipStore.ts           # Character relationships
  utils/
    coreferenceUtils.ts            # Extraction orchestration
    evidenceProcessor.ts           # NEW: Evidence-first processing
    slateUtils.tsx                 # Slate ↔ text conversion
    textUtils.tsx                  # String matching utilities
  types/
    slate.d.ts                     # Slate type extensions
    attributes.ts                  # Attribute type definitions
    indicators.ts                  # Indicator type definitions
    evidence.ts                    # NEW: Evidence-first types
```

## Performance Characteristics

### Old Architecture

**First Extraction (No Cache)**
- 3 characters × 20 sentences × 4 API calls = 240 API calls
- Time: ~3-5 seconds

**Incremental Edit (With Cache)**
- Edit 2 sentences: 2 × 3 × 4 = 24 API calls
- Time: ~0.5-1 seconds
- **Speedup: ~10x**

### Evidence-First Architecture (Experimental)

**First Extraction (No Cache)**
- Assume 10 phrases per sentence, 30% irrelevant
- 3 characters × 20 sentences:
  - Phase 1: 20 × 3 × 5 = 300 extraction calls
  - Phase 2: 20 × 3 × 10 = 600 classification calls
  - Phase 3: 600 × 0.3 × 3 = 540 inference calls
  - Total: 1440 API calls
- Time: ~8-12 seconds (with maximum parallelization)

**Incremental Edit (With Cache)**
- Edit 2 sentences: 2 × 3 = 6 sentences
- Assume 10 phrases per sentence, 30% irrelevant:
  - Phase 1: 6 × 5 = 30 extraction calls
  - Phase 2: 6 × 10 = 60 classification calls
  - Phase 3: 60 × 0.3 × 3 = 54 inference calls
  - Total: 144 API calls
- Time: ~2-3 seconds
- **Still benefits from caching (~10x speedup)**

### After Page Refresh
- All data loaded from localStorage
- No extraction needed unless story changed
- **Instant** (both architectures)

## Known Limitations

1. **Single paragraph only**: Multi-paragraph support would require architecture changes
2. **No undo for extractions**: Character data persists, but attributes can be deleted individually
3. **Cache invalidation**: Changing character list requires full re-processing
4. **No partial character updates**: Must re-extract all characters together
5. **Evidence-first performance**: New architecture uses ~6x more API calls than old
6. **Manual character limitations**: Cannot prevent AI from re-extracting manually created characters

## Migration Guide

### Upgrading to Evidence-First Architecture

1. **Set environment variable** in `.env.local`:
```bash
NEXT_PUBLIC_USE_EVIDENCE_FIRST=true
```

2. **Clear existing cache** (optional but recommended):
```typescript
// In browser console:
useSentenceCacheStore.getState().clearCache()
```

3. **Test with small story first**:
- Evidence-first uses more API calls
- Monitor performance and API costs
- Adjust based on results

4. **Rollback if needed**:
```bash
NEXT_PUBLIC_USE_EVIDENCE_FIRST=false
```
- Both architectures produce compatible data
- No data migration needed

### Data Migration Notes

**Version 1 → Version 2 (Manual Characters)**:
- Automatic migration in characterStore
- Adds `source` field to existing characters (defaults to "ai-extracted")
- No user action required

**Old → Evidence-First Architecture**:
- No data migration needed
- Same output structure
- Switch flag to toggle between architectures

## Troubleshooting

### "No attributes extracted yet" showing for manual characters
- Check that character has `source: "manual"`
- Verify editing is enabled in CharacterSheet
- Look for attributes array (should exist, possibly empty)

### Deleted characters still showing in graph
- Check cleanup effect in EditorPage
- Verify character removed from characterStore
- Clear browser cache if persisting

### Manual attributes not considered in conflict detection
- Verify existingCharacters passed to Toolbar
- Check CoreferenceUtils receives existingCharacters
- Ensure manual attributes included in conflict API call

### Evidence-first not activating
- Verify `NEXT_PUBLIC_USE_EVIDENCE_FIRST=true` in `.env.local`
- Restart dev server after changing environment variables
- Check console for feature flag value

### High API usage with evidence-first
- Expected behavior (6x more calls than old architecture)
- Verify sentence caching working (check console logs)
- Consider using old architecture for large stories
- Monitor OpenAI API usage and costs
