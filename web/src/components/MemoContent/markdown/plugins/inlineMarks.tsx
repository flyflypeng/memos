import type { Parent, PhrasingContent, Root, RootContent, Text } from "mdast";
import type { ReactNode } from "react";
import { EXIT, visit } from "unist-util-visit";
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
// marks pair within the text, never across lines, with non-empty raw content. A mark's content is
// plain text: gomark finds no tags inside marks.
const splitInlineMarks = (value: string): PhrasingContent[] => {
  const out: PhrasingContent[] = [];
  let text = "";
  let i = 0;
  const flush = () => {
    if (text) out.push({ type: "text", value: text });
    text = "";
  };
  scan: while (i < value.length) {
    for (const { open, name } of MARKS) {
      if (!value.startsWith(open, i)) continue;
      const close = value.indexOf(open, i + open.length);
      const content = close < 0 ? "" : value.slice(i + open.length, close);
      if (!content || content.includes("\n")) continue;
      flush();
      out.push(memosElement(name, {}, { children: [{ type: "text", value: content }] }));
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

// Nodes whose text never holds tags. gomark parses bold, italic and strikethrough content as plain
// text (bold allows only links), so `**a #b**` has no tag on the server either.
const SKIP: Record<string, true> = {
  link: true,
  linkReference: true,
  inlineCode: true,
  code: true,
  math: true,
  inlineMath: true,
  memosElement: true,
  strong: true,
  emphasis: true,
  delete: true,
};

const hasHash = (node: RootContent) => {
  let found = false;
  visit(node, "text", (text) => {
    if (!text.value.includes("#")) return;
    found = true;
    return EXIT;
  });
  return found;
};

// gomark has no underscore emphasis: `_x_` and `__x__` are plain text there, so a tag runs into the
// closing underscores (`_i #j_` is the tag `j_`). Underscore emphasis holding a `#` is turned back
// into its text, so its tags are the server's; other underscore emphasis still renders.
const isUnderscoreEmphasisWithHash = (node: RootContent, source: string) =>
  (node.type === "strong" || node.type === "emphasis") && source[node.position?.start.offset ?? -1] === "_" && hasHash(node);

const unwrapUnderscoreEmphasis = (node: Parent, source: string) => {
  if (!node.children.some((child) => isUnderscoreEmphasisWithHash(child, source))) return;
  const children: RootContent[] = [];
  const append = (child: RootContent) => {
    const last = children[children.length - 1];
    if (child.type === "text" && last?.type === "text") children[children.length - 1] = { type: "text", value: last.value + child.value };
    else children.push(child);
  };
  for (const child of node.children) {
    if (!isUnderscoreEmphasisWithHash(child, source)) {
      append(child);
      continue;
    }
    const marker = child.type === "strong" ? "__" : "_";
    unwrapUnderscoreEmphasis(child as Parent, source);
    [{ type: "text", value: marker } as Text, ...(child as Parent).children, { type: "text", value: marker } as Text].forEach(append);
  }
  node.children = children as typeof node.children;
};

const transform = (node: Parent, source: string) => {
  unwrapUnderscoreEmphasis(node, source);
  for (let index = node.children.length - 1; index >= 0; index--) {
    const child = node.children[index];
    if (child.type === "text") {
      const parts = splitInlineMarks((child as Text).value);
      if (parts.length !== 1 || parts[0].type !== "text") node.children.splice(index, 1, ...(parts as typeof node.children));
    } else if (!SKIP[child.type] && "children" in child) {
      transform(child as Parent, source);
    }
  }
};

// The source decides an emphasis's delimiter, which mdast does not record.
const remarkInlineMarks = () => (tree: Root, file: { value: unknown }) => transform(tree, String(file.value ?? ""));

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
