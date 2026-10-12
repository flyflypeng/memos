import { useEffect, useState } from "react";

// usePendingFetch fetches the entity an embed shows by its UID, and reports whether the embed is still
// waiting for it: nothing cached and the fetch not settled yet. A failed fetch leaves the entity
// missing, which the embed shows as not found.
export const usePendingFetch = (uid: string, cached: unknown, fetch: (uid: string) => Promise<unknown>): boolean => {
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    fetch(uid)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [uid]);

  return loading && !cached;
};
