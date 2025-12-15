export interface TimelineItem {
  id: string;
  content: string;
  position: number;
  nodeId: string;
  nodeType: string;
}

export interface TimelineTrack {
  id: string;
  label: string;
  type: "story" | "perspective" | "character" | "narrative";
  items: TimelineItem[];
  parentTrackId?: string;
  characterName?: string;
}

export interface StoryOutlineCluster {
  id: string;
  label: string;
  track: TimelineTrack;
  eventGroupId: string;
}

export interface NarrativeCluster {
  id: string;
  label: string;
  track: TimelineTrack;
  narrativeGroupId: string;
  linkedEventGroupId?: string;
}

export interface TimelineData {
  storyTrack: TimelineTrack | null;
  characterTracks: TimelineTrack[];
  narrativeTrack: TimelineTrack | null;
  maxPosition: number;
  // New cluster-based data
  storyOutlineClusters: StoryOutlineCluster[];
  narrativeClusters: NarrativeCluster[];
}
