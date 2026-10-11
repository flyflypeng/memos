// GFM table editing commands. No React, no DOM: each command works on a headless `EditorState`
// (S2 test seam). Everything except `insertTable` only acts when the cursor is inside a table and
// returns false elsewhere, so the next binding for the same key (indent, list continuation) runs.
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import { EditorSelection, EditorState, Line, StateCommand, TransactionSpec } from "@codemirror/state";
import { tableBlockSpec } from "./slashCommands";

/**
 * Inserts a `rows` × `cols` table (rows include the header row) in place of the selection, with
 * the cursor in the first header cell. Placed like the slash-menu table: blank lines separate it
 * from paragraphs, and it goes into the current list item or quote.
 */
export const insertTable =
  (rows: number, cols: number): StateCommand =>
  ({ state, dispatch }) => {
    const { from, to, head } = state.selection.main;
    const sameLine = state.doc.lineAt(from).number === state.doc.lineAt(to).number;
    dispatch(state.update(sameLine ? tableBlockSpec(state, from, to, rows, cols) : tableBlockSpec(state, head, head, rows, cols)));
    return true;
  };

interface Cell {
  /** The text between two pipes, padding included. */
  from: number;
  to: number;
}

interface TableRow {
  line: Line;
  /** Where the row starts after its container prefix (`> `, list indentation). */
  start: number;
  cells: Cell[];
  /** The `| --- | :-: |` row. */
  delimiter: boolean;
}

/**
 * Splits a row the way the GFM parser does: unescaped pipes separate cells, and a leading or
 * trailing pipe does not open an extra empty cell. Unlike the syntax tree, empty cells are kept.
 */
const splitRow = (text: string, offset: number): Cell[] => {
  const cells: Cell[] = [];
  let cellFrom = 0;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "|" && !escaped) {
      cells.push({ from: offset + cellFrom, to: offset + i });
      cellFrom = i + 1;
    }
    escaped = !escaped && text[i] === "\\";
  }
  cells.push({ from: offset + cellFrom, to: offset + text.length });
  const isBlank = (cell: Cell) => text.slice(cell.from - offset, cell.to - offset).trim() === "";
  if (cells.length > 1 && isBlank(cells[0]) && text.trimStart().startsWith("|")) cells.shift();
  if (cells.length > 1 && isBlank(cells[cells.length - 1])) cells.pop();
  return cells;
};

/** The rows of the GFM table on the line at `pos`, or null when that line is not part of a table. */
const tableAt = (state: EditorState, pos: number): TableRow[] | null => {
  const line = state.doc.lineAt(pos);
  const tree = ensureSyntaxTree(state, line.to, 50) ?? syntaxTree(state);
  // Resolve at the line end: the line may start inside a container prefix (`> `), outside the table.
  let table = tree.resolveInner(line.to, -1);
  while (table.name !== "Table" && table.parent) table = table.parent;
  if (table.name !== "Table") return null;
  const rows: TableRow[] = [];
  for (let child = table.firstChild; child; child = child.nextSibling) {
    if (child.name !== "TableHeader" && child.name !== "TableRow" && child.name !== "TableDelimiter") continue;
    const rowLine = state.doc.lineAt(child.from);
    rows.push({
      line: rowLine,
      start: child.from,
      cells: splitRow(state.sliceDoc(child.from, rowLine.to), child.from),
      delimiter: child.name === "TableDelimiter",
    });
  }
  return rows.some((row) => row.line.number === line.number) ? rows : null;
};

/** The cell text without its padding. */
const contentRange = (state: EditorState, cell: Cell) => {
  const text = state.sliceDoc(cell.from, cell.to);
  const from = cell.from + (text.length - text.trimStart().length);
  return { from, to: Math.max(from, cell.from + text.trimEnd().length) };
};

/** Selects the cell content, or puts the cursor after the padding space of an empty cell. */
const selectCell = (state: EditorState, cell: Cell): TransactionSpec => {
  const content = contentRange(state, cell);
  return {
    selection:
      content.from < content.to
        ? EditorSelection.range(content.from, content.to)
        : EditorSelection.cursor(Math.min(cell.from + 1, cell.to)),
    scrollIntoView: true,
  };
};

/** Appends an empty row after the table, in the same container, with the cursor in its first cell. */
const appendRowSpec = (state: EditorState, rows: TableRow[]): TransactionSpec => {
  const last = rows[rows.length - 1];
  const prefix = state.sliceDoc(last.line.from, last.start);
  const cols = rows[0].cells.length;
  const insert = "\n" + prefix + "|" + "     |".repeat(cols);
  return {
    changes: { from: last.line.to, insert },
    selection: EditorSelection.cursor(last.line.to + 1 + prefix.length + 2),
    scrollIntoView: true,
    userEvent: "input",
  };
};

const bodyCells = (rows: TableRow[]) => rows.filter((row) => !row.delimiter).flatMap((row) => row.cells);

/** Tab in a table: moves to the next cell. From the last cell, appends a row and moves into it. */
export const nextCell: StateCommand = ({ state, dispatch }) => {
  const { to } = state.selection.main;
  const rows = tableAt(state, to);
  if (!rows) return false;
  const target = bodyCells(rows).find((cell) => cell.from > to);
  dispatch(state.update(target ? selectCell(state, target) : appendRowSpec(state, rows)));
  return true;
};

/** Shift+Tab in a table: moves to the previous cell. In the first cell it keeps the cursor there. */
export const previousCell: StateCommand = ({ state, dispatch }) => {
  const { from } = state.selection.main;
  const rows = tableAt(state, from);
  if (!rows) return false;
  const target = bodyCells(rows).findLast((cell) => cell.to < from);
  if (target) dispatch(state.update(selectCell(state, target)));
  return true;
};

/**
 * Enter in the last row of a table (the header row when there are no body rows): appends an empty
 * row and moves into its first cell. On an empty last body row, it removes that row and leaves the
 * table with a blank line, like Enter on an empty list item. Returns false in other rows so Enter
 * inserts a newline.
 */
export const tableNewRow: StateCommand = ({ state, dispatch }) => {
  const { head } = state.selection.main;
  const rows = tableAt(state, head);
  const lastRow = rows?.filter((row) => !row.delimiter).pop();
  if (!rows || !lastRow || lastRow.line.number !== state.doc.lineAt(head).number) return false;
  const isBodyRow = lastRow !== rows[0];
  if (isBodyRow && lastRow.cells.every((cell) => state.sliceDoc(cell.from, cell.to).trim() === "")) {
    const prefix = state.sliceDoc(lastRow.line.from, lastRow.start);
    const insert = prefix.trimEnd() + "\n" + prefix;
    dispatch(
      state.update({
        changes: { from: lastRow.line.from, to: lastRow.line.to, insert },
        selection: EditorSelection.cursor(lastRow.line.from + insert.length),
        scrollIntoView: true,
        userEvent: "input",
      }),
    );
    return true;
  }
  dispatch(state.update(appendRowSpec(state, rows)));
  return true;
};

// East Asian Wide and Fullwidth blocks (UAX #11) that are not covered by the emoji check below.
const WIDE_RANGES: [number, number][] = [
  [0x1100, 0x115f],
  [0x2e80, 0x303e],
  [0x3041, 0x33ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xa000, 0xa4cf],
  [0xa960, 0xa97f],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe10, 0xfe19],
  [0xfe30, 0xfe6f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x1f300, 0x1f64f],
  [0x1f900, 0x1f9ff],
  [0x20000, 0x2fffd],
  [0x30000, 0x3fffd],
];
const EMOJI_REGEX = /\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F/u;
const ZERO_WIDTH_REGEX = /^[\p{Mn}\p{Me}\p{Cf}]+$/u;
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * Monospace display width: East Asian wide/fullwidth characters and emoji (including ZWJ sequences
 * and skin tones) take 2 columns, combining marks 0, everything else 1.
 */
export const displayWidth = (text: string): number => {
  let width = 0;
  for (const { segment } of graphemes.segment(text)) {
    const code = segment.codePointAt(0)!;
    if (EMOJI_REGEX.test(segment) || WIDE_RANGES.some(([from, to]) => code >= from && code <= to)) width += 2;
    else if (!ZERO_WIDTH_REGEX.test(segment)) width += 1;
  }
  return width;
};

type Alignment = "none" | "left" | "center" | "right";

const padCell = (text: string, width: number, align: Alignment) => {
  const space = width - displayWidth(text);
  if (align === "right") return " ".repeat(space) + text;
  if (align === "center") return " ".repeat(Math.floor(space / 2)) + text + " ".repeat(Math.ceil(space / 2));
  return text + " ".repeat(space);
};

const delimiterCell = (width: number, align: Alignment) => {
  if (align === "left") return ":" + "-".repeat(width - 1);
  if (align === "right") return "-".repeat(width - 1) + ":";
  if (align === "center") return ":" + "-".repeat(width - 2) + ":";
  return "-".repeat(width);
};

/**
 * Formats the table at the cursor: outer pipes, one space of padding, every column padded to its
 * widest cell (by display width, at least 3) following its alignment marker. Cell content is not
 * changed, so the rendered table stays the same. Short rows get empty cells; cells beyond the header
 * columns are kept unpadded. The cursor stays at the same place in its cell.
 */
export const formatTable: StateCommand = ({ state, dispatch }) => {
  const { head } = state.selection.main;
  const rows = tableAt(state, head);
  if (!rows) return false;
  const cols = rows[0].cells.length;
  const contents = rows.map((row) => row.cells.map((cell) => state.sliceDoc(cell.from, cell.to).trim()));
  const delimiterIndex = rows.findIndex((row) => row.delimiter);
  const aligns = Array.from({ length: cols }, (_, col): Alignment => {
    const marker = contents[delimiterIndex]?.[col] ?? "";
    const left = marker.startsWith(":");
    const right = marker.endsWith(":");
    return left && right ? "center" : left ? "left" : right ? "right" : "none";
  });
  const widths = aligns.map((_, col) =>
    Math.max(3, ...contents.filter((_, i) => i !== delimiterIndex).map((cells) => displayWidth(cells[col] ?? ""))),
  );

  const cursorLine = state.doc.lineAt(head);
  let cursorRow = -1;
  let cursorInLine = 0;
  const changes = rows.map((row, rowIndex) => {
    const prefix = state.sliceDoc(row.line.from, row.start);
    let text = prefix + "|";
    const isCursorRow = row.line.number === cursorLine.number;
    if (isCursorRow) {
      cursorRow = rowIndex;
      cursorInLine = head <= row.start ? head - row.line.from : -1;
    }
    const cellCount = Math.max(cols, row.cells.length);
    for (let col = 0; col < cellCount; col++) {
      const content = contents[rowIndex][col] ?? "";
      const body =
        col >= cols ? content : row.delimiter ? delimiterCell(widths[col], aligns[col]) : padCell(content, widths[col], aligns[col]);
      const cell = row.cells[col];
      if (isCursorRow && cursorInLine < 0 && cell && head >= cell.from && head <= cell.to) {
        // Same offset within the content; padding added by alignment goes before it.
        const offset = Math.min(Math.max(head - contentRange(state, cell).from, 0), content.length);
        const lead = content && !row.delimiter ? body.length - body.trimStart().length : 0;
        cursorInLine = text.length + 1 + lead + offset;
      }
      text += " " + body + " |";
    }
    if (isCursorRow && cursorInLine < 0) cursorInLine = text.length;
    return { from: row.line.from, to: row.line.to, insert: text };
  });

  const changeSet = state.changes(changes);
  const selection = cursorRow < 0 ? undefined : EditorSelection.cursor(changeSet.mapPos(rows[cursorRow].line.from, -1) + cursorInLine);
  dispatch(state.update({ changes: changeSet, selection, userEvent: "input" }));
  return true;
};

/**
 * For an `inputHandler`: typing `|` inside a header or body cell inserts `\|`, so the pipe becomes
 * cell text instead of splitting the cell. Returns null (type normally) for other text, outside
 * cells (before the leading or after the trailing pipe), in the delimiter row, right after a
 * backslash, and outside tables.
 */
export const escapePipeSpec = (state: EditorState, from: number, to: number, text: string): TransactionSpec | null => {
  if (text !== "|" || state.sliceDoc(from - 1, from) === "\\") return null;
  const row = tableAt(state, from)?.find((row) => row.line.number === state.doc.lineAt(from).number);
  if (!row || row.delimiter || !row.cells.some((cell) => from >= cell.from && to <= cell.to)) return null;
  return {
    changes: { from, to, insert: "\\|" },
    selection: EditorSelection.cursor(from + 2),
    scrollIntoView: true,
    userEvent: "input.type",
  };
};
