export type NarrativeEventData = {
  narrativeNodeId: string;
  eventId?: string;
  eventDescription: string;
  eventTimeline: string;
  snippets: Array<{
    perspectiveNodeId: string;
    text: string;
    characterId: string;
    characterName: string;
    attributes: string[];
  }>;
  perspectives: Array<{
    narrator: string;
    reflection: string;
  }>;
  narration?: string;
  snippetUsages?: Array<{
    originalSnippet: string;
    verbatimInNarrative: string;
    narrator?: string;
  }>;
};
