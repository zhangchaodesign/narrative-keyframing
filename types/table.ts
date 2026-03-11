export type NarrativeSnippet = {
  perspectiveNodeId: string;
  text: string;
  characterId: string;
  characterName: string;
  attributes: string[];
};

export type NarrativePerspective = {
  narrator: string;
  reflection: string;
};

export type SnippetUsage = {
  originalSnippet: string;
  verbatimInNarrative: string;
  narrator?: string;
};

export type EventData = {
  narrativeNodeId: string;
  eventId?: string;
  eventDescription: string;
  eventTimeline: string;
  snippets: NarrativeSnippet[];
  perspectives: NarrativePerspective[];
  narration?: string;
  snippetUsages?: SnippetUsage[];
};
