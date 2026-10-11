import type { Element, Root as HastRoot } from "hast";
import { toJsxRuntime, type Components } from "hast-util-to-jsx-runtime";
import type { ListItem, Root as MdastRoot } from "mdast";
import type { CompileContext, Token } from "mdast-util-from-markdown";
import type { ReactNode } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from "rehype-sanitize";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified, type Processor } from "unified";
import { MEMOS_ELEMENT_TAG, standardComponents } from "./elements";
import type { MemosElement } from "./plugin";
import { memoMarkdownPlugins } from "./registry";

// Records on each task list item the source offset of its `[ ]`/`[x]` marker, so a checkbox can
// later rewrite exactly that marker in the Memo content.
function remarkTaskMarkerOffset(this: Processor) {
  const data = this.data();
  (data.fromMarkdownExtensions ??= []).push({
    exit: {
      taskListCheck(this: CompileContext, token: Token) {
        const listItem = this.stack[this.stack.length - 2] as ListItem;
        listItem.data = {
          ...listItem.data,
          hProperties: {
            taskMarkerOffset: token.start.offset,
            ...(listItem.checked ? { className: ["task-list-item", "task-list-item-checked"] } : {}),
          },
        };
      },
    },
  });
}

// GitHub-style allowlist, narrowed to http/https/mailto/relative links. Memos elements and task
// offsets are allowed only as camelCase properties, which raw HTML cannot produce (the HTML parser
// lowercases attribute names), so hand-written `<memos-element>` tags render as plain children.
const sanitizeSchema: SanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "mark", MEMOS_ELEMENT_TAG],
  attributes: {
    ...defaultSchema.attributes,
    li: [["className", "task-list-item", "task-list-item-checked"], "taskMarkerOffset"],
    [MEMOS_ELEMENT_TAG]: ["memosName", "memosProps"],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto"],
    // Images keep accepting data: URLs, as the previous renderer did.
    src: ["http", "https", "data"],
  },
};

// The remark stage (Markdown → mdast with Memos syntax) is shared with code that inspects Memo
// content without rendering it, such as resource-reference extraction.
const markdownProcessor = unified()
  .use(remarkParse)
  // Single tildes are Memos subscript (`~sub~`), not strikethrough.
  .use(remarkGfm, { singleTilde: false })
  .use(remarkMath)
  // A newline inside a paragraph is a line break, as in the previous renderer.
  .use(remarkBreaks)
  .use(remarkTaskMarkerOffset)
  .use(memoMarkdownPlugins.flatMap((plugin) => plugin.remarkPlugins ?? []));

// parseMemoMarkdown parses Memo content into the mdast tree the renderer works from.
// The plugin list is a `PluggableList`, which erases the tree type; remark transforms keep a Root.
export const parseMemoMarkdown = (content: string) => markdownProcessor.runSync(markdownProcessor.parse(content)) as MdastRoot;

const htmlProcessor = unified()
  .use(remarkRehype, {
    allowDangerousHtml: true,
    handlers: {
      memosElement: (state, node: MemosElement) => {
        const result: Element = {
          type: "element",
          tagName: MEMOS_ELEMENT_TAG,
          properties: { memosName: node.name, memosProps: JSON.stringify(node.props) },
          children: state.all(node),
        };
        state.patch(node, result);
        return state.applyData(node, result);
      },
    },
  })
  .use(rehypeRaw)
  .use(rehypeSanitize, sanitizeSchema);

// Custom tag names are not JSX intrinsic elements, so the map cannot satisfy `Components` statically.
const components = standardComponents as unknown as Partial<Components>;

// renderMemoMarkdown renders Memo content (the raw markdown text) to React elements.
export const renderMemoMarkdown = (content: string): ReactNode => {
  const tree: HastRoot = htmlProcessor.runSync(parseMemoMarkdown(content));
  return toJsxRuntime(tree, { Fragment, jsx, jsxs, components, passNode: true });
};
