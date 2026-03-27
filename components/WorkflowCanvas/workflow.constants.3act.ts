import type { WorkflowEdge, WorkflowNode } from "@/lib/types/workflow";

export type {
  EventNodeData,
  PerspectiveNodeData,
  NarrativeNodeData,
  CharacterTraits,
  CharacterNodeData,
  EventNodeType,
  PerspectiveNodeType,
  NarrativeNodeType,
  CharacterNodeType,
  GroupNodeType,
  WorkflowNode,
  WorkflowEdge,
} from "@/lib/types/workflow";

export const initialNodes: WorkflowNode[] = [
  {
    id: "event-group",
    type: "eventGroup",
    position: { x: 200, y: 20 },
    data: { label: "Outline", eventGroupId: 1 },
    style: {
      width: 920,
      height: 220,
      backgroundColor: "transparent",
      border: "none",
      padding: 0,
      boxShadow: "none",
    },
  },
  {
    id: "perspective-group-char1",
    type: "perspectiveGroup",
    position: { x: 0, y: 360 },
    data: {
      label: "Character Arc",
      characterName: "Character 1",
    },
    style: {
      width: 920,
      height: 720,
      backgroundColor: "transparent",
      border: "none",
      padding: 0,
      boxShadow: "none",
    },
  },
  {
    id: "perspective-group-char2",
    type: "perspectiveGroup",
    position: { x: 1020, y: 360 },
    data: {
      label: "Character Arc",
      characterName: "Character 2",
    },
    style: {
      width: 920,
      height: 720,
      backgroundColor: "transparent",
      border: "none",
      padding: 0,
      boxShadow: "none",
    },
  },
  {
    id: "narration-group",
    type: "narrativeGroup",
    position: { x: 520, y: 1200 },
    data: {
      label: "Third-Person Narrative Cluster",
      narrativeGroupId: 1,
    },
    style: {
      width: 920,
      height: 420,
      backgroundColor: "transparent",
      border: "none",
      padding: 0,
      boxShadow: "none",
    },
  },
  {
    id: "event-1",
    type: "event",
    position: { x: 20, y: 60 },
    draggable: false,
    data: {
      description: "",
      timeline: "Plot 1",
    },
    parentId: "event-group",
    extent: "parent",
  },
  {
    id: "event-2",
    type: "event",
    position: { x: 320, y: 60 },
    draggable: false,
    data: {
      description: "",
      timeline: "Plot 2",
    },
    parentId: "event-group",
    extent: "parent",
  },
  {
    id: "event-3",
    type: "event",
    position: { x: 620, y: 60 },
    draggable: false,
    data: {
      description: "",
      timeline: "Plot 3",
    },
    parentId: "event-group",
    extent: "parent",
  },
  {
    id: "perspective-char1-1",
    type: "perspective",
    position: { x: 20, y: 60 },
    draggable: false,
    data: {
      narrator: "",
      reflection: "",
      isLoading: false,
    },
    parentId: "perspective-group-char1",
    extent: "parent",
  },
  {
    id: "perspective-char1-2",
    type: "perspective",
    position: { x: 320, y: 60 },
    draggable: false,
    data: {
      narrator: "",
      reflection: "",
      isLoading: false,
    },
    parentId: "perspective-group-char1",
    extent: "parent",
  },
  {
    id: "perspective-char1-3",
    type: "perspective",
    position: { x: 620, y: 60 },
    draggable: false,
    data: {
      narrator: "",
      reflection: "",
      isLoading: false,
    },
    parentId: "perspective-group-char1",
    extent: "parent",
  },
  {
    id: "perspective-char2-1",
    type: "perspective",
    position: { x: 20, y: 60 },
    draggable: false,
    data: {
      narrator: "",
      reflection: "",
      isLoading: false,
    },
    parentId: "perspective-group-char2",
    extent: "parent",
  },
  {
    id: "perspective-char2-2",
    type: "perspective",
    position: { x: 320, y: 60 },
    draggable: false,
    data: {
      narrator: "",
      reflection: "",
      isLoading: false,
    },
    parentId: "perspective-group-char2",
    extent: "parent",
  },
  {
    id: "perspective-char2-3",
    type: "perspective",
    position: { x: 620, y: 60 },
    draggable: false,
    data: {
      narrator: "",
      reflection: "",
      isLoading: false,
    },
    parentId: "perspective-group-char2",
    extent: "parent",
  },
  {
    id: "character-char1-1",
    type: "character",
    position: { x: 20, y: 280 },
    draggable: false,
    data: {
      name: "",
      traits: {
        physiology: [],
        psychology: [],
        sociology: [],
      },
      perspectiveId: "perspective-char1-1",
    },
    parentId: "perspective-group-char1",
    extent: "parent",
  },
  {
    id: "character-char1-3",
    type: "character",
    position: { x: 620, y: 280 },
    draggable: false,
    data: {
      name: "",
      traits: {
        physiology: [],
        psychology: [],
        sociology: [],
      },
      perspectiveId: "perspective-char1-3",
    },
    parentId: "perspective-group-char1",
    extent: "parent",
  },
  {
    id: "character-char2-1",
    type: "character",
    position: { x: 20, y: 280 },
    draggable: false,
    data: {
      name: "",
      traits: {
        physiology: [],
        psychology: [],
        sociology: [],
      },
      perspectiveId: "perspective-char2-1",
    },
    parentId: "perspective-group-char2",
    extent: "parent",
  },
  {
    id: "character-char2-3",
    type: "character",
    position: { x: 620, y: 280 },
    draggable: false,
    data: {
      name: "",
      traits: {
        physiology: [],
        psychology: [],
        sociology: [],
      },
      perspectiveId: "perspective-char2-3",
    },
    parentId: "perspective-group-char2",
    extent: "parent",
  },
  {
    id: "narrative-1",
    type: "narrative",
    position: { x: 20, y: 60 },
    draggable: false,
    data: {
      narration: "",
      isLoading: false,
    },
    parentId: "narration-group",
    extent: "parent",
  },
  {
    id: "narrative-2",
    type: "narrative",
    position: { x: 320, y: 60 },
    draggable: false,
    data: {
      narration: "",
      isLoading: false,
    },
    parentId: "narration-group",
    extent: "parent",
  },
  {
    id: "narrative-3",
    type: "narrative",
    position: { x: 620, y: 60 },
    draggable: false,
    data: {
      narration: "",
      isLoading: false,
    },
    parentId: "narration-group",
    extent: "parent",
  },
];

export const exampleEventDescriptions: string[] = [
  "Dawn raid on the village. Aria breaks formation to save a trapped child. Lysa watches from the archive tower, documenting the chaos. Aria is publicly reprimanded and demoted to archive duty under Lysa's supervision.",
  "Evening in the archives. Aria discovers old battle records showing a pattern in the raids. Lysa shares tactical insights from historical texts. They clash over methods but gradually find common ground, planning an ambush strategy together.",
  "A scouting party returns with news: a massive raider force is gathering in the northern pass. Aria wants to strike first; Lysa insists on fortifying defenses. Their argument escalates until the village elder forces them to work as co-commanders.",
  "Night battle at the northern pass. Aria leads a decoy squad while Lysa coordinates the main defense from the archive tower using signal fires. The plan nearly fails when raiders breach the west wall, but Aria improvises a counter-charge that turns the tide.",
  "Dawn after victory. The village council honors both Aria and Lysa. Aria accepts a new role bridging scouts and scholars. Lysa opens the archives to train a new generation of tactician-scouts. They part as reluctant allies turned trusted partners.",
];

export type ExampleCharacterData = {
  name: string;
  traits: {
    physiology: string[];
    psychology: string[];
    sociology: string[];
  };
};

export const exampleCharacters: {
  char1: ExampleCharacterData[];
  char2: ExampleCharacterData[];
} = {
  char1: [
    // Plot 1 – Exposition: reckless scout, demoted
    {
      name: "Aria",
      traits: {
        physiology: ["Quick-footed scout", "Athletic build"],
        psychology: [
          "Impulsive",
          "Hungry to prove herself",
          "Brave to a fault",
        ],
        sociology: [
          "Favored by the village guard captain",
          "Resented by some archive scribes",
        ],
      },
    },
    // Plot 2 – Rising Action: reluctant scholar, grudging respect
    {
      name: "Aria",
      traits: {
        physiology: ["Ink-smudged hands from handling old records"],
        psychology: [
          "Restless but curious",
          "Starting to appreciate patterns in chaos",
          "Still impatient with slow methods",
        ],
        sociology: [
          "Demoted to archive duty",
          "Grudging respect for Lysa's knowledge",
        ],
      },
    },
    // Plot 3 – Climax: frustrated co-commander, forced to collaborate
    {
      name: "Aria",
      traits: {
        physiology: [
          "Tense posture from constant arguments",
          "Carries both sword and scrolls",
        ],
        psychology: [
          "Torn between instinct and strategy",
          "Frustrated by compromise",
          "Slowly learning to plan before acting",
        ],
        sociology: [
          "Appointed co-commander by the village elder",
          "Uneasy alliance with Lysa",
        ],
      },
    },
    // Plot 4 – Falling Action: battlefield improviser, trust earned
    {
      name: "Aria",
      traits: {
        physiology: [
          "Battle-scarred but steady",
          "Moves with calculated precision",
        ],
        psychology: [
          "Channels impulse into decisive action",
          "Trusts Lysa's strategic calls",
          "Finds courage in teamwork, not solo glory",
        ],
        sociology: [
          "Respected decoy squad leader",
          "Earned trust from scholars and guards alike",
        ],
      },
    },
    // Plot 5 – Resolution: bridge between worlds
    {
      name: "Aria",
      traits: {
        physiology: ["Wears a reinforced archivist's cloak"],
        psychology: [
          "Strategic thinker",
          "Protective without recklessness",
          "Values both action and wisdom",
        ],
        sociology: [
          "Accepted voice on the village council",
          "Bridge between scouts and scholars",
        ],
      },
    },
  ],
  char2: [
    // Plot 1 – Exposition: cautious archivist, observer
    {
      name: "Lysa",
      traits: {
        physiology: ["Scholarly posture", "Ink-stained fingers"],
        psychology: [
          "Cautious",
          "Values order and tradition",
          "Skeptical of rash action",
        ],
        sociology: [
          "Head archivist of the village",
          "Keeper of historical records",
        ],
      },
    },
    // Plot 2 – Rising Action: reluctant teacher, thawing walls
    {
      name: "Lysa",
      traits: {
        physiology: ["Gestures more animatedly when explaining tactics"],
        psychology: [
          "Surprised by Aria's sharp eye for patterns",
          "Protective of her methods but willing to explain",
          "Still rigid about proper procedure",
        ],
        sociology: [
          "Supervising Aria's archive duty",
          "Beginning to see Aria as a capable mind",
        ],
      },
    },
    // Plot 3 – Climax: reluctant field strategist, adapting
    {
      name: "Lysa",
      traits: {
        physiology: [
          "Dark circles from sleepless planning nights",
          "Clutches historical maps tightly",
        ],
        psychology: [
          "Anxious about untested strategies",
          "Forced to adapt knowledge to real-world chaos",
          "Discovering confidence outside the archive",
        ],
        sociology: [
          "Appointed co-commander alongside Aria",
          "Struggling to command respect from field soldiers",
        ],
      },
    },
    // Plot 4 – Falling Action: tower commander, trust forged
    {
      name: "Lysa",
      traits: {
        physiology: [
          "Voice hoarse from shouting signal commands",
          "Stands tall at the tower parapet",
        ],
        psychology: [
          "Calm under fire",
          "Trusts Aria's battlefield instincts",
          "Adapts plans in real-time without hesitation",
        ],
        sociology: [
          "Commanding signal operations from the archive tower",
          "Guards now follow her tactical calls",
        ],
      },
    },
    // Plot 5 – Resolution: mentor and strategist
    {
      name: "Lysa",
      traits: {
        physiology: [
          "Wears battle-worn archivist robes",
          "Carries tactical maps",
        ],
        psychology: [
          "Pragmatic strategist",
          "Open to unconventional methods",
          "Sees value in diverse perspectives",
        ],
        sociology: [
          "Respected by both guards and archivists",
          "Mentor to young tacticians",
        ],
      },
    },
  ],
};

export const initialEdges: WorkflowEdge[] = [
  // Event group to perspective groups
  {
    id: "edge-event-group-perspective-group-char1",
    source: "event-group",
    target: "perspective-group-char1",
    sourceHandle: "group-bridge",
    targetHandle: "group-bridge",
    type: "customEdge",
    animated: true,
  },
  {
    id: "edge-event-group-perspective-group-char2",
    source: "event-group",
    target: "perspective-group-char2",
    sourceHandle: "group-bridge",
    targetHandle: "group-bridge",
    type: "customEdge",
    animated: true,
  },
  // Perspective groups to narrative group
  {
    id: "edge-perspective-group-char1-narration-group",
    source: "perspective-group-char1",
    target: "narration-group",
    sourceHandle: "narrative-bridge",
    targetHandle: "group-bridge",
    type: "customEdge",
    animated: true,
  },
  {
    id: "edge-perspective-group-char2-narration-group",
    source: "perspective-group-char2",
    target: "narration-group",
    sourceHandle: "narrative-bridge",
    targetHandle: "group-bridge",
    type: "customEdge",
    animated: true,
  },
  // Event connections
  {
    id: "edge-event-1-2",
    source: "event-1",
    target: "event-2",
    sourceHandle: "event-next",
    targetHandle: "event-prev",
    type: "eventEdge",
    animated: true,
  },
  {
    id: "edge-event-2-3",
    source: "event-2",
    target: "event-3",
    sourceHandle: "event-next",
    targetHandle: "event-prev",
    type: "eventEdge",
    animated: true,
  },
  // Char1 perspective connections
  {
    id: "edge-perspective-char1-1-2",
    source: "perspective-char1-1",
    target: "perspective-char1-2",
    sourceHandle: "perspective-next",
    targetHandle: "perspective-prev",
    type: "customEdge",
    animated: true,
  },
  {
    id: "edge-perspective-char1-2-3",
    source: "perspective-char1-2",
    target: "perspective-char1-3",
    sourceHandle: "perspective-next",
    targetHandle: "perspective-prev",
    type: "customEdge",
    animated: true,
  },
  // Char2 perspective connections
  {
    id: "edge-perspective-char2-1-2",
    source: "perspective-char2-1",
    target: "perspective-char2-2",
    sourceHandle: "perspective-next",
    targetHandle: "perspective-prev",
    type: "customEdge",
    animated: true,
  },
  {
    id: "edge-perspective-char2-2-3",
    source: "perspective-char2-2",
    target: "perspective-char2-3",
    sourceHandle: "perspective-next",
    targetHandle: "perspective-prev",
    type: "customEdge",
    animated: true,
  },
  // Char1 character to perspective connections
  {
    id: "edge-character-char1-1-perspective-char1-1",
    source: "character-char1-1",
    target: "perspective-char1-1",
    sourceHandle: "perspective",
    targetHandle: "character",
    type: "customEdge",
    animated: true,
  },
  {
    id: "edge-character-char1-3-perspective-char1-3",
    source: "character-char1-3",
    target: "perspective-char1-3",
    sourceHandle: "perspective",
    targetHandle: "character",
    type: "customEdge",
    animated: true,
  },
  // Char2 character to perspective connections
  {
    id: "edge-character-char2-1-perspective-char2-1",
    source: "character-char2-1",
    target: "perspective-char2-1",
    sourceHandle: "perspective",
    targetHandle: "character",
    type: "customEdge",
    animated: true,
  },
  {
    id: "edge-character-char2-3-perspective-char2-3",
    source: "character-char2-3",
    target: "perspective-char2-3",
    sourceHandle: "perspective",
    targetHandle: "character",
    type: "customEdge",
    animated: true,
  },
  // Narrative connections
  {
    id: "edge-narrative-1-2",
    source: "narrative-1",
    target: "narrative-2",
    sourceHandle: "narrative-next",
    targetHandle: "narrative-prev",
    type: "customEdge",
    animated: true,
  },
  {
    id: "edge-narrative-2-3",
    source: "narrative-2",
    target: "narrative-3",
    sourceHandle: "narrative-next",
    targetHandle: "narrative-prev",
    type: "customEdge",
    animated: true,
  },
];
