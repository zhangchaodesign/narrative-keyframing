export type ExampleCharacterData = {
  name: string;
  traits: {
    physiology: string[];
    psychology: string[];
    sociology: string[];
  };
};

export const exampleEventDescriptions: string[] = [
  "Alfred and Betty are looking at a picture when they begin imagining a world of castles, knights, and dragons. What starts as an ordinary moment soon feels like the beginning of a real adventure.",
  "A dragon appears, and Alfred and Betty run away as fast as they can. They are frightened, but they know they cannot hide forever.",
  "Alfred becomes a brave knight, and Betty becomes a powerful wizard. Together, they prepare to face the dragon with courage, skill, and magic.",
  "Alfred fights the dragon with his sword while Betty uses her magic to weaken it. Working as a team, they defeat the dragon and save the land.",
  "After their victory, Alfred and Betty stand proudly near the castle. They celebrate their success and remember that bravery and teamwork helped them save the day.",
];

/**
 * Each entry is one character's snapshots across the 5 plots.
 * Use `null` for plots where no character snapshot is needed.
 */
export const exampleCharacters: {
  name: string;
  snapshots: (ExampleCharacterData | null)[];
}[] = [
  {
    name: "Alfred",
    snapshots: [
      // Plot 1 — The Discovery
      {
        name: "Alfred",
        traits: {
          physiology: ["Small child", "Bright curious eyes"],
          psychology: [
            "Imaginative",
            "Curious",
            "Easily excited by adventure",
          ],
          sociology: [
            "Best friends with Betty",
            "Loves looking at picture books",
          ],
        },
      },
      // Plot 2 — no snapshot
      null,
      // Plot 3 — The Transformation
      {
        name: "Alfred",
        traits: {
          physiology: [
            "Wears shining knight's armor",
            "Carries a gleaming sword",
          ],
          psychology: [
            "Determined to protect others",
            "Overcomes fear with courage",
            "Ready to fight for what is right",
          ],
          sociology: [
            "Sworn protector of the land",
            "Trusted battle partner to Betty",
          ],
        },
      },
      // Plot 4 — no snapshot
      null,
      // Plot 5 — The Happy Ending
      {
        name: "Alfred",
        traits: {
          physiology: ["Stands tall and proud", "Battle-worn but smiling"],
          psychology: [
            "Brave and confident",
            "Humble in victory",
            "Values teamwork above all",
          ],
          sociology: [
            "Hero of the castle",
            "Celebrated alongside Betty",
          ],
        },
      },
    ],
  },
  {
    name: "Betty",
    snapshots: [
      // Plot 1 — The Discovery
      {
        name: "Betty",
        traits: {
          physiology: ["Small child", "Wide-eyed and attentive"],
          psychology: [
            "Imaginative",
            "Thoughtful",
            "Quick-witted and resourceful",
          ],
          sociology: [
            "Best friends with Alfred",
            "Loves stories and make-believe",
          ],
        },
      },
      // Plot 2 — no snapshot
      null,
      // Plot 3 — The Transformation
      {
        name: "Betty",
        traits: {
          physiology: [
            "Wears a flowing wizard's robe",
            "Carries a glowing magical staff",
          ],
          psychology: [
            "Focused and disciplined",
            "Channels creativity into powerful spells",
            "Calm under pressure",
          ],
          sociology: [
            "Powerful wizard of the realm",
            "Strategic partner to Alfred",
          ],
        },
      },
      // Plot 4 — no snapshot
      null,
      // Plot 5 — The Happy Ending
      {
        name: "Betty",
        traits: {
          physiology: [
            "Sparkling magical aura",
            "Staff glows with residual power",
          ],
          psychology: [
            "Wise beyond her years",
            "Proud of what teamwork achieved",
            "Celebrates others' bravery",
          ],
          sociology: [
            "Celebrated wizard of the land",
            "Loyal companion to Alfred",
          ],
        },
      },
    ],
  },
  {
    name: "Dragon",
    snapshots: [
      // Plot 1 — no snapshot
      null,
      // Plot 2 — The Danger
      {
        name: "Dragon",
        traits: {
          physiology: [
            "Enormous scaly beast",
            "Breathes scorching fire",
            "Wings that darken the sky",
          ],
          psychology: [
            "Fearsome and territorial",
            "Driven by hunger and dominance",
            "Unaware of its own loneliness",
          ],
          sociology: [
            "Terror of the kingdom",
            "Feared by all villagers",
          ],
        },
      },
      // Plot 3 — no snapshot
      null,
      // Plot 4 — The Battle
      {
        name: "Dragon",
        traits: {
          physiology: [
            "Scales cracked by sword strikes",
            "Fire weakened by Betty's magic",
          ],
          psychology: [
            "Furious but increasingly desperate",
            "Surprised by the children's courage",
            "Fighting with all remaining strength",
          ],
          sociology: [
            "Challenged for the first time",
            "Losing grip on its dominance",
          ],
        },
      },
      // Plot 5 — The Happy Ending
      {
        name: "Dragon",
        traits: {
          physiology: [
            "Defeated and grounded",
            "Fire extinguished",
          ],
          psychology: [
            "Humbled by defeat",
            "Beginning to understand respect",
            "No longer driven by rage",
          ],
          sociology: [
            "No longer a threat to the kingdom",
            "A reminder that courage conquers fear",
          ],
        },
      },
    ],
  },
];
