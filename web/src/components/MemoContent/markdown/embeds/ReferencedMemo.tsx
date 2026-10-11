import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMemoStore } from "@/store/v1";
import { RendererContext } from "../../types";
import EmbedError from "./EmbedError";

interface Props {
  uid: string;
  // Query-style options after `?`: `text` replaces the label.
  params: string;
}

// `[[memos/uid]]`: an inline link to the memo, labelled with `text` or the start of its snippet.
const ReferencedMemo = ({ uid, params }: Props) => {
  const context = useContext(RendererContext);
  const fetchMemoByUid = useMemoStore((state) => state.fetchMemoByUid);
  const memo = useMemoStore((state) => state.memoMapByUid[uid]);
  const [loading, setLoading] = useState(!memo);

  useEffect(() => {
    fetchMemoByUid(uid)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [uid]);

  if (loading && !memo) {
    return <span className="inline-block h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse align-middle" />;
  }
  if (!memo) {
    return <EmbedError message={`Memo not found: ${uid}`} />;
  }

  const label = new URLSearchParams(params).get("text") || (memo.snippet.length > 12 ? `${memo.snippet.slice(0, 12)}...` : memo.snippet);
  return (
    <Link
      to={`/m/${memo.uid}`}
      state={{ from: context.parentPage }}
      viewTransition
      className="text-blue-600 whitespace-nowrap dark:text-blue-400 cursor-pointer underline break-all hover:opacity-80 decoration-1"
    >
      {label}
    </Link>
  );
};

export default ReferencedMemo;
