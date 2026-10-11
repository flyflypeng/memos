import type { RootContent } from "mdast";
import type { ComponentType } from "react";
import type { PluggableList } from "unified";
import type { Data, Node, Position } from "unist";

// A Memos markdown plugin teaches the Memo content renderer one piece of Memos-specific syntax.
// Each plugin is one file under `./plugins/` that default-exports a MemoMarkdownPlugin; files there
// are picked up automatically (in file-name order), so adding a plugin never edits a shared list.
export interface MemoMarkdownPlugin {
  // Remark plugins run after remark-gfm, remark-math and remark-breaks. They usually rewrite mdast
  // nodes into MemosElement nodes. A remark plugin may also register micromark syntax and
  // mdast-util-from-markdown extensions through `this.data()` and emit MemosElement nodes directly.
  remarkPlugins?: PluggableList;
  // Components for the MemosElement names this plugin emits. A component receives the element's
  // `props` spread as React props, plus the rendered mdast children as React children.
  // `never` lets each component declare its own props; they come from the plugin's own MemosElement.
  components?: Record<string, ComponentType<never>>;
}

// MemosElement is the single mdast node type for Memos-specific syntax. It renders as the component
// registered under `name`, so plugins never need their own mdast→hast handlers or sanitize rules.
export interface MemosElement extends Node {
  type: "memosElement";
  name: string;
  // JSON-serialisable props for the component.
  props: Record<string, unknown>;
  // Rendered and passed to the component as React children (may be empty).
  children: RootContent[];
  data?: Data;
}

declare module "mdast" {
  interface RootContentMap {
    memosElement: MemosElement;
  }
  interface BlockContentMap {
    memosElement: MemosElement;
  }
  interface PhrasingContentMap {
    memosElement: MemosElement;
  }
}

export const memosElement = (
  name: string,
  props: Record<string, unknown>,
  { children = [], position }: { children?: MemosElement["children"]; position?: Position } = {},
): MemosElement => ({ type: "memosElement", name, props, children, position });
