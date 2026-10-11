import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { syntaxTree } from "@codemirror/language";
import { EditorSelection, EditorState, StateCommand } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { displayWidth, escapePipeSpec, formatTable, insertTable, nextCell, previousCell, tableNewRow } from "../tableCommands";

// `^` marks the cursor; without it, `<` … `>` mark the selection. (`|` is table syntax here.)
const create = (marked: string) => {
  const cursor = marked.indexOf("^");
  const doc = cursor >= 0 ? marked.replace("^", "") : marked.replace("<", "").replace(">", "");
  const selection = cursor >= 0 ? EditorSelection.single(cursor) : EditorSelection.single(marked.indexOf("<"), marked.indexOf(">") - 1);
  return EditorState.create({ doc, selection, extensions: [markdown({ base: markdownLanguage })] });
};

const show = (state: EditorState) => {
  const { from, to } = state.selection.main;
  const doc = state.doc.toString();
  return from === to ? doc.slice(0, from) + "^" + doc.slice(from) : doc.slice(0, from) + "<" + doc.slice(from, to) + ">" + doc.slice(to);
};

const run = (command: StateCommand, marked: string) => {
  let state = create(marked);
  const handled = command({ state, dispatch: (tr) => (state = tr.state) });
  return { handled, result: show(state) };
};

const lines = (...rows: string[]) => rows.join("\n");

describe("insertTable", () => {
  it("inserts a rows × cols skeleton with the cursor in the first header cell", () => {
    expect(run(insertTable(3, 2), "^").result).toBe(lines("| ^    |     |", "| --- | --- |", "|     |     |", "|     |     |"));
  });

  it("separates the table from surrounding paragraphs", () => {
    expect(run(insertTable(2, 1), "text^\nnext").result).toBe(lines("text", "", "| ^    |", "| --- |", "|     |", "", "next"));
  });

  it("goes into the current list item or quote", () => {
    expect(run(insertTable(1, 1), "> ^").result).toBe(lines("> | ^    |", "> | --- |"));
  });
});

describe("nextCell / previousCell (Tab / Shift+Tab)", () => {
  it("moves to the next cell, selecting its content and skipping the delimiter row", () => {
    expect(run(nextCell, lines("| ^a | bb |", "| --- | --- |", "| c |  |")).result).toBe(
      lines("| a | <bb> |", "| --- | --- |", "| c |  |"),
    );
    expect(run(nextCell, lines("| a | b^b |", "| --- | --- |", "| c |  |")).result).toBe(
      lines("| a | bb |", "| --- | --- |", "| <c> |  |"),
    );
  });

  it("puts the cursor after the padding space of an empty cell", () => {
    expect(run(nextCell, lines("| a | bb |", "| --- | --- |", "| c^ |  |")).result).toBe(lines("| a | bb |", "| --- | --- |", "| c | ^ |"));
  });

  it("appends a row and moves into it from the last cell", () => {
    expect(run(nextCell, lines("| a | bb |", "| --- | --- |", "| c | ^ |")).result).toBe(
      lines("| a | bb |", "| --- | --- |", "| c |  |", "| ^    |     |"),
    );
  });

  it("moves back with Shift+Tab and stays put in the first cell", () => {
    expect(run(previousCell, lines("| a | bb |", "| --- | --- |", "| ^c |  |")).result).toBe(
      lines("| a | <bb> |", "| --- | --- |", "| c |  |"),
    );
    expect(run(previousCell, lines("| a^ | bb |", "| --- | --- |", "| c |  |"))).toEqual({
      handled: true,
      result: lines("| a^ | bb |", "| --- | --- |", "| c |  |"),
    });
  });

  it("works without outer pipes and inside quotes", () => {
    expect(run(nextCell, "a^ | b\n--|--\nc | d").result).toBe("a | <b>\n--|--\nc | d");
    expect(run(nextCell, "> | a^ | b |\n> | --- | --- |").result).toBe("> | a | <b> |\n> | --- | --- |");
    expect(run(nextCell, "> | a | b^ |\n> | --- | --- |").result).toBe("> | a | b |\n> | --- | --- |\n> | ^    |     |");
  });

  it("treats escaped pipes as cell content", () => {
    expect(run(nextCell, lines("| ^a \\| b | c |", "| --- | --- |")).result).toBe(lines("| a \\| b | <c> |", "| --- | --- |"));
  });

  it("does nothing outside a table", () => {
    expect(run(nextCell, "plain ^text").handled).toBe(false);
    expect(run(previousCell, "- item^").handled).toBe(false);
    expect(run(nextCell, lines("| a | b |", "| --- | --- |", "", "^after")).handled).toBe(false);
    expect(run(nextCell, "```\n| a^ | b |\n| --- | --- |\n```").handled).toBe(false);
  });
});

describe("tableNewRow (Enter)", () => {
  it("appends a row from anywhere in the last row", () => {
    expect(run(tableNewRow, lines("| a | b |", "| --- | --- |", "| c^ | d |")).result).toBe(
      lines("| a | b |", "| --- | --- |", "| c | d |", "| ^    |     |"),
    );
    expect(run(tableNewRow, lines("| a | b^ |", "| --- | --- |")).result).toBe(lines("| a | b |", "| --- | --- |", "| ^    |     |"));
  });

  it("keeps the table's container prefix", () => {
    expect(run(tableNewRow, "- | a^ |\n  | --- |").result).toBe("- | a |\n  | --- |\n  | ^    |");
  });

  it("exits the table from an empty last row, like an empty list item", () => {
    expect(run(tableNewRow, lines("| a | b |", "| --- | --- |", "| ^    |     |")).result).toBe(
      lines("| a | b |", "| --- | --- |", "", "^"),
    );
    expect(run(tableNewRow, "> | a |\n> | --- |\n> | ^ |").result).toBe("> | a |\n> | --- |\n>\n> ^");
  });

  it("leaves Enter alone in other rows and outside tables", () => {
    expect(run(tableNewRow, lines("| a^ | b |", "| --- | --- |", "| c | d |")).handled).toBe(false);
    expect(run(tableNewRow, "- item^").handled).toBe(false);
  });
});

describe("displayWidth", () => {
  it("counts East Asian wide characters and emoji as 2 columns", () => {
    expect(displayWidth("abc")).toBe(3);
    expect(displayWidth("中文")).toBe(4);
    expect(displayWidth("ｱＡ")).toBe(3); // halfwidth katakana 1, fullwidth latin 2
    expect(displayWidth("한글")).toBe(4);
    expect(displayWidth("😀")).toBe(2);
    expect(displayWidth("👍🏽")).toBe(2);
    expect(displayWidth("👨‍👩‍👧")).toBe(2);
    expect(displayWidth("❤️")).toBe(2);
    expect(displayWidth("é")).toBe(1); // e + combining acute
  });
});

describe("formatTable", () => {
  it("pads every column to its widest cell, keeping alignment markers", () => {
    expect(run(formatTable, lines("|a|bbbb|c|d|", "|:-|:-:|-:|-|", "|long text|x|1|^|")).result).toBe(
      lines("| a         | bbbb |   c | d   |", "| :-------- | :--: | --: | --- |", "| long text |  x   |   1 | ^    |"),
    );
  });

  it("measures CJK and emoji by display width", () => {
    expect(run(formatTable, lines("| 名称 | x |", "| --- | --- |", "| a | 😀👍 |^")).result).toBe(
      lines("| 名称 | x    |", "| ---- | ---- |", "| a    | 😀👍 |^"),
    );
  });

  it("keeps cell content, escaped pipes and code spans unchanged", () => {
    expect(run(formatTable, lines("^| a \\| b | `c` |", "|---|---|", "| **d** |  |")).result).toBe(
      lines("^| a \\| b | `c` |", "| ------ | --- |", "| **d**  |     |"),
    );
  });

  it("fills short rows with empty cells and keeps extra cells", () => {
    expect(run(formatTable, lines("| a | b |", "|---|---|", "| c |", "| d | e | f |^")).result).toBe(
      lines("| a   | b   |", "| --- | --- |", "| c   |     |", "| d   | e   | f |^"),
    );
  });

  it("adds outer pipes, keeps container prefixes and the cursor's cell", () => {
    expect(run(formatTable, "a | b^b\n-|-").result).toBe("| a   | b^b  |\n| --- | --- |");
    expect(run(formatTable, "> |a|b|\n> |-|-|\n> |cc^c|d|").result).toBe("> | a   | b   |\n> | --- | --- |\n> | cc^c | d   |");
  });

  it("leaves the parsed cells unchanged", () => {
    const parsedCells = (state: EditorState) => {
      const cells: string[] = [];
      syntaxTree(state).iterate({ enter: (node) => void (node.name === "TableCell" && cells.push(state.sliceDoc(node.from, node.to))) });
      return cells;
    };
    const before = create(lines("^名称|说明 \\| 备注|`x`", ":-|:-:|-:", "😀|**粗**|[l](u)", "a"));
    let after = before;
    formatTable({ state: before, dispatch: (tr) => (after = tr.state) });
    expect(parsedCells(after)).toEqual(parsedCells(before));
    expect(parsedCells(before)).toEqual(["名称", "说明 \\| 备注", "`x`", "😀", "**粗**", "[l](u)", "a"]);
  });

  it("does nothing outside a table", () => {
    expect(run(formatTable, "plain^").handled).toBe(false);
  });
});

describe("escapePipeSpec (typing | in a cell)", () => {
  const type = (marked: string, text = "|") => {
    const state = create(marked);
    const { from, to } = state.selection.main;
    const spec = escapePipeSpec(state, from, to, text);
    return spec && show(state.update(spec).state);
  };

  it("inserts \\| inside header and body cells, replacing the selection", () => {
    expect(type(lines("| a^ | b |", "| --- | --- |"))).toBe(lines("| a\\|^ | b |", "| --- | --- |"));
    expect(type(lines("| a | b |", "| --- | --- |", "| x <y> z |  |"))).toBe(lines("| a | b |", "| --- | --- |", "| x \\|^ z |  |"));
    expect(type(lines("| a | b |", "| --- | --- |", "| `c^` |  |"))).toBe(lines("| a | b |", "| --- | --- |", "| `c\\|^` |  |"));
  });

  it("leaves | alone outside cells, in the delimiter row, after a backslash and outside tables", () => {
    expect(type(lines("| a | b |^", "| --- | --- |"))).toBeNull();
    expect(type(lines("^| a | b |", "| --- | --- |"))).toBeNull();
    expect(type(lines("| a | b |", "| --- ^| --- |"))).toBeNull();
    expect(type(lines("| a\\^ | b |", "| --- | --- |"))).toBeNull();
    expect(type("plain ^text")).toBeNull();
    expect(type(lines("| a^ | b |", "| --- | --- |"), "x")).toBeNull();
  });
});
