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
 * cursor between them. The inner text stays selected.
 */
export const toggleWrap =
  (delimiter: string): StateCommand =>
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

    dispatch(
      state.update({
        changes: { from, to, insert: delimiter + selected + delimiter },
        selection: EditorSelection.range(from + len, to + len),
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
