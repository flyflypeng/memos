// Inline images: deciding what a paste or drop does, naming pasted images, and the upload
// placeholder flow. The state functions are pure (`EditorState` in, `TransactionSpec` out; S2 test
// seam); `uploadInlineImages` drives them against a live view and is shared by paste, drop and the
// slash menu's "Upload image".
import { isolateHistory } from "@codemirror/commands";
import { EditorSelection, EditorState, StateEffect, StateField, Transaction, TransactionSpec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { Resource } from "@/types/proto/api/v1/resource_service";
import { isImage } from "@/utils/resource";
import { generateUUID } from "@/utils/uuid";

export type TransferAction = { kind: "text" } | { kind: "files"; images: File[]; attachments: File[] };

// classifyTransfer decides what a paste or drop does. Non-empty text wins, because Excel, Numbers,
// Word and browsers put a rendered image next to copied text. Otherwise image files become inline
// images and other files attachments.
export const classifyTransfer = (text: string, files: File[]): TransferAction => {
  if (text.trim() !== "" || files.length === 0) return { kind: "text" };
  return {
    kind: "files",
    images: files.filter((file) => isImage(file.type)),
    attachments: files.filter((file) => !isImage(file.type)),
  };
};

const EXTENSION_BY_TYPE: Record<string, string> = { "image/jpeg": "jpg", "image/svg+xml": "svg" };

// pastedImageFilename names a pasted image `pasted-YYYYMMDD-HHmmss.<ext>` in local time.
export const pastedImageFilename = (file: File, now: Date): string => {
  const pad = (value: number) => String(value).padStart(2, "0");
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const extension = EXTENSION_BY_TYPE[file.type] ?? file.type.replace(/^image\//, "");
  return `pasted-${date}-${time}.${extension}`;
};

const PLACEHOLDER_PREFIX = "![Uploading…](memos-upload://";
const placeholderText = (token: string) => `${PLACEHOLDER_PREFIX}${token})`;
const ENDS_WITH_PLACEHOLDER = /!\[Uploading…\]\(memos-upload:\/\/[^)\s]+\)$/;

// insertUploadPlaceholders replaces `from`–`to` with one placeholder per token, one per line, and
// puts the cursor after the last one. A placeholder is found again by its token, so it follows
// any edit made while its upload runs.
export const insertUploadPlaceholders = (state: EditorState, tokens: string[], from: number, to = from): TransactionSpec => {
  const insert = tokens.map(placeholderText).join("\n");
  return {
    changes: { from, to, insert },
    selection: EditorSelection.cursor(from + insert.length),
    scrollIntoView: true,
    userEvent: "input.paste",
    annotations: isolateHistory.of("full"),
  };
};

// replaceUploadPlaceholder swaps the placeholder for `token` with `markdown`, or removes it (with
// the line break that joined it to a sibling placeholder) when `markdown` is empty. Returns the
// transactions to dispatch in order, or null when the user already deleted the placeholder.
//
// The placeholder is removed outside the undo history and the image is inserted as its own
// history event, so one undo removes the image and nothing typed around it.
export const replaceUploadPlaceholder = (state: EditorState, token: string, markdown: string): TransactionSpec[] | null => {
  const doc = state.doc.toString();
  let from = doc.indexOf(placeholderText(token));
  if (from < 0) return null;
  let to = from + placeholderText(token).length;
  const removal: TransactionSpec = { annotations: Transaction.addToHistory.of(false) };
  if (markdown) {
    const cursor = state.selection.main;
    return [
      { ...removal, changes: { from, to } },
      {
        changes: { from, insert: markdown },
        // The cursor right after the placeholder stays right after the image.
        ...(cursor.empty && cursor.head === to ? { selection: EditorSelection.cursor(from + markdown.length) } : {}),
        userEvent: "input.paste",
        annotations: isolateHistory.of("full"),
      },
    ];
  }
  if (doc[to] === "\n" && doc.startsWith(PLACEHOLDER_PREFIX, to + 1)) to += 1;
  else if (doc[from - 1] === "\n" && ENDS_WITH_PLACEHOLDER.test(doc.slice(0, from - 1))) from -= 1;
  return [{ ...removal, changes: { from, to } }];
};

// inlineImageMarkdown is the reference inserted for an uploaded image: site-relative, empty alt.
export const inlineImageMarkdown = (resource: Resource) => `![](/file/${resource.name}/${encodeURI(resource.filename)})`;

export interface InlineImageUpload {
  file: File;
  // The name the resource is created with (pasted images are renamed; dropped ones keep theirs).
  filename: string;
}

// uploadInlineImages inserts a placeholder per image at `from`–`to` (in order), uploads the images
// concurrently, and replaces each placeholder with its image reference, or removes it and reports
// the error. Resolves with the created resources once every upload has settled.
export const uploadInlineImages = async (
  view: EditorView,
  uploads: InlineImageUpload[],
  range: { from: number; to: number },
  upload: (file: File, filename: string) => Promise<Resource>,
  onError: (error: unknown) => void,
): Promise<Resource[]> => {
  const tokens = uploads.map(() => generateUUID());
  view.dispatch(insertUploadPlaceholders(view.state, tokens, range.from, range.to));
  const results = await Promise.all(
    uploads.map(async ({ file, filename }, index) => {
      let resource: Resource | undefined;
      try {
        resource = await upload(file, filename);
      } catch (error) {
        onError(error);
      }
      for (const spec of replaceUploadPlaceholder(view.state, tokens[index], resource ? inlineImageMarkdown(resource) : "") ?? []) {
        view.dispatch(spec);
      }
      return resource;
    }),
  );
  return results.filter((resource): resource is Resource => resource !== undefined);
};

export interface DropPlan {
  uploads: InlineImageUpload[];
  attachments: File[];
  // Where the inline images go: the drop position, or the selection when it is unknown.
  range: { from: number; to: number };
}

// planDrop decides what dropping `files` does. Images become inline images at `dropPos` (from
// `posAtCoords`; null when the drop missed the text, e.g. on the attachment list) and keep their
// names; other files become attachments. Returns null when nothing was dropped.
export const planDrop = (state: EditorState, files: File[], dropPos: number | null): DropPlan | null => {
  const action = classifyTransfer("", files);
  if (action.kind !== "files") return null;
  const { from, to } = state.selection.main;
  return {
    uploads: action.images.map((file) => ({ file, filename: file.name })),
    attachments: action.attachments,
    range: dropPos === null ? { from, to } : { from: dropPos, to: dropPos },
  };
};

const setUploadAnchor = StateEffect.define<number | null>();

// uploadAnchorField remembers where the slash menu's "Upload image" was picked, mapped through the
// edits made while the file picker is open.
export const uploadAnchorField = StateField.define<number | null>({
  create: () => null,
  update: (anchor, tr) => {
    for (const effect of tr.effects) if (effect.is(setUploadAnchor)) return effect.value;
    return anchor === null ? null : tr.changes.mapPos(anchor);
  },
});

// startSlashUpload replaces the typed `/query` and anchors the upload at its position.
export const startSlashUpload = (from: number, to: number): TransactionSpec => ({
  changes: { from, to },
  selection: EditorSelection.cursor(from),
  effects: setUploadAnchor.of(from),
  userEvent: "input.complete",
});

// takeUploadAnchor clears the anchor; the returned position is read from the state before it.
export const takeUploadAnchor = (state: EditorState): { position: number | null; spec: TransactionSpec } => ({
  position: state.field(uploadAnchorField, false) ?? null,
  spec: { effects: setUploadAnchor.of(null) },
});
