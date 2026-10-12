import clsx from "clsx";
import { QuoteIcon } from "lucide-react";
import { useContext, useMemo } from "react";
import MemoResourceListView from "@/components/MemoResourceListView";
import Tooltip from "@/components/ui/Tooltip";
import useNavigateTo from "@/hooks/useNavigateTo";
import { useMemoStore } from "@/store/v1";
import { useTranslate } from "@/utils/i18n";
import MemoContent from "../..";
import { RendererContext } from "../../types";
import { memoAttachments } from "../resourceReferences";
import EmbedError from "./EmbedError";
import { usePendingFetch } from "./usePendingFetch";

interface Props {
  uid: string;
  // Query-style options after `?`: `snippet` shows the memo snippet, `inline` drops the card.
  params: string;
}

// `![[memos/uid]]`: renders the embedded memo's content with the same renderer, inside a card.
const EmbeddedMemo = ({ uid, params }: Props) => {
  const t = useTranslate();
  const context = useContext(RendererContext);
  const navigateTo = useNavigateTo();
  const fetchMemoByUid = useMemoStore((state) => state.fetchMemoByUid);
  const memo = useMemoStore((state) => state.memoMapByUid[uid]);
  const pending = usePendingFetch(uid, memo, fetchMemoByUid);

  // The memos on the path from the outermost memo down to this embed, by memo name. The embedded
  // memo renders with its own name as memoName, so its embeds see the whole path; a memo already
  // on the path is not rendered again, which stops self and cyclic embeds.
  const ancestors = useMemo(
    () => (context.memoName ? new Set([...context.embeddedMemos, context.memoName]) : context.embeddedMemos),
    [context.embeddedMemos, context.memoName],
  );

  if (pending) {
    return (
      <div className="w-full px-2 py-1.5 rounded-md bg-zinc-50 dark:bg-zinc-900 text-xs border border-gray-200 dark:border-zinc-700 animate-pulse">
        <div className="h-2.5 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-1.5" />
        <div className="h-2.5 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-1.5" />
        <div className="h-2.5 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    );
  }
  if (!memo) {
    return <EmbedError message={`Memo not found: ${uid}`} />;
  }

  const options = new URLSearchParams(params);
  const useSnippet = options.has("snippet");
  const inlineMode = options.has("inline");
  if (!useSnippet && (memo.name === context.memoName || context.embeddedMemos.has(memo.name))) {
    return <EmbedError message={`Nested Rendering Error: ![[memos/${uid}]]`} />;
  }

  const content = useSnippet ? (
    <div className={clsx("text-gray-800 dark:text-gray-400", !inlineMode && "line-clamp-3")}>{memo.snippet}</div>
  ) : (
    <>
      <MemoContent
        content={memo.content}
        memoName={memo.name}
        embeddedMemos={ancestors}
        contentClassName={inlineMode ? "" : "line-clamp-3"}
        parentPage={context.parentPage}
      />
      <MemoResourceListView resources={memoAttachments(memo)} />
    </>
  );
  if (inlineMode) {
    return <div className="w-full">{content}</div>;
  }
  return (
    <div className="w-full px-2 py-1.5 rounded-md bg-zinc-50 dark:bg-zinc-900 text-xs border border-gray-200 dark:border-zinc-700">
      <Tooltip title={t("memo.view-detail")} placement="top">
        <span
          className="w-fit mb-0.5 flex items-center gap-1 text-xs leading-4 text-gray-400 dark:text-gray-500 select-none cursor-pointer hover:text-gray-600 dark:hover:text-gray-300"
          onClick={() => navigateTo(`/m/${memo.uid}`, { state: { from: context.parentPage } })}
        >
          <QuoteIcon className="w-3 h-3" />
          <relative-time datetime={memo.createTime?.toISOString()} format="datetime"></relative-time>
        </span>
      </Tooltip>
      {content}
    </div>
  );
};

export default EmbeddedMemo;
