// Pure CodeMirror editor commands. No React, no DOM: each command takes `{ state, dispatch }`
// and can be exercised against a headless `EditorState` (S2 test seam).
import { insertNewlineContinueMarkupCommand } from "@codemirror/lang-markdown";
import { EditorSelection, EditorState, StateCommand, TransactionSpec } from "@codemirror/state";
import { TAB_SPACE_WIDTH } from "@/helpers/consts";
import { isValidUrl } from "@/helpers/utils";

const LINK_PLACEHOLDER_URL = "url";
const URL_REGEX = /^(https?:\/\/[^\s]+)$/;

/**
 * Replaces the main selection with `prefix + (text || selected) + suffix`.
 * The cursor ends after `prefix + text` (inside the suffix when wrapping).
 * Mirrors the legacy textarea `insertText` semantics.
 */
export const insertTextSpec = (state: EditorState, text = "", prefix = "", suffix = ""): TransactionSpec => {
  const { from, to } = state.selection.main;
  const body = text || state.sliceDoc(from, to);
  const insert = prefix + body + suffix;
  return {
    changes: { from, to, insert },
    selection: EditorSelection.cursor(from + prefix.length + body.length),
    scrollIntoView: true,
    userEvent: "input",
  };
};

/**
 * Wraps the selection with `delimiter`, or removes it when the selection (or the text right
 * around it) is already wrapped. With an empty selection, inserts a delimiter pair and puts the
 * cursor between them, or `placeholder` selected between them. The inner text stays selected.
 */
export const toggleWrap =
  (delimiter: string, placeholder = ""): StateCommand =>
  ({ state, dispatch }) => {
    const len = delimiter.length;
    const { from, to } = state.selection.main;
    const selected = state.sliceDoc(from, to);

    // Selection includes the delimiters: unwrap inside.
    if (selected.length >= len * 2 && selected.startsWith(delimiter) && selected.endsWith(delimiter)) {
      const inner = selected.slice(len, -len);
      dispatch(
        state.update({
          changes: { from, to, insert: inner },
          selection: EditorSelection.range(from, from + inner.length),
          userEvent: "input",
        }),
      );
      return true;
    }

    // Delimiters sit right outside the selection: unwrap outside.
    const before = state.sliceDoc(from - len, from);
    const after = state.sliceDoc(to, to + len);
    if (from >= len && before === delimiter && after === delimiter && !isPartOfLongerRun(state, from - len, to + len, delimiter)) {
      dispatch(
        state.update({
          changes: [
            { from: from - len, to: from },
            { from: to, to: to + len },
          ],
          selection: EditorSelection.range(from - len, to - len),
          userEvent: "input",
        }),
      );
      return true;
    }

    const inner = selected || placeholder;
    dispatch(
      state.update({
        changes: { from, to, insert: delimiter + inner + delimiter },
        selection: EditorSelection.range(from + len, from + len + inner.length),
        userEvent: "input",
      }),
    );
    return true;
  };

// `*x*` selected as `x` inside `**x**` belongs to the bold run, so it must not be unwrapped as italic.
const isPartOfLongerRun = (state: EditorState, outerFrom: number, outerTo: number, delimiter: string) => {
  const ch = delimiter[0];
  if (!delimiter.split("").every((c) => c === ch)) return false;
  return state.sliceDoc(outerFrom - 1, outerFrom) === ch && state.sliceDoc(outerTo, outerTo + 1) === ch;
};

/**
 * Turns the selection into a Markdown link. With `url` given, inserts `[selection](url)`.
 * Without it: a selected URL becomes `[](url)` with the cursor inside the brackets; otherwise
 * inserts `[selection](url)` and selects the `url` placeholder.
 */
export const insertLink =
  (url?: string): StateCommand =>
  ({ state, dispatch }) => {
    const { from, to } = state.selection.main;
    const selected = state.sliceDoc(from, to);

    if (!url && URL_REGEX.test(selected.trim())) {
      dispatch(
        state.update({
          changes: { from, to, insert: `[](${selected})` },
          selection: EditorSelection.cursor(from + 1),
          userEvent: "input",
        }),
      );
      return true;
    }

    const target = url ?? LINK_PLACEHOLDER_URL;
    const insert = `[${selected}](${target})`;
    const urlStart = from + selected.length + 3;
    dispatch(
      state.update({
        changes: { from, to, insert },
        selection: url ? EditorSelection.cursor(from + insert.length) : EditorSelection.range(urlStart, urlStart + target.length),
        userEvent: "input",
      }),
    );
    return true;
  };

/** Pasting a URL over a non-empty selection turns the selection into `[selection](url)`. */
export const pasteUrlOverSelection =
  (text: string): StateCommand =>
  (target) => {
    if (target.state.selection.main.empty || !isValidUrl(text)) return false;
    return insertLink(text)(target);
  };

/** Replaces the selection with `TAB_SPACE_WIDTH` spaces. */
export const insertTabSpaces: StateCommand = ({ state, dispatch }) => {
  dispatch(state.update(state.replaceSelection(" ".repeat(TAB_SPACE_WIDTH)), { scrollIntoView: true, userEvent: "input" }));
  return true;
};

/**
 * Enter inside a list, task list or blockquote: continues the markup on the next line
 * (`- [x] a` → `- [ ] `, `1.` → `2.`). On an empty item it removes the marker instead.
 * Returns false outside of Markdown markup so the plain newline binding runs.
 */
export const continueMarkup: StateCommand = insertNewlineContinueMarkupCommand({ nonTightLists: false });

export interface TableSkeleton {
  text: string;
  /** Offset in `text` of the first header cell, where the cursor goes. */
  cursor: number;
}

/**
 * A GFM table skeleton with `rows` rows including the header row, and `cols` columns. Empty cells
 * are padded to the width of the `---` delimiter so the columns line up.
 */
export const tableSkeleton = (rows: number, cols: number): TableSkeleton => {
  const row = (cell: string) => `|${` ${cell} |`.repeat(cols)}`;
  const empty = row("   ");
  const lines = [empty, row("---"), ...Array.from({ length: Math.max(rows - 1, 0) }, () => empty)];
  return { text: lines.join("\n"), cursor: 2 };
};

export type LinePrefixKind = "heading" | "quote" | "bullet" | "ordered" | "task";

const INDENT = /^\s*/;
// Any block marker that a line-prefix toggle replaces: quote, heading, bullet/ordered list, task box.
const ANY_LIST_MARKER = /^(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/;
const LINE_PREFIX: Record<LinePrefixKind, { active: RegExp; replaces: RegExp; marker: (index: number) => string; indent: boolean }> = {
  heading: { active: /^##\s+/, replaces: /^#{1,6}\s+/, marker: () => "## ", indent: false },
  quote: { active: />\s?/y, replaces: />\s?/y, marker: () => "> ", indent: false },
  bullet: { active: /^[-*+]\s+(?!\[[ xX]\])/, replaces: ANY_LIST_MARKER, marker: () => "- ", indent: true },
  ordered: { active: /^\d+[.)]\s+/, replaces: ANY_LIST_MARKER, marker: (i) => `${i + 1}. `, indent: true },
  task: { active: /^[-*+]\s+\[[ xX]\]\s+/, replaces: ANY_LIST_MARKER, marker: () => "- [ ] ", indent: true },
};

/**
 * Toggles a block prefix on every non-blank line touched by the selection (all blank lines count
 * when nothing else is selected). When every line already has it, the prefix is removed; otherwise
 * it is added, replacing another marker of the same family (`- x` → `1. x`, `# t` → `## t`).
 */
export const toggleLinePrefix =
  (kind: LinePrefixKind): StateCommand =>
  ({ state, dispatch }) => {
    const spec = LINE_PREFIX[kind];
    const { from, to } = state.selection.main;
    const first = state.doc.lineAt(from).number;
    const last = state.doc.lineAt(to).number;
    let lines = Array.from({ length: last - first + 1 }, (_, i) => state.doc.line(first + i));
    if (lines.some((line) => line.text.trim())) lines = lines.filter((line) => line.text.trim());

    const parse = (text: string) => {
      const indent = spec.indent ? INDENT.exec(text)![0] : "";
      const rest = text.slice(indent.length);
      const match = (re: RegExp) => {
        re.lastIndex = 0;
        const m = re.exec(rest);
        return m && m.index === 0 ? m[0] : "";
      };
      return { indent, active: match(spec.active), replaced: match(spec.replaces) };
    };
    const parsed = lines.map((line) => parse(line.text));
    const remove = parsed.every((p) => p.active);
    const changes = lines.map((line, i) => {
      const { indent, active, replaced } = parsed[i];
      const start = line.from + indent.length;
      return remove ? { from: start, to: start + active.length } : { from: start, to: start + replaced.length, insert: spec.marker(i) };
    });
    const changeSet = state.changes(changes);
    const selection =
      from === to
        ? EditorSelection.cursor(changeSet.mapPos(from, 1))
        : EditorSelection.range(changeSet.mapPos(from, -1), changeSet.mapPos(to, 1));
    dispatch(state.update({ changes: changeSet, selection, scrollIntoView: true, userEvent: "input" }));
    return true;
  };

/** Wraps the selection (or an empty line for the cursor) in a fenced code block on its own lines. */
export const insertCodeBlock: StateCommand = ({ state, dispatch }) => {
  const { from, to } = state.selection.main;
  const before = from === state.doc.lineAt(from).from ? "" : "\n";
  const after = to === state.doc.lineAt(to).to ? "" : "\n";
  const open = `${before}\`\`\`\n`;
  const insert = `${open}${state.sliceDoc(from, to)}\n\`\`\`${after}`;
  const start = from + open.length;
  dispatch(
    state.update({
      changes: { from, to, insert },
      selection: EditorSelection.range(start, start + to - from),
      scrollIntoView: true,
      userEvent: "input",
    }),
  );
  return true;
};
