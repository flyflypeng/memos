import type { Root } from "mdast";
import { visit } from "unist-util-visit";
import { Resource } from "@/types/proto/api/v1/resource_service";
import { parseMemoMarkdown } from "./pipeline";

// The resources a Memo's content refers to: by name (`resources/{id}`, from `/file/resources/{id}/…`
// URLs) and by uid (from `![[resources/uid]]` embeds).
export interface ResourceReferences {
  names: Set<string>;
  uids: Set<string>;
}

const RESOURCE_PATH = /^\/file\/(resources\/\d+)(?:[/?#]|$)/;

// A site-relative `/file/resources/{id}/…` URL or the same URL on `origin`; other origins don't count.
const resourceNameFromUrl = (url: string, origin: string): string | undefined => {
  const path = url.startsWith(origin + "/") ? url.slice(origin.length) : url.startsWith("//") ? "" : url;
  return RESOURCE_PATH.exec(path)?.[1];
};

const collectReferences = (tree: Root, origin: string): ResourceReferences => {
  const references: ResourceReferences = { names: new Set(), uids: new Set() };
  visit(tree, (node) => {
    switch (node.type) {
      case "image":
      case "link":
      case "definition": {
        const name = resourceNameFromUrl(node.url, origin);
        if (name) references.names.add(name);
        break;
      }
      case "memosElement":
        if (node.name === "embeddedResource" && typeof node.props.uid === "string") references.uids.add(node.props.uid);
        break;
    }
  });
  return references;
};

// extractResourceReferences finds the resources Memo content refers to, using the renderer's own
// Markdown parse so URLs in code never count. Recognised forms: `/file/resources/{id}/…` and
// `{origin}/file/resources/{id}/…` image, link and definition URLs, and `![[resources/uid]]`.
export const extractResourceReferences = (content: string, origin: string): ResourceReferences =>
  collectReferences(parseMemoMarkdown(content), origin);

export const isReferenced = (resource: Resource, references: ResourceReferences) =>
  references.names.has(resource.name) || references.uids.has(resource.uid);

// excludeReferencedResources returns the attachments among `resources`: those `content` does not
// reference. Referenced ones are inline images, shown in the content instead of the attachment list.
export const excludeReferencedResources = (resources: Resource[], content: string, origin: string): Resource[] => {
  if (resources.length === 0) return resources;
  const references = extractResourceReferences(content, origin);
  return resources.filter((resource) => !isReferenced(resource, references));
};
