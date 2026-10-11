import { EditorSelection, EditorState, Transaction } from "@codemirror/state";
import { EditorView, placeholder as placeholderExt } from "@codemirror/view";
import clsx from "clsx";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { memoServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemoTagList } from "@/store/v1";
import { MemoView } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";
import { insertTextSpec } from "./commands";
import { memoCompletionSource, tagCompletionSource } from "./completions";
import { createEditorExtensions, placeholderCompartment } from "./extensions";
import { startSlashUpload, uploadAnchorField } from "./inlineImages";
import { embedMemoItem, slashBlockItems, slashCompletionSource } from "./slashCommands";

export interface EditorRefActions {
  getEditor: () => EditorView | null;
  focus: FunctionType;
  scrollToCursor: FunctionType;
  insertText: (text: string, prefix?: string, suffix?: string) => void;
  removeText: (start: number, length: number) => void;
  setContent: (text: string) => void;
  getContent: () => string;
  getSelectedContent: () => string;
  getCursorPosition: () => number;
  setCursorPosition: (startPos: number, endPos?: number) => void;
  getCursorLineNumber: () => number;
  getLine: (lineNumber: number) => string;
  setLine: (lineNumber: number, text: string) => void;
}

interface Props {
  className?: string;
  contentClassName?: string;
  initialContent: string;
  placeholder: string;
  markdownShortcutsEnabled: boolean;
  onContentChange: (content: string) => void;
  /** Return true when the paste was handled; CodeMirror then skips its default insertion. */
  onPaste: (event: ClipboardEvent, view: EditorView) => boolean;
  /** Slash menu "Upload image" was picked; the position is anchored in `uploadAnchorField`. */
  onSlashUploadImage: (view: EditorView) => void;
}

const Editor = forwardRef(function Editor(props: Props, ref: React.ForwardedRef<EditorRefActions>) {
  const { className, contentClassName, initialContent, placeholder } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const t = useTranslate();
  // Extensions are built once; they read the latest props/data through this ref.
  const latest = useRef({ props, tags: [] as string[], userName: "", t });
  latest.current.props = props;
  latest.current.t = t;
  latest.current.tags = Object.entries(useMemoTagList())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);
  latest.current.userName = useCurrentUser()?.name ?? "";

  useEffect(() => {
    const view = new EditorView({
      parent: containerRef.current!,
      state: EditorState.create({
        doc: initialContent,
        extensions: [
          uploadAnchorField,
          createEditorExtensions({
            placeholder,
            markdownShortcutsEnabled: () => latest.current.props.markdownShortcutsEnabled,
            completionSources: [
              tagCompletionSource(() => latest.current.tags),
              memoCompletionSource(async (query) => {
                const userName = latest.current.userName;
                if (!userName) return [];
                const filters = [`creator == "${userName}"`, `row_status == "NORMAL"`];
                if (query) filters.push(`content_search == [${JSON.stringify(query)}]`);
                const { memos } = await memoServiceClient.listMemos({
                  pageSize: 8,
                  filter: filters.join(" && "),
                  view: MemoView.MEMO_VIEW_FULL,
                });
                return memos.map((memo) => ({
                  uid: memo.uid,
                  label: (memo.snippet || memo.content.slice(0, 80)).replace(/\s+/g, " "),
                  detail: memo.createTime?.toLocaleString(),
                }));
              }),
              slashCompletionSource(() => [
                ...slashBlockItems((id) => latest.current.t(`editor.slash.${id}`)),
                embedMemoItem(latest.current.t("editor.slash.embed-memo")),
                {
                  id: "upload-image",
                  label: latest.current.t("editor.slash.upload-image"),
                  detail: "![]()",
                  keywords: ["image", "upload", "picture", "photo", "img"],
                  run: (view, from, to) => {
                    view.dispatch(startSlashUpload(from, to));
                    latest.current.props.onSlashUploadImage(view);
                  },
                },
              ]),
            ],
            onDocChange: (content) => latest.current.props.onContentChange(content),
            onPaste: (event, view) => latest.current.props.onPaste(event, view),
            // Files dropped on the editor are uploaded by the MemoEditor container; keep CodeMirror
            // from inserting their text content.
            onDrop: (event) => {
              if (!event.dataTransfer?.files.length) return false;
              event.preventDefault();
              return true;
            },
          }),
        ],
      }),
    });
    viewRef.current = view;
    if (initialContent) props.onContentChange(initialContent);
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: placeholderCompartment.reconfigure(placeholderExt(placeholder)) });
  }, [placeholder]);

  useImperativeHandle(ref, () => {
    const dispatch = (spec: Parameters<EditorView["dispatch"]>[0]) => viewRef.current?.dispatch(spec);
    const state = () => viewRef.current?.state;
    return {
      getEditor: () => viewRef.current,
      focus: () => viewRef.current?.focus(),
      scrollToCursor: () => {
        const view = viewRef.current;
        if (view) view.dispatch({ effects: EditorView.scrollIntoView(view.state.selection.main.head, { y: "nearest" }) });
      },
      insertText: (text = "", prefix = "", suffix = "") => {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch(insertTextSpec(view.state, text, prefix, suffix));
        view.focus();
      },
      removeText: (start: number, length: number) => {
        dispatch({ changes: { from: start, to: start + length }, selection: EditorSelection.cursor(start), userEvent: "delete" });
        viewRef.current?.focus();
      },
      setContent: (text: string) => {
        const current = state();
        if (!current) return;
        // Loading content (draft, memo, reset) is not an edit the user should be able to undo.
        dispatch({
          changes: { from: 0, to: current.doc.length, insert: text },
          selection: EditorSelection.cursor(text.length),
          annotations: Transaction.addToHistory.of(false),
        });
      },
      getContent: () => state()?.doc.toString() ?? "",
      getSelectedContent: () => {
        const current = state();
        return current ? current.sliceDoc(current.selection.main.from, current.selection.main.to) : "";
      },
      getCursorPosition: () => state()?.selection.main.from ?? 0,
      setCursorPosition: (startPos: number, endPos?: number) => {
        dispatch({ selection: EditorSelection.range(startPos, isNaN(endPos as number) ? startPos : (endPos as number)) });
      },
      getCursorLineNumber: () => {
        const current = state();
        return current ? current.doc.lineAt(current.selection.main.from).number - 1 : 0;
      },
      getLine: (lineNumber: number) => {
        const current = state();
        if (!current || lineNumber < 0 || lineNumber >= current.doc.lines) return "";
        return current.doc.line(lineNumber + 1).text;
      },
      setLine: (lineNumber: number, text: string) => {
        const current = state();
        if (!current || lineNumber < 0 || lineNumber >= current.doc.lines) return;
        const line = current.doc.line(lineNumber + 1);
        dispatch({ changes: { from: line.from, to: line.to, insert: text }, userEvent: "input" });
        viewRef.current?.focus();
      },
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={clsx(
        "memo-editor-cm relative w-full h-auto max-h-[50vh] flex flex-col bg-inherit dark:text-gray-300",
        className,
        contentClassName,
      )}
    />
  );
});

export default Editor;
