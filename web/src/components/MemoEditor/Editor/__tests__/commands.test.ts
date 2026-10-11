import { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorSelection, EditorState, StateCommand } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import {
  continueMarkup,
  insertCodeBlock,
  insertLink,
  insertTabSpaces,
  insertTextSpec,
  pasteUrlOverSelection,
  toggleLinePrefix,
  toggleWrap,
} from "../commands";
import { memoCompletionSource, tagCompletionSource } from "../completions";

// `|` marks the cursor; without it, `<` … `>` mark the selection.
const create = (marked: string) => {
  const cursor = marked.indexOf("|");
  const doc = cursor >= 0 ? marked.replace("|", "") : marked.replace("<", "").replace(">", "");
  const selection = cursor >= 0 ? EditorSelection.single(cursor) : EditorSelection.single(marked.indexOf("<"), marked.indexOf(">") - 1);
  return EditorState.create({ doc, selection, extensions: [markdown({ base: markdownLanguage })] });
};

const show = (state: EditorState) => {
  const { from, to } = state.selection.main;
  const doc = state.doc.toString();
  return from === to ? doc.slice(0, from) + "|" + doc.slice(from) : doc.slice(0, from) + "<" + doc.slice(from, to) + ">" + doc.slice(to);
};

const run = (command: StateCommand, marked: string) => {
  let state = create(marked);
  const handled = command({ state, dispatch: (tr) => (state = tr.state) });
  return { handled, result: show(state) };
};

describe("continueMarkup (list continuation)", () => {
  it.each([
    ["- item|", "- item\n- |"],
    ["* item|", "* item\n* |"],
    ["1. one|", "1. one\n2. |"],
    ["- [x] done|", "- [x] done\n- [ ] |"],
    ["- [ ] todo|", "- [ ] todo\n- [ ] |"],
    ["  - nested|", "  - nested\n  - |"],
    ["> quote|", "> quote\n> |"],
  ])("continues %j", (input, expected) => {
    expect(run(continueMarkup, input)).toEqual({ handled: true, result: expected });
  });

  it("exits the list on an empty item", () => {
    expect(run(continueMarkup, "- a\n- |").result).toBe("- a\n|");
    expect(run(continueMarkup, "1. x\n2. |").result).toBe("1. x\n|");
  });

  it("does not handle plain paragraphs or fenced code", () => {
    expect(run(continueMarkup, "plain|").handled).toBe(false);
    expect(run(continueMarkup, "```\n- x|\n```").handled).toBe(false);
  });
});

describe("toggleWrap (bold/italic)", () => {
  it("wraps the selection and keeps the inner text selected", () => {
    expect(run(toggleWrap("**"), "a <bold> b").result).toBe("a **<bold>** b");
  });

  it("inserts an empty pair with the cursor inside", () => {
    expect(run(toggleWrap("*"), "a |").result).toBe("a *|*");
  });

  it("unwraps a selection that includes the delimiters", () => {
    expect(run(toggleWrap("**"), "<**bold**>").result).toBe("<bold>");
  });

  it("unwraps delimiters right around the selection", () => {
    expect(run(toggleWrap("**"), "**<bold>**").result).toBe("<bold>");
    expect(run(toggleWrap("*"), "*<it>*").result).toBe("<it>");
  });

  it("does not treat bold as italic", () => {
    expect(run(toggleWrap("*"), "**<bold>**").result).toBe("***<bold>***");
  });
});

describe("insertLink", () => {
  it("wraps text and selects the url placeholder", () => {
    expect(run(insertLink(), "<memos>").result).toBe("[memos](<url>)");
  });

  it("turns a selected URL into [](url) with the cursor in the brackets", () => {
    expect(run(insertLink(), "<https://a.com>").result).toBe("[|](https://a.com)");
  });

  it("pastes a URL over a selection as a link", () => {
    expect(run(pasteUrlOverSelection("https://a.com"), "<memos>").result).toBe("[memos](https://a.com)|");
    expect(run(pasteUrlOverSelection("not a url"), "<memos>").handled).toBe(false);
    expect(run(pasteUrlOverSelection("https://a.com"), "memos|").handled).toBe(false);
  });
});

describe("insertTabSpaces / insertTextSpec", () => {
  it("inserts two spaces over the selection", () => {
    expect(run(insertTabSpaces, "a<bc>d").result).toBe("a  |d");
  });

  it("wraps the selection with prefix/suffix like the legacy textarea", () => {
    const state = create("x<code>y");
    expect(show(state.update(insertTextSpec(state, "", "```\n", "\n```")).state)).toBe("x```\ncode|\n```y");
  });
});

const complete = async (source: (ctx: CompletionContext) => unknown, marked: string) => {
  const state = create(marked);
  const result = (await source(new CompletionContext(state, state.selection.main.head, false))) as CompletionResult | null;
  if (!result) return null;
  const option = result.options[0];
  const next = state.update({
    changes: { from: result.from, to: result.to ?? state.selection.main.head, insert: option.apply as string },
    selection: EditorSelection.cursor(result.from + (option.apply as string).length),
  }).state;
  return { labels: result.options.map((o) => o.label), result: show(next) };
};

describe("tag completion", () => {
  const source = tagCompletionSource(() => ["work", "reading", "workout"]);

  it("replaces the #word with `#tag `", async () => {
    expect(await complete(source, "note #wor|")).toEqual({ labels: ["#work", "#workout"], result: "note #work |" });
  });

  it("replaces the whole word around the cursor", async () => {
    expect((await complete(source, "#rea|di"))?.result).toBe("#reading |");
  });

  it("ignores # inside a word", async () => {
    expect(await complete(source, "a#wor|")).toBeNull();
  });
});

describe("memo completion", () => {
  it("inserts ![[memos/uid]] for @query", async () => {
    const queries: string[] = [];
    const source = memoCompletionSource(async (query) => {
      queries.push(query);
      return [{ uid: "abc", label: "hello" }];
    }, 0);
    expect(await complete(source, "see @hel|")).toEqual({ labels: ["hello"], result: "see ![[memos/abc]]|" });
    expect(queries).toEqual(["hel"]);
  });

  it("returns nothing without @", async () => {
    const source = memoCompletionSource(async () => [{ uid: "abc", label: "x" }], 0);
    expect(await complete(source, "see hel|")).toBeNull();
  });
});

describe("format bar commands", () => {
  it("toggleWrap with a placeholder selects it on an empty selection", () => {
    expect(run(toggleWrap("~~", "text"), "a |").result).toBe("a ~~<text>~~");
    expect(run(toggleWrap("$", "x^2"), "|").result).toBe("$<x^2>$");
  });

  it("toggleWrap with a placeholder still wraps and unwraps a selection", () => {
    expect(run(toggleWrap("~~", "text"), "a <b> c").result).toBe("a ~~<b>~~ c");
    expect(run(toggleWrap("~~", "text"), "a ~~<b>~~ c").result).toBe("a <b> c");
    expect(run(toggleWrap("`", "code"), "<x>").result).toBe("`<x>`");
  });

  it.each([
    ["quote", "|", "> |"],
    ["quote", "ab|c", "> ab|c"],
    ["quote", "> ab|c", "ab|c"],
    ["bullet", "<a\nb>", "<- a\n- b>"],
    ["bullet", "- <a\n- b>", "<a\nb>"],
    ["ordered", "<a\nb\nc>", "<1. a\n2. b\n3. c>"],
    ["ordered", "1. <a\n2. b>", "<a\nb>"],
    ["ordered", "- <a\n- b>", "1. <a\n2. b>"],
    ["task", "x|", "- [ ] x|"],
    ["task", "- x|", "- [ ] x|"],
    ["task", "- [x] x|", "x|"],
    ["bullet", "  - x|", "  x|"],
    ["heading", "title|", "## title|"],
    ["heading", "## title|", "title|"],
    ["heading", "# title|", "## title|"],
    ["quote", "<a\n\nb>", "<> a\n\n> b>"],
  ] as const)("toggleLinePrefix(%s) %j → %j", (kind, input, expected) => {
    expect(run(toggleLinePrefix(kind), input)).toEqual({ handled: true, result: expected });
  });

  it.each([
    ["|", "```\n|\n```"],
    ["text|", "text\n```\n|\n```"],
    ["<a\nb>", "```\n<a\nb>\n```"],
    ["x <a> y", "x \n```\n<a>\n```\n y"],
  ])("insertCodeBlock %j → %j", (input, expected) => {
    expect(run(insertCodeBlock, input).result).toBe(expected);
  });
});
