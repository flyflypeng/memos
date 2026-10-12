import { EditorSelection, EditorState, Extension } from "@codemirror/state";
import { memoMarkdown } from "@/components/MemoEditor/Editor/extensions";

// Editor states written as text with the selection marked in it: a cursor mark (`|` by default; table
// tests use `^`, as their text holds pipes) or a `<…>` range.
interface Options {
  cursor?: string;
  extensions?: Extension;
}

// createEditorState builds a headless state with the editor's Markdown language.
export const createEditorState = (marked: string, { cursor = "|", extensions = memoMarkdown() }: Options = {}) => {
  const at = marked.indexOf(cursor);
  const doc = at >= 0 ? marked.replace(cursor, "") : marked.replace("<", "").replace(">", "");
  const selection = at >= 0 ? EditorSelection.single(at) : EditorSelection.single(marked.indexOf("<"), marked.indexOf(">") - 1);
  return EditorState.create({ doc, selection, extensions });
};

// showEditorState writes a state back in the notation `createEditorState` reads.
export const showEditorState = (state: EditorState, { cursor = "|" }: Pick<Options, "cursor"> = {}) => {
  const { from, to } = state.selection.main;
  const doc = state.doc.toString();
  return from === to ? doc.slice(0, from) + cursor + doc.slice(from) : doc.slice(0, from) + "<" + doc.slice(from, to) + ">" + doc.slice(to);
};
