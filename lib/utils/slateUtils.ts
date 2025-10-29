import {
  Node,
  Point,
  Selection,
  Node as SlateNode,
  Element,
  Descendant,
} from "slate";

type CustomElement = Element;

export type SlateTextSegment = {
  text: string;
  added?: boolean;
  removed?: boolean;
};

export class SlateUtils {
  /**
   * Converts an index position in a string to a Slate Point
   * @param node
   * @param strIndex
   * @param startStrIndex
   * @returns
   */
  static toSlatePoint(
    node: any,
    strIndex: number,
    startStrIndex = 0,
    isLast = false,
  ): Point | null {
    if (node.text !== undefined) {
      if (
        !node.removed &&
        !node.added &&
        ((isLast && startStrIndex + node.text.length >= strIndex) ||
          startStrIndex + node.text.length > strIndex)
      ) {
        return { path: [], offset: strIndex - startStrIndex };
      }
      return null;
    } else if (node.children !== undefined) {
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        const point = SlateUtils.toSlatePoint(
          child,
          strIndex,
          startStrIndex,
          i === node.children.length - 1,
        );
        if (point) {
          return { path: [i, ...point.path], offset: point.offset };
        }
        if (child.removed === undefined && child.added === undefined)
          startStrIndex += Node.string(child).length;
      }
    } else if (Array.isArray(node)) {
      return SlateUtils.toSlatePoint(
        { children: node },
        strIndex,
        startStrIndex,
      );
    }

    return null;
  }

  /**
   * Converts a Slate Point to an index position in a string
   * @param node
   * @param point
   * @param startStrIndex
   * @returns
   */
  static toStrIndex(state: Node[], point: Point): number {
    const texts = Node.texts({ children: state } as any, {
      from: [0, 0],
      to: point.path,
    });
    let strIndex = 0;

    for (const [node, path] of texts) {
      if ((node as any).removed) continue;

      if (path + "" === point.path + "") {
        return strIndex + point.offset;
      }
      strIndex += Node.string(node).length;
    }

    return strIndex;
  }

  /**
   * Checks if a point is valid for a given Slate state
   * @param point
   * @param state
   * @returns
   */
  static isPointValidForState(point: Point, state: Node[]): boolean {
    let element = { children: state } as any;

    for (const elementId of point.path) {
      if (elementId >= element.children.length) {
        return false;
      }
      element = element.children[elementId];
    }

    return point.offset <= Node.string(element).length;
  }

  static isSelectionValidForState(
    selection: Selection,
    state: Node[],
  ): boolean {
    return (
      SlateUtils.isPointValidForState(selection!.anchor, state) &&
      SlateUtils.isPointValidForState(selection!.focus, state)
    );
  }

  static stateToText(state: Node[]): string {
    return state
      .map((node: any) =>
        SlateNode.string({
          type: "paragraph",
          children: node.children.filter(
            (c: any) =>
              c.removed === undefined &&
              c.added === undefined &&
              c.insertions === undefined,
          ),
        } as CustomElement),
      )
      .join("\n");
  }

  static segmentsToSlateState(segments: SlateTextSegment[]): Descendant[] {
    const paragraphs: Descendant[] = [];
    let currentChildren: any[] = [];

    const pushParagraph = () => {
      paragraphs.push({
        type: "paragraph",
        children: currentChildren.length > 0 ? currentChildren : [{ text: "" }],
      } as CustomElement);
      currentChildren = [];
    };

    if (segments.length === 0) {
      return [
        {
          type: "paragraph",
          children: [{ text: "" }],
        } as CustomElement,
      ];
    }

    for (const segment of segments) {
      const lines = segment.text.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const leaf: Record<string, any> = { text: lines[i] };
        if (segment.added) leaf.added = true;
        if (segment.removed) leaf.removed = true;
        currentChildren.push(leaf);

        if (i < lines.length - 1) {
          pushParagraph();
        }
      }
    }

    pushParagraph();

    return paragraphs;
  }

  static textToSlateState(text: string): Descendant[] {
    return SlateUtils.segmentsToSlateState([{ text }]);
  }
}
