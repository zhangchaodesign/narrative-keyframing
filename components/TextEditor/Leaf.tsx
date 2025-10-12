import React from "react";

export function Leaf(props: any) {
  const classes: string[] = [];
  if (props.leaf.added) classes.push("suggest-addition");
  if (props.leaf.removed) classes.push("suggest-deletion");
  if (props.leaf.highlight) classes.push("highlight");
  return (
    <span {...props.attributes} className={classes.join(" ")}>
      {props.children}
    </span>
  );
}
