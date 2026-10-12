import { StateCommand } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import clsx from "clsx";
import {
  BoldIcon,
  CircleHelpIcon,
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
  Table2Icon,
  TableIcon,
  TextQuoteIcon,
} from "lucide-react";
import { ReactNode, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { Translations, useTranslate } from "@/utils/i18n";
import { insertCodeBlock, insertLink, toggleLinePrefix, toggleWrap } from "../Editor/commands";
import { formatTable, insertTable } from "../Editor/tableCommands";
import TablePicker from "./TablePicker";

type FormatCommand = StateCommand | ((view: EditorView) => boolean);

export interface FormatAction {
  /** i18n key suffix under `editor.format.` */
  id: string;
  icon: LucideIcon;
  /** Runs against the editor view; pure `StateCommand`s from `Editor/commands.ts` fit directly. */
  run?: FormatCommand;
  /** Instead of `run`: the button opens a popover; call `apply` with the command to run, which closes it. */
  popover?: (apply: (command: FormatCommand) => void) => ReactNode;
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
  { id: "table", icon: TableIcon, popover: (apply) => <TablePicker onPick={(rows, cols) => apply(insertTable(rows, cols))} /> },
  // Also Mod-Shift-f in the editor (see `extensions.ts`). Does nothing outside a table.
  { id: "format-table", icon: Table2Icon, run: formatTable },
];

interface Props {
  className?: string;
  getView: () => EditorView | null;
  previewing: boolean;
  onPreviewChange: (previewing: boolean) => void;
}

const FormatBar = ({ className, getView, previewing, onPreviewChange }: Props) => {
  const t = useTranslate();

  const runCommand = (command: FormatCommand) => {
    const view = getView();
    if (!view) return;
    command(view);
    view.focus();
  };

  return (
    <div
      className={clsx("w-full flex flex-row items-center gap-1 px-2 pt-1.5 pb-1 border-b border-gray-100 dark:border-zinc-700", className)}
      // Keep the editor focused while clicking the bar, so the bar doesn't hide itself.
      // React events bubble through portals, so this also covers popover content.
      onMouseDown={(e) => e.preventDefault()}
      onFocus={(e) => e.stopPropagation()}
    >
      <div className="flex-1 min-w-0 flex flex-row flex-wrap items-center gap-0.5">
        {formatActions.map((action) => {
          const label = t(`editor.format.${action.id}` as Translations);
          const button = (
            <button
              key={action.id}
              type="button"
              className="shrink-0 p-1 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-transparent"
              title={label}
              aria-label={label}
              disabled={previewing}
              onClick={action.run && (() => runCommand(action.run!))}
            >
              <action.icon className="w-4 h-4" />
            </button>
          );
          return action.popover ? <FormatPopover key={action.id} trigger={button} content={action.popover} onApply={runCommand} /> : button;
        })}
      </div>
      <a
        className="shrink-0 p-1 rounded text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-zinc-700"
        href="https://www.usememos.com/docs/usage/writing-markdown"
        target="_blank"
        rel="noopener noreferrer"
        title={t("editor.format.syntax-help")}
        aria-label={t("editor.format.syntax-help")}
      >
        <CircleHelpIcon className="w-4 h-4" />
      </a>
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

interface FormatPopoverProps {
  trigger: ReactNode;
  content: NonNullable<FormatAction["popover"]>;
  onApply: (command: FormatCommand) => void;
}

const FormatPopover = ({ trigger, content, onApply }: FormatPopoverProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      {/* The editor keeps focus while the popover is open: no auto focus (focus leaving the container hides the bar),
          and editor focus changes must not dismiss it. Outside clicks and Escape still close it. */}
      <PopoverContent
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
      >
        {content((command) => {
          setOpen(false);
          onApply(command);
        })}
      </PopoverContent>
    </Popover>
  );
};

export default FormatBar;
