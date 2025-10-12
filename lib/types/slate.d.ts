import type { BaseEditor, Descendant } from "slate";
import type { ReactEditor } from "slate-react";

type CustomElement = { type: "paragraph"; children: CustomText[] };
type CustomText = {
  text: string;
  highlight?: boolean;
  conflictHighlight?: boolean;
  directDefinition?: boolean;
  actions?: boolean;
  speech?: boolean;
  appearance?: boolean;
  environment?: boolean;
  added?: boolean;
  removed?: boolean;
};

declare module "slate" {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}
