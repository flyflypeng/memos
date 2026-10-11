import { Divider } from "@mui/joy";
import clsx from "clsx";
import type { Element, ElementContent } from "hast";
import type { ExtraProps } from "hast-util-to-jsx-runtime";
import { toString } from "hast-util-to-string";
import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useRef,
  type ComponentPropsWithoutRef,
  type ComponentType,
  type ReactNode,
} from "react";
import { PhotoView } from "react-photo-view";
import Checkbox from "@/components/ui/Checkbox";
import { useScrollMask } from "@/hooks/useScrollMask";
import { useMemoStore } from "@/store/v1";
import Code from "../Code";
import CodeBlock from "../CodeBlock";
import Link from "../Link";
import Math from "../Math";
import { RendererContext } from "../types";
import { memosElementComponents } from "./registry";
import { toggleTask } from "./tasks";

// Tag name used in hast for MemosElement nodes (see plugin.ts).
export const MEMOS_ELEMENT_TAG = "memos-element";

type Props<Tag extends keyof JSX.IntrinsicElements> = ComponentPropsWithoutRef<Tag> & ExtraProps;

const isWhitespace = (node: ElementContent) => node.type === "text" && node.value.trim() === "";
const isElement = (node: ElementContent | undefined, tagName: string): node is Element =>
  node?.type === "element" && node.tagName === tagName;

// Images in an image group render as a row of thumbnails.
const ImageGroupContext = createContext(false);

// A paragraph of two or more images, separated only by line breaks, is an image group.
const Paragraph = ({ node, children }: Props<"p">) => {
  const content = node?.children ?? [];
  const images = content.filter((child) => isElement(child, "img"));
  const isImageGroup =
    images.length > 1 && content.every((child) => isElement(child, "img") || isElement(child, "br") || isWhitespace(child));
  const paragraphRef = useRef<HTMLParagraphElement>(null);
  const { ScrollMask } = useScrollMask(isImageGroup ? paragraphRef : { current: null });

  if (!isImageGroup) {
    return <p>{children}</p>;
  }
  return (
    <p ref={paragraphRef} className="relative flex gap-1 overflow-x-auto scrollbar-hide">
      <ScrollMask />
      <ImageGroupContext.Provider value={true}>
        {images.map((image, index) => (
          <Image key={index} src={String(image.properties.src ?? "")} alt={String(image.properties.alt ?? "")} />
        ))}
      </ImageGroupContext.Provider>
    </p>
  );
};

const MEMOS_RESOURCE_PATH = /^\/file\/resources\/\d+\/[^?#]+$/;

const Image = ({ src = "", alt }: Props<"img">) => {
  const inImageGroup = useContext(ImageGroupContext);
  const path = src.startsWith(window.location.origin) ? src.slice(window.location.origin.length) : src;
  const thumbnail = inImageGroup && MEMOS_RESOURCE_PATH.test(path);
  return (
    <PhotoView src={src}>
      <img
        src={thumbnail ? `${src}?thumbnail=true` : src}
        alt={alt}
        decoding="async"
        loading="lazy"
        className={clsx("cursor-pointer object-contain", inImageGroup ? "h-[15rem] max-w-none" : "inline-block max-w-full max-h-[60vh]")}
        onClick={(e) => e.stopPropagation()}
      />
    </PhotoView>
  );
};

const languageOf = (node: Element | undefined) => {
  const classNames = node?.properties.className;
  const languageClass = Array.isArray(classNames) ? classNames.map(String).find((name) => name.startsWith("language-")) : undefined;
  return languageClass?.slice("language-".length) ?? "";
};

// Fenced code: `math` (including `$$` blocks) is display math; everything else, mermaid and
// __html included, goes to CodeBlock.
const Pre = ({ node }: Props<"pre">) => {
  const code = node?.children.find((child): child is Element => isElement(child, "code"));
  const content = code ? toString(code).replace(/\n$/, "") : "";
  if (languageOf(code) === "math") {
    return <Math content={content} block />;
  }
  return <CodeBlock language={languageOf(code)} content={content} />;
};

const InlineCode = ({ node }: Props<"code">) => {
  const content = node ? toString(node) : "";
  return languageOf(node) === "math" ? <Math content={content} /> : <Code content={content} />;
};

const HEADING_CLASS: Record<string, string> = {
  h1: "text-5xl leading-normal font-bold",
  h2: "text-3xl leading-normal font-medium",
  h3: "text-xl leading-normal font-medium",
  h4: "text-lg font-bold",
};

const Heading = ({ node, children }: Props<"h1">) => {
  const Tag = (node?.tagName ?? "h1") as "h1";
  return <Tag className={HEADING_CLASS[Tag]}>{children}</Tag>;
};

const Table = ({ children }: Props<"table">) => (
  <div className="w-full max-w-full overflow-x-auto my-1">
    {/* break-normal: the content's overflow-wrap:anywhere would squeeze columns to one character instead of scrolling. */}
    <table className="w-auto my-0 break-normal border border-gray-300 dark:border-zinc-600 divide-y divide-gray-300 dark:divide-zinc-600">
      {children}
    </table>
  </div>
);

const UnorderedList = ({ children, className }: Props<"ul">) => (
  <ul className={clsx(String(className).includes("contains-task-list") && "ps-1")}>{children}</ul>
);

const OrderedList = ({ children, className, start }: Props<"ol">) => (
  <ol className={clsx(String(className).includes("contains-task-list") && "ps-1")} start={start}>
    {children}
  </ol>
);

// Task list item: `taskMarkerOffset` is the source offset of its `[ ]`/`[x]` marker in the Memo content.
interface TaskState {
  checked: boolean;
  markerOffset: number;
}
const TaskContext = createContext<TaskState | undefined>(undefined);

// The offset comes through the HTML stage (rehype-raw), which stringifies it.
const ListItem = ({ children, className, taskMarkerOffset }: Props<"li"> & { taskMarkerOffset?: number | string }) => {
  if (taskMarkerOffset === undefined) {
    return <li>{children}</li>;
  }
  const checked = String(className).includes("task-list-item-checked");
  // Strike through the task's own text only, not the nested lists after it.
  const content = Children.toArray(children);
  const nestedListIndex = content.findIndex(
    (child) => isValidElement(child) && (child.type === UnorderedList || child.type === OrderedList),
  );
  const ownContent = nestedListIndex === -1 ? content : content.slice(0, nestedListIndex);
  return (
    <li className="list-none">
      <TaskContext.Provider value={{ checked, markerOffset: Number(taskMarkerOffset) }}>
        <div className={clsx(checked && "line-through opacity-80")}>{ownContent}</div>
        {nestedListIndex === -1 ? null : content.slice(nestedListIndex)}
      </TaskContext.Provider>
    </li>
  );
};

const TaskCheckbox = ({ checked }: Props<"input">) => {
  const task = useContext(TaskContext);
  const context = useContext(RendererContext);
  const updateMemo = useMemoStore((state) => state.updateMemo);
  const editable = task !== undefined && !context.readonly && context.memoName !== undefined;

  const handleChange = async (on: boolean) => {
    if (!editable) {
      return;
    }
    await updateMemo({ name: context.memoName, content: toggleTask(context.content, task.markerOffset, on) }, ["content"]);
  };

  return (
    <span className="inline-flex align-middle mr-1.5 -mt-0.5">
      <Checkbox
        size="sm"
        checked={task?.checked ?? Boolean(checked)}
        disabled={!editable}
        data-task-marker-offset={task?.markerOffset}
        onChange={(e) => handleChange(e.target.checked)}
      />
    </span>
  );
};

const MemosElementRenderer = ({ memosName, memosProps, children }: { memosName: string; memosProps: string; children?: ReactNode }) => {
  // Props were written by the plugin that registered this component, so they match its prop types.
  const Component = memosElementComponents.get(memosName) as ComponentType<Record<string, unknown>> | undefined;
  if (!Component) {
    return <>{children}</>;
  }
  return <Component {...JSON.parse(memosProps)}>{children}</Component>;
};

export const standardComponents = {
  p: Paragraph,
  img: Image,
  a: ({ href = "", children }: Props<"a">) => <Link url={href} text={children} />,
  pre: Pre,
  code: InlineCode,
  h1: Heading,
  h2: Heading,
  h3: Heading,
  h4: Heading,
  h5: Heading,
  h6: Heading,
  blockquote: ({ children }: Props<"blockquote">) => (
    <blockquote className="not-italic pl-3 border-l-2 border-gray-400 dark:border-gray-600 text-gray-600 dark:text-gray-400 text-sm leading-relaxed font-serif font-normal [&>p]:before:content-none [&>p]:after:content-none">
      {children}
    </blockquote>
  ),
  hr: () => <Divider className="!my-3" />,
  table: Table,
  tr: ({ children }: Props<"tr">) => <tr className="divide-x divide-gray-300 dark:divide-zinc-600">{children}</tr>,
  th: ({ children, style }: Props<"th">) => (
    <th className="py-1 px-2 text-sm font-medium leading-5 text-gray-900 dark:text-gray-400" style={{ textAlign: "left", ...style }}>
      {children}
    </th>
  ),
  td: ({ children, style }: Props<"td">) => (
    <td className="py-1 px-2 text-sm leading-5 text-gray-900 dark:text-gray-400" style={style}>
      {children}
    </td>
  ),
  ul: UnorderedList,
  ol: OrderedList,
  li: ListItem,
  input: TaskCheckbox,
  [MEMOS_ELEMENT_TAG]: MemosElementRenderer,
};
