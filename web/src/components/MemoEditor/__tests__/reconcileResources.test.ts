import { describe, expect, it } from "vitest";
import { excludeReferencedResources } from "@/components/MemoContent/markdown/resourceReferences";
import { Resource } from "@/types/proto/api/v1/resource_service";
import { ReconcileInput, cancelCleanup, confirmUnused, hasUnresolvedReferences, reconcileResources } from "../reconcileResources";

const ORIGIN = "http://localhost:3000";

const resource = (
  id: number,
  { memo, filename = `img${id}.png`, type = "image/png" }: { memo?: string; filename?: string; type?: string } = {},
) => Resource.fromPartial({ name: `resources/${id}`, uid: `uid${id}`, filename, type, memo });

const reconcile = (input: Partial<Omit<ReconcileInput, "current">> & { content: string; attachments?: Resource[] }) =>
  reconcileResources({
    original: input.original ?? { content: "", resources: [] },
    current: { content: input.content, attachments: input.attachments ?? [] },
    uploadedThisSession: input.uploadedThisSession ?? [],
    knownResources: input.knownResources ?? [],
    origin: ORIGIN,
  });

const linked = (output: { linkToMemo: Resource[] }) => output.linkToMemo.map((r) => r.name);

describe("reconcileResources: base linking rules", () => {
  it("links an image pasted into a new memo", () => {
    const pasted = resource(1, { filename: "pasted-20260105-090307.png" });
    const output = reconcile({ content: "look ![](/file/resources/1/pasted-20260105-090307.png)", uploadedThisSession: [pasted] });
    expect(linked(output)).toEqual(["resources/1"]);
  });

  it("links every attachment, referenced or not, attachments first", () => {
    const pdf = resource(2, { filename: "a.pdf", type: "application/pdf" });
    const pasted = resource(1);
    const output = reconcile({ content: "![](/file/resources/1/img1.png)", attachments: [pdf], uploadedThisSession: [pasted] });
    expect(linked(output)).toEqual(["resources/2", "resources/1"]);
  });

  it("does not link an upload of this session whose reference is gone", () => {
    const output = reconcile({ content: "no image", uploadedThisSession: [resource(1)] });
    expect(linked(output)).toEqual([]);
  });

  it("links a referenced unused resource uploaded before a refresh (new memo draft)", () => {
    const output = reconcile({ content: "![](/file/resources/3/img3.png)", knownResources: [resource(3)] });
    expect(linked(output)).toEqual(["resources/3"]);
  });

  it("keeps linking an inline image the memo already had", () => {
    const own = resource(4, { memo: "memos/1" });
    const content = "a\n\n![](/file/resources/4/img4.png)";
    const output = reconcile({ original: { content, resources: [own] }, content: content + "\nmore" });
    expect(linked(output)).toEqual(["resources/4"]);
  });

  it("never links a resource of another memo; it stays a reference", () => {
    const foreign = resource(5, { memo: "memos/9" });
    const output = reconcile({ content: "![](/file/resources/5/img5.png)", knownResources: [foreign] });
    expect(linked(output)).toEqual([]);
  });

  it("ignores references to resources it cannot resolve", () => {
    expect(linked(reconcile({ content: "![](/file/resources/77/x.png)" }))).toEqual([]);
  });
});

describe("reconcileResources: what counts as a reference", () => {
  const known = [resource(1), resource(2), resource(3)];

  it.each([
    ["a relative image URL", "![](/file/resources/1/img1.png)"],
    ["a relative URL with a thumbnail query", "![](/file/resources/1/img1.png?thumbnail=true)"],
    ["a same-origin absolute URL", `![](${ORIGIN}/file/resources/1/img1.png)`],
    ["a link to the resource", "[download](/file/resources/1/img1.png)"],
    ["a bare same-origin autolink", `see ${ORIGIN}/file/resources/1/img1.png`],
    ["a reference-style image", "![][shot]\n\n[shot]: /file/resources/1/img1.png"],
    ["an embedded resource line", "intro\n![[resources/uid1]]\noutro"],
    ["an embedded resource with params inside a quote", "> ![[resources/uid1?align=center]]"],
  ])("recognises %s", (_, content) => {
    expect(linked(reconcile({ content, knownResources: known }))).toEqual(["resources/1"]);
  });

  it.each([
    ["another origin", "![](https://example.com/file/resources/1/img1.png)"],
    ["inline code", "`![](/file/resources/1/img1.png)` and `![[resources/uid1]]`"],
    ["a fenced code block", "```\n![](/file/resources/1/img1.png)\n![[resources/uid1]]\n```"],
    ["an embed that is not alone on its line", "text ![[resources/uid1]]"],
    ["a non-resource path", "![](/file/resources-x/1/img1.png)"],
  ])("does not treat %s as a reference", (_, content) => {
    expect(linked(reconcile({ content, knownResources: known }))).toEqual([]);
  });
});

describe("excludeReferencedResources (attachment list)", () => {
  it("lists only the memo's resources that its content does not reference", () => {
    const resources = [resource(1), resource(2, { filename: "a.pdf", type: "application/pdf" }), resource(3), resource(4)];
    const content = [
      "![](/file/resources/1/img1.png)",
      "![[resources/uid3]]",
      `[x](${ORIGIN}/file/resources/4/img4.png)`,
      "![](https://other.example/file/resources/2/a.pdf)",
    ].join("\n\n");
    expect(excludeReferencedResources(resources, content, ORIGIN).map((r) => r.name)).toEqual(["resources/2"]);
  });
});

describe("reconcileResources: lifecycle (deleteUnused)", () => {
  const deleted = (output: { deleteUnused: Resource[] }) => output.deleteUnused.map((r) => r.name);

  it("deletes an unowned upload of this session whose reference was removed", () => {
    const output = reconcile({ content: "no image", uploadedThisSession: [resource(1)] });
    expect(deleted(output)).toEqual(["resources/1"]);
  });

  it("leaves the memo's own removed inline image to the server (unlinked, not client-deleted)", () => {
    const own = resource(4, { memo: "memos/1" });
    const output = reconcile({ original: { content: "![](/file/resources/4/img4.png)", resources: [own] }, content: "gone" });
    expect(linked(output)).toEqual([]);
    expect(deleted(output)).toEqual([]);
  });

  it("keeps an attachment the memo had on open while it stays in the attachment list, even unreferenced", () => {
    const pdf = resource(2, { memo: "memos/1", filename: "a.pdf", type: "application/pdf" });
    const output = reconcile({ original: { content: "x", resources: [pdf] }, content: "y", attachments: [pdf] });
    expect(linked(output)).toEqual(["resources/2"]);
    expect(deleted(output)).toEqual([]);
  });

  it("keeps an unreferenced upload of this session that is in the attachment list", () => {
    const pdf = resource(3, { filename: "a.pdf", type: "application/pdf" });
    const output = reconcile({ content: "y", attachments: [pdf], uploadedThisSession: [pdf] });
    expect(linked(output)).toEqual(["resources/3"]);
    expect(deleted(output)).toEqual([]);
  });

  it("turns a referenced attachment into an inline image: still linked, no longer listed", () => {
    const att = resource(2, { memo: "memos/1" });
    const content = "![](/file/resources/2/img2.png)";
    const output = reconcile({ original: { content: "x", resources: [att] }, content });
    expect(linked(output)).toEqual(["resources/2"]);
    expect(excludeReferencedResources([att], content, ORIGIN)).toEqual([]);
  });

  it("neither links nor deletes another memo's resource, referenced or not", () => {
    const foreign = resource(5, { memo: "memos/9" });
    for (const content of ["![](/file/resources/5/img5.png)", "dropped"]) {
      const output = reconcile({ content, knownResources: [foreign], uploadedThisSession: [] });
      expect(linked(output)).toEqual([]);
      expect(deleted(output)).toEqual([]);
    }
  });

  it("treats an upload referenced only by another origin URL as unreferenced and deletes it", () => {
    const output = reconcile({ content: "![](https://example.com/file/resources/1/img1.png)", uploadedThisSession: [resource(1)] });
    expect(linked(output)).toEqual([]);
    expect(deleted(output)).toEqual(["resources/1"]);
  });

  it("does not delete unused resources from an earlier session (draft images stay for manual cleanup)", () => {
    const output = reconcile({ content: "nothing", knownResources: [resource(3)] });
    expect(deleted(output)).toEqual([]);
  });
});

describe("cancelCleanup", () => {
  it("deletes this session's uploads that still belong to no memo", () => {
    const uploads = [resource(1), resource(2, { memo: "memos/1" })];
    expect(cancelCleanup(uploads).map((r) => r.name)).toEqual(["resources/1"]);
  });
});

describe("confirmUnused: re-checks deletion candidates against the latest resources", () => {
  it("keeps a candidate that is still unused", () => {
    expect(confirmUnused([resource(1)], [resource(1)]).map((r) => r.name)).toEqual(["resources/1"]);
  });

  it("never deletes a candidate a memo now owns (saved from another editor, e.g. zen mode)", () => {
    const stale = resource(1);
    const latest = [resource(1, { memo: "memos/7" })];
    expect(confirmUnused([stale], latest)).toEqual([]);
  });

  it("skips a candidate that no longer exists", () => {
    expect(confirmUnused([resource(1)], [])).toEqual([]);
  });

  it("applies to the cancel cleanup set too", () => {
    const uploads = [resource(1), resource(2)];
    const latest = [resource(1, { memo: "memos/3" }), resource(2)];
    expect(confirmUnused(cancelCleanup(uploads), latest).map((r) => r.name)).toEqual(["resources/2"]);
  });
});

describe("hasUnresolvedReferences: when the user's resource list must be fetched", () => {
  const input = (content: string, uploadedThisSession: Resource[] = []) => ({
    original: { content: "", resources: [] },
    current: { content, attachments: [] },
    uploadedThisSession,
    origin: ORIGIN,
  });

  it("is false when every reference is one of this session's uploads", () => {
    expect(hasUnresolvedReferences(input("![](/file/resources/1/img1.png)", [resource(1)]))).toBe(false);
  });

  it("is true for a URL reference the session does not know", () => {
    expect(hasUnresolvedReferences(input("![](/file/resources/9/x.png)", [resource(1)]))).toBe(true);
  });

  it("is true for an unknown ![[resources/uid]] embed", () => {
    expect(hasUnresolvedReferences(input("![[resources/other]]"))).toBe(true);
  });
});
