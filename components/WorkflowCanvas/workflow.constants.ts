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
    data: { label: "Base Story", eventGroupId: 1 },
    style: {
      width: 900,
      height: 220,
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
      description:
        "Ben watched his bedroom door close behind him, muffling the sounds of his father's voice and his new stepmom calling Harper downstairs. The world suddenly felt unfamiliar—different routines, new faces at the breakfast table, and the confusing swirl of emotions that came with change. Whenever Ben couldn't find the right words or felt out of place, he retreated into his imagination, strapping on his cardboard helmet to become Commander Ben, astronaut explorer of distant galaxies. It was in these imaginary missions that Ben felt capable of understanding the unknowns stretching before him. Harper, his stepsister, often peeked curiously around the corner, her gaze lingering on Ben's elaborate rocket drawings and hand-labeled control panels. Slowly, she began asking about his missions, her own curiosity orbiting Ben’s imaginative universe.",
      timeline: "Act 1",
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
      description:
        "One rainy afternoon, Ben invited Harper to join his latest mission: a daring flight to the moons of Jupiter. As they prepared their spaceship out of old boxes and blankets, Harper suggested adding bright stickers for extra cosmic protection, while Ben insisted on strict launch procedures. These differences led to a little turbulence—Harper’s creative flourishes clashed with Ben’s regimented plans. But as they navigated asteroid fields and hidden comets together, they began to find humor in their disputes, learning to share captain duties and compromise on the ship’s design. Side by side beneath the blanket fort, the barriers between their worlds began to fade with each shared laugh and joint victory over imaginary dangers.",
      timeline: "Act 2",
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
      description:
        "After an upsetting argument at dinner left everyone silent, Ben retreated to his room, wishing he could blast off to somewhere far away. Harper arrived at his door, her voice gentle as she suggested they launch one more mission together—this time, to rescue a lonely explorer stranded on a distant planet. As they constructed a rescue pod and braved imaginary storms, their teamwork felt different than before: more trusting, more caring. Completing the mission with Harper, Ben realized their partnership had grown stronger, grounded not just in play, but in genuine understanding. Back at the dinner table that night, Ben and Harper exchanged shy smiles, their shared adventure a quiet bridge across the uncertainties of their new family.",
      timeline: "Act 3",
    },
    parentId: "event-group",
    extent: "parent",
  },
];

export const initialEdges: WorkflowEdge[] = [
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
];
