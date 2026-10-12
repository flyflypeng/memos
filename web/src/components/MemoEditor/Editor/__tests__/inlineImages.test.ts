import { EditorState, TransactionSpec } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { createEditorState as create, showEditorState as show } from "@/test/editorState";
import {
  classifyTransfer,
  insertUploadPlaceholders,
  pastedImageFilename,
  planDrop,
  replaceUploadPlaceholder,
  startSlashUpload,
  takeUploadAnchor,
  uploadAnchorField,
} from "../inlineImages";

const file = (name: string, type: string) => new File(["x"], name, { type });

describe("classifyTransfer (paste/drop decision)", () => {
  const png = file("image.png", "image/png");
  const pdf = file("doc.pdf", "application/pdf");

  it("pastes text when the clipboard has non-empty text, even with images attached (Excel, Word, web pages)", () => {
    expect(classifyTransfer("A1\tB1", [png])).toEqual({ kind: "text" });
  });

  it("treats whitespace-only text as no text", () => {
    expect(classifyTransfer(" \n", [png])).toEqual({ kind: "files", images: [png], attachments: [] });
  });

  it("uploads image files as inline images and other files as attachments, keeping their order", () => {
    const jpg = file("b.jpg", "image/jpeg");
    expect(classifyTransfer("", [png, pdf, jpg])).toEqual({ kind: "files", images: [png, jpg], attachments: [pdf] });
  });

  it("treats Photoshop files as attachments", () => {
    const psd = file("a.psd", "image/vnd.adobe.photoshop");
    expect(classifyTransfer("", [psd])).toEqual({ kind: "files", images: [], attachments: [psd] });
  });

  it("falls back to the default paste when there is neither text nor files", () => {
    expect(classifyTransfer("", [])).toEqual({ kind: "text" });
  });
});

describe("pastedImageFilename", () => {
  // Local time, month is 0-based in the Date constructor.
  const now = new Date(2026, 0, 5, 9, 3, 7);

  it.each([
    ["image/png", "image.png", "pasted-20260105-090307.png"],
    ["image/jpeg", "image.jpeg", "pasted-20260105-090307.jpg"],
    ["image/gif", "x", "pasted-20260105-090307.gif"],
    ["image/webp", "", "pasted-20260105-090307.webp"],
    ["image/svg+xml", "a.svg", "pasted-20260105-090307.svg"],
    ["image/heic", "IMG_1.HEIC", "pasted-20260105-090307.heic"],
  ])("names a %s paste", (type, name, expected) => {
    expect(pastedImageFilename(file(name, type), now)).toBe(expected);
  });
});

const apply = (state: EditorState, specs: TransactionSpec | TransactionSpec[] | null) => {
  expect(specs).not.toBeNull();
  return [specs!].flat().reduce((current, spec) => current.update(spec).state, state);
};

const typeAtCursor = (state: EditorState, text: string) => state.update(state.replaceSelection(text)).state;

const P = (token: string) => `![Uploading…](memos-upload://${token})`;

describe("upload placeholders", () => {
  it("inserts a placeholder at the cursor and puts the cursor after it", () => {
    const state = create("see | here");
    const { from, to } = state.selection.main;
    expect(show(apply(state, insertUploadPlaceholders(state, ["t1"], from, to)))).toBe(`see ${P("t1")}| here`);
  });

  it("replaces the selection, like a normal paste", () => {
    const state = create("a <old> b");
    const { from, to } = state.selection.main;
    expect(show(apply(state, insertUploadPlaceholders(state, ["t1"], from, to)))).toBe(`a ${P("t1")}| b`);
  });

  it("inserts several images in order, one per line", () => {
    const state = create("|");
    expect(show(apply(state, insertUploadPlaceholders(state, ["t1", "t2", "t3"], 0)))).toBe(`${P("t1")}\n${P("t2")}\n${P("t3")}|`);
  });

  it("replaces a placeholder by token after the user kept typing before and after it", () => {
    let state = create("intro |");
    state = apply(state, insertUploadPlaceholders(state, ["t1"], state.selection.main.head));
    state = typeAtCursor(state, " more");
    state = state.update({ changes: { from: 0, insert: "# Title\n" } }).state;
    state = apply(state, replaceUploadPlaceholder(state, "t1", "![](/file/resources/7/pasted.png)"));
    expect(show(state)).toBe("# Title\nintro ![](/file/resources/7/pasted.png) more|");
  });

  it("keeps the cursor right after the image when the cursor sits right after the placeholder", () => {
    let state = create("|");
    state = apply(state, insertUploadPlaceholders(state, ["t1"], 0));
    state = apply(state, replaceUploadPlaceholder(state, "t1", "![](/file/resources/7/a.png)"));
    expect(show(typeAtCursor(state, "x"))).toBe("![](/file/resources/7/a.png)x|");
  });

  it("replaces only the placeholder with the matching token", () => {
    let state = create("|");
    state = apply(state, insertUploadPlaceholders(state, ["t1", "t2"], 0));
    state = apply(state, replaceUploadPlaceholder(state, "t2", "![](/file/resources/2/b.png)"));
    state = apply(state, replaceUploadPlaceholder(state, "t1", "![](/file/resources/1/a.png)"));
    expect(state.doc.toString()).toBe("![](/file/resources/1/a.png)\n![](/file/resources/2/b.png)");
  });

  it("removes a failed placeholder together with its line break", () => {
    let state = create("|");
    state = apply(state, insertUploadPlaceholders(state, ["t1", "t2", "t3"], 0));
    state = apply(state, replaceUploadPlaceholder(state, "t2", ""));
    expect(state.doc.toString()).toBe(`${P("t1")}\n${P("t3")}`);
    state = apply(state, replaceUploadPlaceholder(state, "t3", ""));
    expect(state.doc.toString()).toBe(P("t1"));
    state = apply(state, replaceUploadPlaceholder(state, "t1", ""));
    expect(show(state)).toBe("|");
  });

  it("removes a lone failed placeholder and leaves the surrounding text intact", () => {
    let state = create("a |b");
    state = apply(state, insertUploadPlaceholders(state, ["t1"], state.selection.main.head));
    expect(show(apply(state, replaceUploadPlaceholder(state, "t1", "")))).toBe("a |b");
  });

  it("does nothing when the user deleted the placeholder during the upload", () => {
    let state = create("|");
    state = apply(state, insertUploadPlaceholders(state, ["t1"], 0));
    state = state.update({ changes: { from: 0, to: state.doc.length, insert: "gone" } }).state;
    expect(replaceUploadPlaceholder(state, "t1", "![](/file/resources/1/a.png)")).toBeNull();
  });
});

describe("planDrop (drop decision and position)", () => {
  const a = file("a.png", "image/png");
  const b = file("photo 2.jpg", "image/jpeg");
  const pdf = file("report.pdf", "application/pdf");

  it("inserts dropped images at the drop position in order, keeping their names; other files become attachments", () => {
    const state = create("hello |world");
    const plan = planDrop(state, [a, pdf, b], 2)!;
    expect(plan.uploads.map((u) => [u.file, u.filename])).toEqual([
      [a, "a.png"],
      [b, "photo 2.jpg"],
    ]);
    expect(plan.attachments).toEqual([pdf]);
    expect(plan.range).toEqual({ from: 2, to: 2 });
    const next = apply(state, insertUploadPlaceholders(state, ["t1", "t2"], plan.range.from, plan.range.to));
    expect(show(next)).toBe(`he${P("t1")}\n${P("t2")}|llo world`);
  });

  it("does not replace the selection when dropping elsewhere", () => {
    expect(planDrop(create("<abc> def"), [a], 5)!.range).toEqual({ from: 5, to: 5 });
  });

  it("falls back to the selection when the drop position is unknown", () => {
    expect(planDrop(create("ab<cd>"), [a], null)!.range).toEqual({ from: 2, to: 4 });
  });

  it("returns null when no files were dropped", () => {
    expect(planDrop(create("|"), [], 0)).toBeNull();
  });
});

describe("slash upload anchor", () => {
  const withField = (marked: string) => {
    const s = create(marked);
    return EditorState.create({ doc: s.doc, selection: s.selection, extensions: uploadAnchorField });
  };

  it("removes the /query and follows edits made while the picker is open", () => {
    let state = withField("ab /up|cd");
    state = apply(state, startSlashUpload(3, 6));
    expect(show(state)).toBe("ab |cd");
    state = state.update({ changes: { from: 0, insert: "XY" } }).state;
    state = state.update({ changes: { from: state.doc.length, insert: "!" } }).state;
    const { position, spec } = takeUploadAnchor(state);
    expect(position).toBe(5);
    expect(takeUploadAnchor(apply(state, spec)).position).toBeNull();
  });
});
