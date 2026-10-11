// Slash menu: typing `/` at line start or after whitespace opens a menu of blocks to insert.
// React-free; labels are injected so the menu follows the UI language.
import { CompletionResult, CompletionSource, startCompletion } from "@codemirror/autocomplete";
import { isolateHistory } from "@codemirror/commands";
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import { EditorSelection, EditorState, TransactionSpec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tableSkeleton } from "./commands";

const CODE_NODES: Record<string, true> = { InlineCode: true, FencedCode: true, CodeBlock: true };

export interface SlashTrigger {
  /** Position of the `/`. */
  from: number;
  /** Cursor position (end of the query). */
  to: number;
  /** Text typed after the `/`. */
  query: string;
}

const inCode = (state: EditorState, pos: number) => {
  const tree = ensureSyntaxTree(state, pos, 50) ?? syntaxTree(state);
  let node = tree.resolveInner(pos, -1);
  for (;;) {
    if (CODE_NODES[node.name]) return true;
    if (!node.parent) return false;
    node = node.parent;
  }
};

/**
 * Finds the `/query` the cursor is typing. The `/` must start the line or follow whitespace, and
 * the query may contain neither whitespace nor another `/`, so URLs, fractions (`1/2`) and paths
 * (`src/a`, `/usr/bin`) never match. Code spans and code blocks are ignored.
 */
export const slashTriggerAt = (state: EditorState, pos: number): SlashTrigger | null => {
  const line = state.doc.lineAt(pos);
  const word = /\S*$/.exec(line.text.slice(0, pos - line.from))![0];
  if (!word.startsWith("/") || word.indexOf("/", 1) >= 0) return null;
  if (inCode(state, pos)) return null;
  return { from: pos - word.length, to: pos, query: word.slice(1) };
};

type BlockShape =
  /** Line prefix; the rest of the line becomes the heading / item text. */
  | { kind: "prefix"; prefix: string }
  /** Fenced block with the cursor on the empty line inside. */
  | { kind: "fence"; open: string; close: string }
  | { kind: "table" }
  | { kind: "divider" };

const BLOCKS = {
  "heading-1": { kind: "prefix", prefix: "# " },
  "heading-2": { kind: "prefix", prefix: "## " },
  "heading-3": { kind: "prefix", prefix: "### " },
  "bullet-list": { kind: "prefix", prefix: "- " },
  "ordered-list": { kind: "prefix", prefix: "1. " },
  "task-list": { kind: "prefix", prefix: "- [ ] " },
  quote: { kind: "prefix", prefix: "> " },
  "code-block": { kind: "fence", open: "```", close: "```" },
  table: { kind: "table" },
  "math-block": { kind: "fence", open: "$$", close: "$$" },
  mermaid: { kind: "fence", open: "```mermaid", close: "```" },
  divider: { kind: "divider" },
} satisfies Record<string, BlockShape>;

export type SlashBlockId = keyof typeof BLOCKS;

const SLASH_TABLE_SIZE = 3;
const LIST_BLOCKS: Partial<Record<SlashBlockId, true>> = { "bullet-list": true, "ordered-list": true, "task-list": true };
// Quote markers, indentation, then an optional list marker (with task checkbox).
const CONTAINER_REGEX = /^((?:\s*>\s?)*)(\s*)(?:([-*+]|\d+[.)])( +)(\[[ xX]\] +)?)?/;

/**
 * Replaces the `/query` at `from`–`to` with block `id` as a single undoable change.
 * - Typed right after a list marker or `>`, the block goes into that item / quote; a list block
 *   switches the marker instead of nesting a new list.
 * - Typed after text, the text stays and the block starts on a new line inside the same container.
 * - Prefix blocks (headings, lists, quote) take the rest of the line as their text.
 * - Tables and dividers get a blank line after a preceding paragraph (`text\n---` would be a setext
 *   heading); a table also gets one before following text, which would otherwise become a row.
 */
export const applySlashBlock = (state: EditorState, from: number, to: number, id: SlashBlockId): TransactionSpec => {
  const shape: BlockShape = BLOCKS[id];
  const line = state.doc.lineAt(from);
  const [prefix, quote, indent, marker = "", markerGap = ""] = CONTAINER_REGEX.exec(line.text)!;
  // Prefix for the block's following lines: same quote, aligned with the item content.
  const cont = quote + indent + " ".repeat(marker.length + markerGap.length);
  const nl = "\n" + cont;
  const blankLine = "\n" + cont.trimEnd();
  const before = line.text.slice(prefix.length, from - line.from).trimEnd();
  const rest = line.text.slice(to - line.from).trimStart();
  const hasText = (text: string) => text.replace(/^(\s*>)*/, "").trim() !== "";
  const prevLineHasText = line.number > 1 && hasText(state.doc.line(line.number - 1).text);
  const nextLineHasText = line.number < state.doc.lines && hasText(state.doc.line(line.number + 1).text);

  const needsBlankBefore = (shape.kind === "table" || shape.kind === "divider") && (before !== "" || (!marker && prevLineHasText));
  let start: number;
  let lead: string;
  if (before) {
    start = line.from + prefix.length + before.length;
    lead = (needsBlankBefore ? blankLine : "") + nl;
  } else if (needsBlankBefore) {
    // The block stays on this line; the blank line goes in front of its container prefix.
    start = line.from;
    lead = cont.trimEnd() + "\n" + prefix;
  } else if (marker && LIST_BLOCKS[id]) {
    start = line.from + quote.length + indent.length;
    lead = "";
  } else {
    start = line.from + prefix.length;
    lead = "";
  }

  let body: string;
  let cursor: number;
  let tail: string;
  switch (shape.kind) {
    case "prefix":
      body = shape.prefix;
      cursor = body.length;
      tail = rest;
      break;
    case "fence":
      body = shape.open + nl + nl + shape.close;
      cursor = shape.open.length + nl.length;
      tail = rest ? nl + rest : "";
      break;
    case "table": {
      const skeleton = tableSkeleton(SLASH_TABLE_SIZE, SLASH_TABLE_SIZE);
      body = skeleton.text.split("\n").join(nl);
      cursor = skeleton.cursor;
      tail = rest ? blankLine + nl + rest : nextLineHasText ? blankLine : "";
      break;
    }
    case "divider":
      body = "---" + nl;
      cursor = body.length;
      tail = rest;
      break;
  }

  return {
    changes: { from: start, to: line.to, insert: lead + body + tail },
    selection: EditorSelection.cursor(start + lead.length + cursor),
    scrollIntoView: true,
    userEvent: "input.complete",
    // One undo step: the typed `/query` comes back, and text typed into the block is undone separately.
    annotations: isolateHistory.of("full"),
  };
};

/** Replaces the `/query` with `@`, which opens the `@` Memo suggestions. */
export const embedMemoSpec = (from: number, to: number): TransactionSpec => ({
  changes: { from, to, insert: "@" },
  selection: EditorSelection.cursor(from + 1),
  userEvent: "input.complete",
});

export interface SlashMenuItem {
  id: string;
  /** Localized label; the filter matches anywhere in it. */
  label: string;
  /** Hint shown next to the label, e.g. the Markdown the item inserts. */
  detail?: string;
  /** Locale-independent words the filter matches by prefix (`h1`, `todo`, …). */
  keywords: string[];
  /**
   * Runs when the item is picked. `from`–`to` is the typed `/query`, which the item replaces.
   * May start asynchronous work (file picker, upload) after its synchronous dispatch.
   */
  run: (view: EditorView, from: number, to: number) => void;
}

const BLOCK_MENU: { id: SlashBlockId; detail: string; keywords: string[] }[] = [
  { id: "heading-1", detail: "#", keywords: ["h1", "heading", "title", "#"] },
  { id: "heading-2", detail: "##", keywords: ["h2", "heading", "subtitle", "##"] },
  { id: "heading-3", detail: "###", keywords: ["h3", "heading", "###"] },
  { id: "bullet-list", detail: "-", keywords: ["ul", "bullet", "list", "unordered", "-"] },
  { id: "ordered-list", detail: "1.", keywords: ["ol", "ordered", "numbered", "list", "1."] },
  { id: "task-list", detail: "- [ ]", keywords: ["todo", "task", "checkbox", "list", "[]"] },
  { id: "quote", detail: ">", keywords: ["quote", "blockquote", ">"] },
  { id: "code-block", detail: "```", keywords: ["code", "codeblock", "```"] },
  { id: "table", detail: "| |", keywords: ["table", "grid", "|"] },
  { id: "math-block", detail: "$$", keywords: ["math", "formula", "latex", "katex", "equation", "$$"] },
  { id: "mermaid", detail: "mermaid", keywords: ["mermaid", "diagram", "chart", "graph", "flowchart"] },
  { id: "divider", detail: "---", keywords: ["divider", "hr", "line", "separator", "---"] },
];

/** Menu items for every Markdown block, labeled by `label(id)`. */
export const slashBlockItems = (label: (id: SlashBlockId) => string): SlashMenuItem[] =>
  BLOCK_MENU.map(({ id, detail, keywords }) => ({
    id,
    label: label(id),
    detail,
    keywords,
    run: (view, from, to) => view.dispatch(applySlashBlock(view.state, from, to, id)),
  }));

/** "Embed memo": types `@` and opens the existing `@` Memo search. */
export const embedMemoItem = (label: string): SlashMenuItem => ({
  id: "embed-memo",
  label,
  detail: "@",
  keywords: ["embed", "memo", "reference", "@"],
  run: (view, from, to) => {
    view.dispatch(embedMemoSpec(from, to));
    startCompletion(view);
  },
});

/**
 * Items matching `query` (case-insensitive): anywhere in the label or at the start of a keyword.
 * Items whose label or a keyword starts with the query come first; menu order is kept otherwise.
 */
export const filterSlashItems = (items: SlashMenuItem[], query: string): SlashMenuItem[] => {
  const q = query.toLowerCase();
  if (!q) return items;
  const ranked: { item: SlashMenuItem; rank: number }[] = [];
  for (const item of items) {
    const label = item.label.toLowerCase();
    const keywordHit = item.keywords.some((keyword) => keyword.startsWith(q));
    if (!keywordHit && !label.includes(q)) continue;
    ranked.push({ item, rank: keywordHit || label.startsWith(q) ? 0 : 1 });
  }
  return ranked.sort((a, b) => a.rank - b.rank).map(({ item }) => item);
};

/** Slash menu over `getItems()` (read on every keystroke so labels follow the UI language). */
export const slashCompletionSource =
  (getItems: () => SlashMenuItem[]): CompletionSource =>
  (context): CompletionResult | null => {
    if (context.view?.composing || context.view?.compositionStarted) return null;
    const trigger = slashTriggerAt(context.state, context.pos);
    if (!trigger) return null;
    const items = filterSlashItems(getItems(), trigger.query);
    if (items.length === 0) return null;
    return {
      from: trigger.from,
      to: trigger.to,
      filter: false,
      options: items.map((item) => ({
        label: item.label,
        detail: item.detail,
        type: "slash",
        apply: (view, _completion, from, to) => item.run(view, from, to),
      })),
    };
  };
