import { EditorView } from "@codemirror/view";

// Whether an input method is composing text in `view` (or about to). Key bindings, input handlers
// and suggestion sources stand down then, so the composition is never interrupted.
export const isComposing = (view?: EditorView) => Boolean(view && (view.composing || view.compositionStarted));
