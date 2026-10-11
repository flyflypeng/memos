import { createContext } from "react";

interface Context {
  // The Memo content being rendered (the raw markdown).
  content: string;
  // embeddedMemos is a set of memo resource names that are embedded in the current memo.
  // This is used to prevent infinite loops when a memo embeds itself.
  embeddedMemos: Set<string>;
  memoName?: string;
  readonly?: boolean;
  disableFilter?: boolean;
  parentPage?: string;
}

export const RendererContext = createContext<Context>({
  content: "",
  embeddedMemos: new Set(),
});
