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
```

## Architecture

### Core Data Flow

```
User writes story in TextEditor (Slate.js)
    ↓
Click "Extract Characters"
    ↓
1. /api/character → Extract character names
2. /api/coreference → Find references for each character in each sentence
3. Smart caching system → Only process changed sentences
    ↓
Results saved to Zustand stores (persisted to localStorage)
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

**[/api/character](app/api/character/route.tsx)**: Extracts character names from story
- Input: `{ story: string }`
- Output: `{ characters: string[] }`
- Model: gpt-4.1

**[/api/coreference](app/api/coreference/route.tsx)**: Finds character references in a sentence
- Input: `{ story: string, characterName: string, sentence: string }`
- Output: `{ coreferences: string[] }` - e.g., `["he", "him", "John"]`
- **Critical**: Returns text strings only (not indices) to avoid LLM hallucination

#### 3. State Management (Zustand Stores)

All stores use `persist` middleware for localStorage persistence:

**[characterStore](lib/stores/characterStore.ts)**: Extracted characters with coreference matches
```typescript
{
  characters: [{
    name: "John",
    coreferenceMatches: [{
      sentenceIndex: 5,
      startIndex: 123,  // Absolute position in story
      endIndex: 125,
      text: "he"
    }]
  }]
}
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
  - Returns `{ characters, sentenceCaches }`

- `extractAllCoreferences()`: Legacy method (calls `WithCache` internally)

- `processSentence()`: Process one sentence for all characters in parallel

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
    character/route.tsx      # Extract character names
    coreference/route.tsx    # Find character references
  page.tsx                   # Main page (renders TextEditor)
  layout.tsx                 # Root layout

components/
  TextEditor.tsx             # Main editor component
  Leaf.tsx                   # Slate leaf rendering (for highlights)

lib/
  stores/
    characterStore.ts        # Character data with matches
    sentenceCacheStore.ts    # Smart sentence caching
    editorStore.ts           # Editor state
  utils/
    coreferenceUtils.ts      # Caching orchestration
    slateUtils.tsx           # Slate ↔ text conversion
    textUtils.tsx            # String matching utilities
  types/
    slate.d.ts               # Slate type extensions
```

## Performance Characteristics

### First Extraction (No Cache)
- 3 characters × 20 sentences = 60 API calls
- Time: ~3-5 seconds

### Incremental Edit (With Cache)
- Edit 2 sentences: 2 × 3 = 6 API calls
- Time: ~0.5-1 seconds
- **Speedup: ~10x**

### After Page Refresh
- All data loaded from localStorage
- No extraction needed unless story changed
- **Instant**

## Known Limitations

1. **Single paragraph only**: Multi-paragraph support would require architecture changes
2. **No undo for extractions**: Character data persists, manual clear needed
3. **Cache invalidation**: Changing character list requires full re-processing
4. **No partial character updates**: Must re-extract all characters together
