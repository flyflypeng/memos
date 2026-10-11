// The single place where the Memo editor's CodeMirror extensions are assembled.
// See `/Users/minimax/.omp/work/memos-impl/06-notes.md` for where each kind of extension goes.
import { autocompletion, closeCompletion, completionKeymap, CompletionSource } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { deleteMarkupBackward, markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { indentUnit, syntaxHighlighting } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { Compartment, EditorState, Extension, Prec } from "@codemirror/state";
import { EditorView, KeyBinding, keymap, placeholder as placeholderExt } from "@codemirror/view";
import { classHighlighter } from "@lezer/highlight";
import { TAB_SPACE_WIDTH } from "@/helpers/consts";
import { continueMarkup, insertLink, insertTabSpaces, toggleWrap } from "./commands";
import { escapePipeSpec, formatTable, nextCell, previousCell, tableNewRow } from "./tableCommands";

export interface EditorExtensionOptions {
  placeholder: string;
  /** Read on every keystroke so the workspace setting can change without rebuilding the editor. */
  markdownShortcutsEnabled: () => boolean;
  /** `#tag`, `@memo` and later slash-menu sources. */
  completionSources: CompletionSource[];
  onDocChange: (content: string) => void;
  /** Return true when the event was handled (CodeMirror then skips its default). */
  onPaste: (event: ClipboardEvent, view: EditorView) => boolean;
  onDrop: (event: DragEvent, view: EditorView) => boolean;
}

/** Reconfigure with `placeholderCompartment.reconfigure(placeholder(text))` when the UI language changes. */
export const placeholderCompartment = new Compartment();

/** Keys owned elsewhere (container save/zen mode; Mod-i is italic, not CodeMirror's selectParentSyntax). */
const CONTAINER_KEYS: Record<string, true> = { "Mod-Enter": true, "Shift-Mod-Enter": true, "Mod-i": true };

/** Wraps a binding so it never runs while an IME composition is active. */
const imeSafe = (binding: KeyBinding): KeyBinding => ({
  ...binding,
  run: binding.run && ((view) => !view.composing && !view.compositionStarted && binding.run!(view)),
  shift: binding.shift && ((view) => !view.composing && !view.compositionStarted && binding.shift!(view)),
});

export const markdownShortcutKeymap = (enabled: () => boolean): KeyBinding[] =>
  [
    { key: "Mod-b", run: toggleWrap("**") },
    { key: "Mod-i", run: toggleWrap("*") },
    { key: "Mod-k", run: insertLink() },
  ].map(({ key, run }) => ({ key, preventDefault: true, run: (view) => enabled() && run(view) }));

export const createEditorExtensions = (options: EditorExtensionOptions): Extension[] => [
  history(),
  // addKeymap: false — Enter/Backspace are bound below so list behavior lives in `commands.ts`.
  markdown({ base: markdownLanguage, codeLanguages: languages, addKeymap: false }),
  syntaxHighlighting(classHighlighter),
  EditorView.lineWrapping,
  EditorState.tabSize.of(TAB_SPACE_WIDTH),
  indentUnit.of(" ".repeat(TAB_SPACE_WIDTH)),
  placeholderCompartment.of(placeholderExt(options.placeholder)),
  autocompletion({ override: options.completionSources, icons: false, defaultKeymap: false }),
  // Highest precedence: completion navigation, then Markdown/editor bindings, then defaults.
  Prec.highest(keymap.of(completionKeymap.map(imeSafe))),
  Prec.high(
    keymap.of(
      [
        ...markdownShortcutKeymap(options.markdownShortcutsEnabled),
        // Table bindings return false outside a GFM table, so the list / indent bindings after them run.
        { key: "Enter", run: tableNewRow },
        { key: "Tab", run: nextCell, shift: previousCell },
        { key: "Shift-Alt-f", run: formatTable, preventDefault: true },
        { key: "Enter", run: continueMarkup },
        { key: "Backspace", run: deleteMarkupBackward },
        { key: "Tab", run: insertTabSpaces, preventDefault: true },
        { key: "Escape", run: closeCompletion },
      ].map(imeSafe),
    ),
  ),
  EditorView.inputHandler.of((view, from, to, text) => {
    if (view.composing || view.compositionStarted) return false;
    const spec = escapePipeSpec(view.state, from, to, text);
    if (spec) view.dispatch(spec);
    return spec !== null;
  }),
  keymap.of([...defaultKeymap.filter((binding) => !CONTAINER_KEYS[binding.key ?? ""]), ...historyKeymap].map(imeSafe)),
  EditorView.updateListener.of((update) => {
    if (update.docChanged) options.onDocChange(update.state.doc.toString());
  }),
  EditorView.domEventHandlers({
    paste: (event, view) => options.onPaste(event, view),
    drop: (event, view) => options.onDrop(event, view),
  }),
];
