// CodeMirror completion sources for `#tag` and `@memo`. React-free; data is injected.
import { Completion, CompletionContext, CompletionResult, CompletionSource } from "@codemirror/autocomplete";
import Fuse from "fuse.js";
import { isComposing } from "./composition";

/**
 * Finds the whitespace-delimited word around the cursor when it starts with `trigger`.
 * Matches the legacy textarea rule: the whole word (including text after the cursor) is replaced,
 * and the trigger must start the word (so `a#b` or a URL fragment does not trigger).
 */
export const triggerWordAt = (context: CompletionContext, trigger: string): { from: number; to: number; query: string } | null => {
  const before = context.matchBefore(/\S+$/);
  if (!before || !before.text.startsWith(trigger)) return null;
  const line = context.state.doc.lineAt(context.pos);
  const after = /^\S*/.exec(line.text.slice(context.pos - line.from))?.[0] ?? "";
  // Legacy: typing the trigger right before another trigger char does not open suggestions.
  if (after.startsWith(trigger)) return null;
  return { from: before.from, to: context.pos + after.length, query: before.text.slice(trigger.length) + after };
};

/** Tag suggestions ranked by Fuse over `getTags()` (already sorted by usage). Inserts `#tag `. */
export const tagCompletionSource =
  (getTags: () => string[]): CompletionSource =>
  (context): CompletionResult | null => {
    if (isComposing(context.view)) return null;
    const word = triggerWordAt(context, "#");
    if (!word) return null;
    const options: Completion[] = new Fuse(getTags()).search(word.query.toLowerCase()).map(({ item }) => ({
      label: `#${item}`,
      apply: `#${item} `,
      type: "tag",
    }));
    if (options.length === 0) return null;
    return { from: word.from, to: word.to, options, filter: false };
  };

export interface MemoCompletionItem {
  uid: string;
  label: string;
  detail?: string;
}

export const MEMO_COMPLETION_DEBOUNCE_MS = 300;

/** Memo suggestions fetched (debounced) by `fetchMemos(query)`. Inserts `![[memos/<uid>]]`. */
export const memoCompletionSource =
  (fetchMemos: (query: string) => Promise<MemoCompletionItem[]>, debounceMs = MEMO_COMPLETION_DEBOUNCE_MS): CompletionSource =>
  async (context): Promise<CompletionResult | null> => {
    if (isComposing(context.view)) return null;
    const word = triggerWordAt(context, "@");
    if (!word) return null;
    if (debounceMs > 0) {
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, debounceMs);
      await promise;
      if (context.aborted) return null;
    }
    let memos: MemoCompletionItem[];
    try {
      memos = await fetchMemos(word.query);
    } catch {
      return null;
    }
    if (context.aborted || memos.length === 0) return null;
    return {
      from: word.from,
      to: word.to,
      filter: false,
      options: memos.map((memo, index) => ({
        label: memo.label,
        detail: memo.detail,
        apply: `![[memos/${memo.uid}]]`,
        type: "memo",
        boost: -index,
      })),
    };
  };
