# Character Relationship Visualization

## Overview

The character relationship visualization feature uses AI to analyze relationships between characters in your story and displays them as an interactive node-based graph using ReactFlow.

## How to Use

1. **Write your story** in the TextEditor
2. **Extract characters** using the "Extract Characters" button
3. **Analyze relationships**:
   - Scroll to the "Character Relationships" section in the sidebar
   - Click "Show" to expand the section
   - Click "Analyze Relationships" button
   - Wait for the AI to analyze (typically 2-5 seconds)
4. **Interact with the graph**:
   - **Click on nodes** to select that character in the editor
   - **Pan and zoom** using mouse/trackpad
   - **Hover over edges** to see relationship descriptions
   - View the **legend** in the top-right for relationship types

## Features

### Relationship Types

The system identifies 6 types of relationships:

- **Friend** (Green) - Friendships and positive relationships
- **Family** (Blue) - Family members and relatives
- **Romantic** (Pink) - Romantic or love relationships
- **Enemy** (Red) - Antagonistic or hostile relationships
- **Colleague** (Purple) - Professional or work relationships
- **Other** (Gray) - Relationships that don't fit other categories

### Graph Features

- **Auto-layout**: Uses dagre algorithm for clean, hierarchical positioning
- **Directed edges**: Arrows show relationship direction (A → B)
- **Interactive nodes**: Click to highlight character in editor
- **Color-coded**: Edges are colored by relationship type
- **Bidirectional**: Shows both A→B and B→A if both are relevant

### Data Persistence

- Relationships are **cached** in localStorage
- Survives page refreshes
- Only re-analyzes when you click the button again

## Technical Implementation

### API Endpoint

**Endpoint**: `/api/relationships`
**Method**: POST
**Input**:
```json
{
  "story": "The full story text...",
  "characters": ["John", "Mary", "Tom"]
}
```

**Output**:
```json
{
  "relationships": [
    {
      "source": "John",
      "target": "Mary",
      "type": "friend",
      "description": "John and Mary are close friends who help each other"
    }
  ]
}
```

### Components

1. **RelationshipGraph.tsx** - ReactFlow visualization component
2. **relationshipStore.ts** - Zustand store for state management
3. **CharacterSidebar.tsx** - Integration into existing UI

### Dependencies

- `@xyflow/react` - React Flow library for node-based graphs
- `dagre` - Graph layout algorithm
- `@types/dagre` - TypeScript types for dagre

## Architecture Decisions

### Why LLM for Relationship Analysis?

- Understands context and nuance better than rule-based systems
- Can identify implicit relationships (not just explicit mentions)
- Handles complex narratives with multiple character dynamics

### Why ReactFlow?

- Production-ready, well-maintained library
- Built-in features: zoom, pan, controls
- Customizable styling and interactions
- TypeScript support

### Why Dagre Layout?

- Handles directed graphs well
- Creates clean, hierarchical layouts
- Automatic positioning (no manual layout needed)

## Future Enhancements

Potential improvements:

1. **Relationship strength**: Add weights to edges (close friend vs acquaintance)
2. **Timeline view**: Show how relationships evolve through the story
3. **Filtering**: Hide/show specific relationship types
4. **Custom layouts**: Force-directed, circular, tree layouts
5. **Export**: Save graph as image or data file
6. **Edit mode**: Manually adjust relationships if AI gets them wrong

## Tips for Best Results

1. **Clear narrative**: The clearer your story, the better the relationship analysis
2. **Extract first**: Always extract characters before analyzing relationships
3. **Re-analyze**: If you significantly change your story, re-run the analysis
4. **Multiple characters**: Need at least 2 characters for meaningful visualization
