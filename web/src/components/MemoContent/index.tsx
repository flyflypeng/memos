import clsx from "clsx";
import { memo, useLayoutEffect, useMemo, useRef } from "react";
import { PhotoProvider } from "react-photo-view";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemoStore } from "@/store/v1";
import { useTranslate } from "@/utils/i18n";
import { isSuperUser } from "@/utils/user";
import { renderMemoMarkdown } from "./markdown/pipeline";
import { RendererContext } from "./types";

// MAX_DISPLAY_HEIGHT is the maximum height of the memo content to display when collapsed.
export const MAX_DISPLAY_HEIGHT = 256;

interface Props {
  // Memo content (the raw markdown), rendered in the browser.
  content: string;
  memoName?: string;
  readonly?: boolean;
  disableFilter?: boolean;
  // embeddedMemos is a set of memo resource names that are embedded in the current memo.
  // This is used to prevent infinite loops when a memo embeds itself.
  embeddedMemos?: Set<string>;
  className?: string;
  contentClassName?: string;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  parentPage?: string;
  disablePhotoProvider?: boolean;
  // Collapse control
  enableCollapse?: boolean;
  collapsible?: boolean;
  isCollapsed?: boolean;
  onCollapsibleChange?: (collapsible: boolean) => void;
  onToggleCollapse?: () => void;
}

const MemoContent = (props: Props) => {
  const {
    className,
    contentClassName,
    content: memoContent,
    memoName,
    embeddedMemos,
    onClick,
    onDoubleClick,
    enableCollapse,
    collapsible,
    isCollapsed,
    onCollapsibleChange,
    onToggleCollapse,
  } = props;
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const memoStore = useMemoStore();
  const memoContentContainerRef = useRef<HTMLDivElement>(null);
  const memoObj = memoName ? memoStore.getMemoByName(memoName) : null;
  const allowEdit = !props.readonly && memoObj && (currentUser?.name === memoObj.creator || isSuperUser(currentUser));

  // Detect if content needs collapse based on height.
  // useLayoutEffect ensures cleanup (observer disconnect) runs synchronously after DOM commit
  // but before ResizeObserver callbacks are delivered, preventing a race condition where the
  // observer fires after line-clamp is applied and incorrectly reports a short height.
  useLayoutEffect(() => {
    if (!enableCollapse || !onCollapsibleChange || !memoContentContainerRef.current) {
      return;
    }

    // Already collapsed, no need to monitor height
    if (isCollapsed === true) {
      return;
    }

    const element = memoContentContainerRef.current;

    const checkHeight = () => {
      const height = element.scrollHeight;
      onCollapsibleChange(height > MAX_DISPLAY_HEIGHT);
    };

    checkHeight();

    const resizeObserver = new ResizeObserver(checkHeight);
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, [enableCollapse, onCollapsibleChange, isCollapsed]);

  const handleMemoContentClick = async (e: React.MouseEvent) => {
    if (onClick) {
      onClick(e);
    }
  };

  const handleMemoContentDoubleClick = async (e: React.MouseEvent) => {
    if (onDoubleClick) {
      onDoubleClick(e);
    }
  };

  const renderedMarkdown = useMemo(() => renderMemoMarkdown(memoContent), [memoContent]);

  const content = (
    <div
      className={`prose prose-sm prose-neutral max-w-none dark:prose-invert
          prose-p:my-0.5 prose-blockquote:my-1.5 prose-pre:my-0
          prose-li:my-0.5
          prose-h1:mb-2 prose-h1:mt-3
          prose-h2:mb-2 prose-h2:mt-2.5
          prose-h3:mb-1.5 prose-h3:mt-2
          prose-h4:mb-1 prose-h4:mt-1.5
          prose-img:m-0
          [&_li_p]:my-0
          [&_dl]:my-1.5
          [&_pre_code]:text-[#24292e] dark:[&_pre_code]:text-[#abb2bf]
          [&_code]:before:content-none [&_code]:after:content-none
          w-full flex flex-col justify-start items-start ${className || ""}`}
    >
      <div
        ref={memoContentContainerRef}
        className={clsx("relative w-full max-w-full word-break", isCollapsed && "line-clamp-6 max-h-60", contentClassName)}
        onClick={handleMemoContentClick}
        onDoubleClick={handleMemoContentDoubleClick}
      >
        {renderedMarkdown}
        {isCollapsed && (
          <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-b from-transparent dark:to-zinc-800 to-white pointer-events-none"></div>
        )}
      </div>
      {collapsible && onToggleCollapse && (
        <span
          className="text-xs cursor-pointer select-none text-primary dark:text-primary hover:text-primary-dark dark:hover:text-primary-dark"
          onClick={onToggleCollapse}
        >
          {isCollapsed ? t("memo.show-more") : t("memo.show-less")}
        </span>
      )}
    </div>
  );

  return (
    <RendererContext.Provider
      value={{
        content: memoContent,
        memoName: memoName,
        readonly: !allowEdit,
        disableFilter: props.disableFilter,
        embeddedMemos: embeddedMemos || new Set(),
        parentPage: props.parentPage,
      }}
    >
      {props.disablePhotoProvider ? content : <PhotoProvider>{content}</PhotoProvider>}
    </RendererContext.Provider>
  );
};

export default memo(MemoContent);
