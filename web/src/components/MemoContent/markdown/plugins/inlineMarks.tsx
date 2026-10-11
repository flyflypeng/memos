import type { Parent, PhrasingContent, Root, Text } from "mdast";
import type { ReactNode } from "react";
import Highlight from "../../Highlight";
import Spoiler from "../../Spoiler";
import Subscript from "../../Subscript";
import Superscript from "../../Superscript";
import Tag from "../../Tag";
import { memosElement, type MemoMarkdownPlugin } from "../plugin";

// Mark delimiters in gomark's inline parser order (spoiler, highlight, subscript, superscript).
const MARKS: { open: string; name: string }[] = [
  { open: "||", name: "spoiler" },
  { open: "==", name: "highlight" },
  { open: "~", name: "subscript" },
  { open: "^", name: "superscript" },
];

// A tag ends at a space, a line break, another `#` or a backslash (gomark tag.go).
const TAG_END = /[ \n#\\]/;

// Splits one text value into text and MemosElement nodes following gomark's single-line rules:
// marks pair within the text, never across lines, with non-empty raw content; highlights may contain tags.
export const splitInlineMarks = (value: string, marks = MARKS): PhrasingContent[] => {
  const out: PhrasingContent[] = [];
  let text = "";
  let i = 0;
  const flush = () => {
    if (text) out.push({ type: "text", value: text });
    text = "";
  };
  scan: while (i < value.length) {
    for (const { open, name } of marks) {
      if (!value.startsWith(open, i)) continue;
      const close = value.indexOf(open, i + open.length);
      const content = close < 0 ? "" : value.slice(i + open.length, close);
      if (!content || content.includes("\n")) continue;
      flush();
      const children: PhrasingContent[] = name === "highlight" ? splitInlineMarks(content, []) : [{ type: "text", value: content }];
      out.push(memosElement(name, {}, { children }));
      i = close + open.length;
      continue scan;
    }
    if (value[i] === "#") {
      let end = i + 1;
      while (end < value.length && !TAG_END.test(value[end])) end++;
      if (end > i + 1) {
        flush();
        out.push(memosElement("tag", { content: value.slice(i + 1, end) }));
        i = end;
        continue;
      }
    }
    text += value[i++];
  }
  flush();
  return out;
};

const SKIP: Record<string, true> = {
  link: true,
  linkReference: true,
  inlineCode: true,
  code: true,
  math: true,
  inlineMath: true,
  memosElement: true,
};

const transform = (node: Parent) => {
  for (let index = node.children.length - 1; index >= 0; index--) {
    const child = node.children[index];
    if (child.type === "text") {
      const parts = splitInlineMarks((child as Text).value);
      if (parts.length !== 1 || parts[0].type !== "text") node.children.splice(index, 1, ...(parts as typeof node.children));
    } else if (!SKIP[child.type] && "children" in child) {
      transform(child as Parent);
    }
  }
};

const remarkInlineMarks = () => (tree: Root) => transform(tree);

export default {
  remarkPlugins: [remarkInlineMarks],
  components: {
    tag: ({ content }: { content: string }) => (
      <span data-memo-tag={content}>
        <Tag content={content} />
      </span>
    ),
    highlight: ({ children }: { children?: ReactNode }) => <Highlight content={children} />,
    spoiler: ({ children }: { children?: ReactNode }) => <Spoiler content={children} />,
    subscript: ({ children }: { children?: ReactNode }) => <Subscript content={children} />,
    superscript: ({ children }: { children?: ReactNode }) => <Superscript content={children} />,
  },
} satisfies MemoMarkdownPlugin;
