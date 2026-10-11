import clsx from "clsx";
import { useEffect, useState } from "react";
import MemoResourceListView from "@/components/MemoResourceListView";
import { useResourceStore } from "@/store/v1";
import EmbedError from "./EmbedError";

interface Props {
  uid: string;
  // Query-style options after `?`: `align=center`, `size=lg|md|sm`, `width=<CSS length>`.
  params: string;
}

const SIZE_CLASS: Record<string, string> = { lg: "w-full", md: "w-2/3", sm: "w-1/3" };

// `![[resources/uid]]`: shows the resource with that UID.
const EmbeddedResource = ({ uid, params }: Props) => {
  const fetchResourceByUID = useResourceStore((state) => state.fetchResourceByUID);
  // The store keys resources by name, so the embed looks the resource up by its UID.
  const resource = useResourceStore((state) => Object.values(state.resourceMapByName).find((r) => r.uid === uid));
  const [loading, setLoading] = useState(!resource);

  useEffect(() => {
    fetchResourceByUID(uid)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [uid]);

  if (loading && !resource) {
    return null;
  }
  if (!resource) {
    return <EmbedError message={`Resource not found: ${uid}`} />;
  }

  const options = new URLSearchParams(params);
  return (
    <div
      className={clsx("max-w-full", options.get("align") === "center" && "mx-auto", SIZE_CLASS[options.get("size") ?? ""])}
      // Tailwind cannot generate classes for arbitrary widths at runtime, so width is a style.
      style={options.has("width") ? { width: options.get("width")! } : undefined}
    >
      <MemoResourceListView resources={[resource]} />
    </div>
  );
};

export default EmbeddedResource;
