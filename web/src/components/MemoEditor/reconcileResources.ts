import { extractResourceReferences, isReferenced } from "@/components/MemoContent/markdown/resourceReferences";
import { Resource } from "@/types/proto/api/v1/resource_service";

// Save-time resource decision for one editing session (ADR 0002). Pure: no store, no network.
export interface ReconcileInput {
  // The Memo when the editor opened (empty for a new Memo).
  original: { content: string; resources: Resource[] };
  // The content being saved and the editor's attachment list (attachments the user kept or added).
  current: { content: string; attachments: Resource[] };
  // Every resource uploaded while this editor was open, inline images and attachments alike.
  uploadedThisSession: Resource[];
  // Other resources the client knows about (the user's resource list). Lets references to unused
  // resources from an earlier session (a new-Memo draft after a refresh) and to other Memos'
  // resources be told apart.
  knownResources: Resource[];
  origin: string;
}

export interface ReconcileOutput {
  // Sent as the Memo's resources on save; the server's SetMemoResources deletes this Memo's
  // resources that are left out.
  linkToMemo: Resource[];
  // Uploads that belong to no Memo and are no longer referenced; the client deletes them.
  deleteUnused: Resource[];
}

export const reconcileResources = (input: ReconcileInput): ReconcileOutput => {
  const { original, current, uploadedThisSession, knownResources, origin } = input;
  const references = extractResourceReferences(current.content, origin);
  const ownNames = new Set(original.resources.map((resource) => resource.name));
  const sessionNames = new Set(uploadedThisSession.map((resource) => resource.name));

  const linkToMemo = [...current.attachments];
  const linkedNames = new Set(linkToMemo.map((resource) => resource.name));
  // Earlier pools win: they describe the resource as this editing session last saw it.
  for (const resource of [...original.resources, ...uploadedThisSession, ...knownResources]) {
    if (linkedNames.has(resource.name) || !isReferenced(resource, references)) continue;
    // A resource of another Memo stays a plain reference: linking it would take it from its Memo.
    if (!ownNames.has(resource.name) && !sessionNames.has(resource.name) && resource.memo) continue;
    linkToMemo.push(resource);
    linkedNames.add(resource.name);
  }

  // Only this session's uploads that no Memo owns are deleted here. The Memo's own resources that are
  // left out are deleted by the server's SetMemoResources; other Memos' resources and unused
  // resources from earlier sessions (draft images) are never touched.
  const deleteUnused = uploadedThisSession.filter((resource) => !resource.memo && !linkedNames.has(resource.name));

  return { linkToMemo, deleteUnused };
};

// Whether `current.content` references a resource that none of the editor's own pools (the Memo's
// resources, this session's uploads, the attachments) knows, e.g. an image in a draft from before a
// refresh. Only then does the caller need to supply `knownResources`.
export const hasUnresolvedReferences = (input: Omit<ReconcileInput, "knownResources">): boolean => {
  const references = extractResourceReferences(input.current.content, input.origin);
  const known = [...input.original.resources, ...input.uploadedThisSession, ...input.current.attachments];
  return (
    [...references.names].some((name) => !known.some((resource) => resource.name === name)) ||
    [...references.uids].some((uid) => !known.some((resource) => resource.uid === uid))
  );
};

// Cancelling an edit of an existing Memo: the uploads of this session that still belong to no Memo.
export const cancelCleanup = (uploadedThisSession: Resource[]): Resource[] => uploadedThisSession.filter((resource) => !resource.memo);

// The deletion candidates that are still unused resources according to `latest` (the user's
// resources as the server lists them now). The editor's copies can be stale: another editor (zen
// mode) may have saved them into a Memo since. A candidate that a Memo owns or that no longer exists
// is never deleted.
export const confirmUnused = (candidates: Resource[], latest: Resource[]): Resource[] => {
  const unusedNames = new Set(latest.filter((resource) => !resource.memo).map((resource) => resource.name));
  return candidates.filter((resource) => unusedNames.has(resource.name));
};
