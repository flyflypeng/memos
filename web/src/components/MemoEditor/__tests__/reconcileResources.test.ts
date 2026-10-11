import { describe, expect, it } from "vitest";
import { excludeReferencedResources } from "@/components/MemoContent/markdown/resourceReferences";
import { Resource } from "@/types/proto/api/v1/resource_service";
import { ReconcileInput, reconcileResources } from "../reconcileResources";

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
