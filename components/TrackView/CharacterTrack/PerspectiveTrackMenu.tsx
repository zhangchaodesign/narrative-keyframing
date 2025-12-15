"use client";

import { PerspectiveActionsMenu } from "@/components/shared/PerspectiveActionsMenu";

type PerspectiveTrackMenuProps = {
  characterName: string;
  perspectiveItems: Array<{ id: string; nodeId: string }>;
};

export function PerspectiveTrackMenu({
  characterName,
  perspectiveItems,
}: PerspectiveTrackMenuProps) {
  const targetNodeIds = perspectiveItems.map((item) => item.nodeId);

  if (targetNodeIds.length === 0) {
    return null;
  }

  return (
    <PerspectiveActionsMenu
      targetNodeIds={targetNodeIds}
      label={`all ${characterName} perspectives`}
    />
  );
}
