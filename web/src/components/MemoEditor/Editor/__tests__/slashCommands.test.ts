import { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { history, undo } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorSelection, EditorState, Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";
import { tableSkeleton } from "../commands";
import {
  applySlashBlock,
  embedMemoItem,
  embedMemoSpec,
  filterSlashItems,
  SlashBlockId,
  slashBlockItems,
  slashCompletionSource,
  slashTriggerAt,
} from "../slashCommands";

// `|` marks the cursor.
const create = (marked: string) => {
  const cursor = marked.indexOf("|");
  return EditorState.create({
    doc: marked.replace("|", ""),
    selection: EditorSelection.single(cursor),
    extensions: [markdown({ base: markdownLanguage })],
  });
};

const trigger = (marked: string) => {
  const state = create(marked);
  const found = slashTriggerAt(state, state.selection.main.head);
  return found && { query: found.query, text: state.sliceDoc(found.from, found.to) };
};

describe("slash trigger", () => {
  it.each([
    ["/|", ""],
    ["/hea|", "hea"],
    ["text /|", ""],
    ["text\n/ta|", "ta"],
    ["  /co|", "co"],
    ["中文　/表|", "表"],
  ])("opens at line start or after whitespace: %j", (input, query) => {
    expect(trigger(input)).toEqual({ query, text: `/${query}` });
  });

  it.each([
    ["1/|"],
    ["1/2|"],
    ["https://|"],
    ["https://example.com/pa|"],
    ["src/|"],
    ["./a|"],
    ["/usr/|"],
    ["/usr/bi|"],
    ["text/|"],
    ["`code /|`"],
    ["```\n/|\n```"],
    ["/h1 |"],
  ])("does not open in %j", (input) => {
    expect(trigger(input)).toBeNull();
  });
});

const show = (state: EditorState) => {
  const { head } = state.selection.main;
  const doc = state.doc.toString();
  return doc.slice(0, head) + "|" + doc.slice(head);
};

// Picks block `id` from the menu opened by the `/query` before the cursor.
const pick = (id: SlashBlockId, marked: string) => {
  const state = create(marked);
  const found = slashTriggerAt(state, state.selection.main.head)!;
  return show(state.update(applySlashBlock(state, found.from, found.to, id)).state);
};

describe("slash block insertion", () => {
  it.each<[SlashBlockId, string]>([
    ["heading-1", "# |"],
    ["heading-2", "## |"],
    ["heading-3", "### |"],
    ["bullet-list", "- |"],
    ["ordered-list", "1. |"],
    ["task-list", "- [ ] |"],
    ["quote", "> |"],
    ["code-block", "```\n|\n```"],
    ["table", "| |    |     |     |\n| --- | --- | --- |\n|     |     |     |\n|     |     |     |"],
    ["math-block", "$$\n|\n$$"],
    ["mermaid", "```mermaid\n|\n```"],
    ["divider", "---\n|"],
  ])("replaces /query with %s", (id, expected) => {
    expect(pick(id, "/x|")).toBe(expected);
  });

  it("turns the rest of the line into the heading or list item", () => {
    expect(pick("heading-2", "/h2|Title")).toBe("## |Title");
    expect(pick("task-list", "/todo| buy milk")).toBe("- [ ] |buy milk");
  });

  it("moves blocks to their own line when text precedes the slash", () => {
    expect(pick("heading-1", "intro /h|")).toBe("intro\n# |");
    expect(pick("quote", "a\nintro /q| tail")).toBe("a\nintro\n> |tail");
    expect(pick("code-block", "intro /c| tail")).toBe("intro\n```\n|\n```\ntail");
    expect(pick("divider", "/hr| tail")).toBe("---\n|tail");
  });

  it("keeps indentation", () => {
    expect(pick("bullet-list", "- a\n  /l|")).toBe("- a\n  - |");
    expect(pick("code-block", "- a\n  /c|")).toBe("- a\n  ```\n  |\n  ```");
  });

  it("nests blocks inside the list item or quote the slash was typed in", () => {
    expect(pick("heading-2", "- /h|")).toBe("- ## |");
    expect(pick("code-block", "> /c|")).toBe("> ```\n> |\n> ```");
    expect(pick("code-block", "1. /c|")).toBe("1. ```\n   |\n   ```");
    expect(pick("quote", "- item /q|")).toBe("- item\n  > |");
    expect(pick("divider", "> text\n> /hr|")).toBe("> text\n>\n> ---\n> |");
  });

  it("switches the list marker instead of nesting a list in an empty item", () => {
    expect(pick("task-list", "- /t|")).toBe("- [ ] |");
    expect(pick("bullet-list", "  1. /l|")).toBe("  - |");
    expect(pick("ordered-list", "- [ ] /o|")).toBe("1. |");
    expect(pick("bullet-list", "> /l|")).toBe("> - |");
  });

  it("separates tables and dividers from adjacent paragraphs", () => {
    // `text\n---` would be a setext heading; a line right after a table would become a row.
    expect(pick("divider", "text\n/hr|")).toBe("text\n\n---\n|");
    expect(pick("divider", "text /hr|")).toBe("text\n\n---\n|");
    expect(pick("table", "text /t|\nnext").split("\n")).toEqual([
      "text",
      "",
      "| |    |     |     |",
      "| --- | --- | --- |",
      "|     |     |     |",
      "|     |     |     |",
      "",
      "next",
    ]);
    expect(pick("table", "\n/t| tail").split("\n").slice(-2)).toEqual(["", "tail"]);
  });
});

describe("tableSkeleton", () => {
  it("builds a GFM table with a header row and the cursor in the first cell", () => {
    expect(tableSkeleton(2, 2)).toEqual({ text: "|     |     |\n| --- | --- |\n|     |     |", cursor: 2 });
    expect(tableSkeleton(1, 1)).toEqual({ text: "|     |\n| --- |", cursor: 2 });
  });
});

const menu = (marked: string, view?: Partial<EditorView>) => {
  const state = create(marked);
  const items = [...slashBlockItems((id) => `Label ${id}`), embedMemoItem("Embed memo")];
  const context = new CompletionContext(state, state.selection.main.head, false, view as EditorView | undefined);
  const result = slashCompletionSource(() => items)(context) as CompletionResult | null;
  return result && { labels: result.options.map((o) => o.label), text: state.sliceDoc(result.from, result.to) };
};

describe("slash menu", () => {
  it("lists every block and embed memo for a bare slash", () => {
    expect(menu("/|")?.labels).toEqual([
      "Label heading-1",
      "Label heading-2",
      "Label heading-3",
      "Label bullet-list",
      "Label ordered-list",
      "Label task-list",
      "Label quote",
      "Label code-block",
      "Label table",
      "Label math-block",
      "Label mermaid",
      "Label divider",
      "Embed memo",
    ]);
  });

  it("filters by keyword prefix and label, replacing the typed /query", () => {
    expect(menu("note /h2|")).toEqual({ labels: ["Label heading-2"], text: "/h2" });
    expect(menu("/TODO|")?.labels).toEqual(["Label task-list"]);
    expect(menu("/merm|")?.labels).toEqual(["Label mermaid"]);
    expect(menu("/memo|")?.labels).toEqual(["Embed memo"]);
  });

  it("puts prefix matches before matches inside the label", () => {
    const items = [
      { id: "a", label: "Bullet list", keywords: [], run: () => {} },
      { id: "b", label: "List of things", keywords: [], run: () => {} },
    ];
    expect(filterSlashItems(items, "list").map((item) => item.id)).toEqual(["b", "a"]);
    expect(filterSlashItems(items, "zzz")).toEqual([]);
  });

  it("closes when nothing matches", () => {
    expect(menu("/zzz|")).toBeNull();
  });

  it("does not open while an IME composition is active", () => {
    expect(menu("/|", { composing: true, compositionStarted: true })).toBeNull();
    expect(menu("/|", { composing: false, compositionStarted: true })).toBeNull();
    expect(menu("/|", { composing: false, compositionStarted: false })).not.toBeNull();
  });

  it("does not open where the trigger rule rejects the slash", () => {
    expect(menu("1/2|")).toBeNull();
    expect(menu("https://a.com/|")).toBeNull();
  });

  it("embed memo turns /query into @ so the @ Memo search opens", () => {
    const state = create("see /emb|");
    const found = slashTriggerAt(state, state.selection.main.head)!;
    expect(show(state.update(embedMemoSpec(found.from, found.to)).state)).toBe("see @|");
  });
});

describe("slash insertion undo", () => {
  it("undoes the inserted block as one step, separate from text typed afterwards", () => {
    let state = EditorState.create({ doc: "/ta", selection: EditorSelection.single(3), extensions: [history()] });
    const dispatch = (tr: Transaction) => (state = tr.state);
    state = state.update(applySlashBlock(state, 0, 3, "code-block")).state;
    state = state.update({ changes: { from: state.selection.main.head, insert: "x" }, userEvent: "input.type" }).state;
    undo({ state, dispatch });
    expect(state.doc.toString()).toBe("```\n\n```");
    undo({ state, dispatch });
    expect(state.doc.toString()).toBe("/ta");
  });
});
