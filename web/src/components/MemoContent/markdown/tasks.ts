import type { ListItem } from "mdast";
import { visit } from "unist-util-visit";
import { parseMemoMarkdown } from "./pipeline";

const completedTasks = (content: string) => {
  const tasks: ListItem[] = [];
  visit(parseMemoMarkdown(content), "listItem", (item: ListItem) => {
    if (item.checked) tasks.push(item);
  });
  return tasks;
};

// toggleTask returns the Memo content with the task marker at `markerOffset` (the `[` of its
// `[ ]`/`[x]`) set to `checked`. Every other character is kept as is.
export const toggleTask = (content: string, markerOffset: number, checked: boolean): string =>
  content.slice(0, markerOffset + 1) + (checked ? "x" : " ") + content.slice(markerOffset + 2);

export const hasCompletedTasks = (content: string): boolean => completedTasks(content).length > 0;

// removeCompletedTasks deletes the lines of every completed task (its marker line through the end
// of its own text); nested items and all other lines are kept as is.
export const removeCompletedTasks = (content: string): string => {
  const ranges = completedTasks(content).map((item) => {
    const start = item.position!.start.offset!;
    // A task's own text is its first child; nested lists come after it.
    const ownEnd = item.children[0]?.position?.end.offset ?? start;
    const lineStart = content.lastIndexOf("\n", start - 1) + 1;
    const newline = content.indexOf("\n", ownEnd);
    return [lineStart, newline === -1 ? content.length : newline + 1] as const;
  });
  let result = content;
  for (const [from, to] of ranges.reverse()) {
    // The last line has no newline of its own, so drop the one that ends the line before it.
    const lineBreakBefore = to === result.length && from > 0 ? (result[from - 2] === "\r" ? 2 : 1) : 0;
    result = result.slice(0, from - lineBreakBefore) + result.slice(to);
  }
  return result;
};
