import React from "react";

export function Leaf(props: any) {
  const classes: string[] = [];
  if (props.leaf.added) classes.push("suggest-addition");
  if (props.leaf.removed) classes.push("suggest-deletion");
  if (props.leaf.highlight) classes.push("highlight");
  if (props.leaf.conflictHighlight) classes.push("conflict-highlight");

  // Indicator highlights (different colors for each type)
  if (props.leaf.directDefinition) classes.push("indicator-direct");
  if (props.leaf.actions) classes.push("indicator-actions");
  if (props.leaf.speech) classes.push("indicator-speech");
  if (props.leaf.appearance) classes.push("indicator-appearance");
  if (props.leaf.environment) classes.push("indicator-environment");

  return (
    <span {...props.attributes} className={classes.join(" ")}>
      {props.children}
    </span>
  );
}
