import { Resource } from "@/types/proto/api/v1/resource_service";

// resourceFromFile builds the CreateResource payload for an uploaded file, named `filename`.
export const resourceFromFile = async (file: File, filename = file.name) =>
  Resource.fromPartial({
    filename,
    size: file.size,
    type: file.type,
    content: new Uint8Array(await file.arrayBuffer()),
  });

export const getResourceUrl = (resource: Resource) => {
  if (resource.externalLink) {
    return resource.externalLink;
  }

  return `${window.location.origin}/file/${resource.name}/${resource.filename}`;
};

export const getResourceType = (resource: Resource) => {
  if (isImage(resource.type)) {
    return "image/*";
  } else if (resource.type.startsWith("video")) {
    return "video/*";
  } else if (resource.type.startsWith("audio")) {
    return "audio/*";
  } else if (resource.type.startsWith("text")) {
    return "text/*";
  } else if (resource.type.startsWith("application/epub+zip")) {
    return "application/epub+zip";
  } else if (resource.type.startsWith("application/pdf")) {
    return "application/pdf";
  } else if (resource.type.includes("word")) {
    return "application/msword";
  } else if (resource.type.includes("excel")) {
    return "application/msexcel";
  } else if (resource.type.startsWith("application/zip")) {
    return "application/zip";
  } else if (resource.type.startsWith("application/x-java-archive")) {
    return "application/x-java-archive";
  } else {
    return "application/octet-stream";
  }
};

// isImage returns true if the given mime type is an image.
export const isImage = (t: string) => {
  // Don't show PSDs as images.
  return t.startsWith("image/") && !isPSD(t);
};

const isPSD = (t: string) => {
  return t === "image/vnd.adobe.photoshop" || t === "image/x-photoshop" || t === "image/photoshop";
};

const RESOURCE_PATH = /^\/file\/(resources\/\d+)(?:[/?#]|$)/;

// resourceNameFromUrl returns the resource name (`resources/{id}`) a URL serves when it is a Memos
// resource URL on this site: site-relative `/file/resources/{id}/…` or the same path on `origin`.
// Other origins and protocol-relative URLs don't count.
export const resourceNameFromUrl = (url: string, origin: string): string | undefined => {
  const path = url.startsWith(origin + "/") ? url.slice(origin.length) : url.startsWith("//") ? "" : url;
  return RESOURCE_PATH.exec(path)?.[1];
};
