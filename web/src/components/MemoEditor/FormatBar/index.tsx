import { StateCommand } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import clsx from "clsx";
import {
  BoldIcon,
  CodeIcon,
  HeadingIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  LucideIcon,
  SigmaIcon,
  SquareCodeIcon,
  StrikethroughIcon,
  TextQuoteIcon,
} from "lucide-react";
import { Translations, useTranslate } from "@/utils/i18n";
import { insertCodeBlock, insertLink, toggleLinePrefix, toggleWrap } from "../Editor/commands";

export interface FormatAction {
  /** i18n key suffix under `editor.format.` */
  id: string;
  icon: LucideIcon;
  /** Runs against the editor view; pure `StateCommand`s from `Editor/commands.ts` fit directly. */
  run: StateCommand | ((view: EditorView) => boolean);
}

/** Format bar buttons, in display order. Add a button by appending an entry. */
export const formatActions: FormatAction[] = [
  { id: "heading", icon: HeadingIcon, run: toggleLinePrefix("heading") },
  { id: "bold", icon: BoldIcon, run: toggleWrap("**", "text") },
  { id: "italic", icon: ItalicIcon, run: toggleWrap("*", "text") },
  { id: "strikethrough", icon: StrikethroughIcon, run: toggleWrap("~~", "text") },
  { id: "quote", icon: TextQuoteIcon, run: toggleLinePrefix("quote") },
  { id: "bullet-list", icon: ListIcon, run: toggleLinePrefix("bullet") },
  { id: "ordered-list", icon: ListOrderedIcon, run: toggleLinePrefix("ordered") },
  { id: "task", icon: ListTodoIcon, run: toggleLinePrefix("task") },
  { id: "inline-code", icon: CodeIcon, run: toggleWrap("`", "code") },
  { id: "code-block", icon: SquareCodeIcon, run: insertCodeBlock },
  { id: "link", icon: LinkIcon, run: insertLink() },
  { id: "math", icon: SigmaIcon, run: toggleWrap("$", "x^2") },
];

interface Props {
  className?: string;
  getView: () => EditorView | null;
  previewing: boolean;
  onPreviewChange: (previewing: boolean) => void;
}

const FormatBar = ({ className, getView, previewing, onPreviewChange }: Props) => {
  const t = useTranslate();

  const runAction = (action: FormatAction) => {
    const view = getView();
    if (!view) return;
    action.run(view);
    view.focus();
  };

  return (
    <div
      className={clsx("w-full flex flex-row items-center gap-1 px-2 pt-1.5 pb-1 border-b border-gray-100 dark:border-zinc-700", className)}
      // Keep the editor focused while clicking the bar, so the bar doesn't hide itself.
      onMouseDown={(e) => e.preventDefault()}
      onFocus={(e) => e.stopPropagation()}
    >
      <div className="flex-1 min-w-0 flex flex-row items-center gap-0.5 overflow-x-auto scrollbar-hide">
        {formatActions.map((action) => (
          <button
            key={action.id}
            type="button"
            className="shrink-0 p-1 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-transparent"
            title={t(`editor.format.${action.id}` as Translations)}
            aria-label={t(`editor.format.${action.id}` as Translations)}
            disabled={previewing}
            onClick={() => runAction(action)}
          >
            <action.icon className="w-4 h-4" />
          </button>
        ))}
      </div>
      <div className="shrink-0 flex flex-row items-center text-xs rounded border border-gray-200 dark:border-zinc-600 overflow-hidden">
        {[false, true].map((preview) => (
          <button
            key={String(preview)}
            type="button"
            aria-pressed={previewing === preview}
            className={clsx(
              "px-2 py-0.5",
              previewing === preview
                ? "bg-gray-100 text-gray-800 dark:bg-zinc-700 dark:text-gray-200"
                : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-zinc-700/50",
            )}
            onClick={() => onPreviewChange(preview)}
          >
            {preview ? t("common.preview") : t("common.edit")}
          </button>
        ))}
      </div>
    </div>
  );
};

export default FormatBar;
