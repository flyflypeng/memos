import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "@/test/render";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { Resource } from "@/types/proto/api/v1/resource_service";
import MemoContent from "..";

// Memos and resources the mocked API knows, by UID. Each test uses its own UIDs because the
// stores cache fetched memos and resources for the whole test file.
const memos: Record<string, Memo> = {};
const resources: Record<string, Resource> = {};

const addMemo = (id: number, uid: string, content: string, snippet = content) => {
  memos[uid] = Memo.fromPartial({ name: `memos/${id}`, uid, content, snippet, createTime: new Date("2026-01-02T03:04:05Z") });
  return memos[uid];
};

vi.mock("@/grpcweb", () => ({
  memoServiceClient: {
    getMemoByUid: vi.fn(async ({ uid }: { uid: string }) => {
      if (!memos[uid]) throw new Error("memo not found");
      return memos[uid];
    }),
  },
  resourceServiceClient: {
    getResourceByUid: vi.fn(async ({ uid }: { uid: string }) => {
      if (!resources[uid]) throw new Error("resource not found");
      return resources[uid];
    }),
  },
}));

const renderMemo = (content: string, memoName?: string) => renderWithRouter(<MemoContent content={content} memoName={memoName} />);

describe("MemoContent from Memo content: embedded memos", () => {
  it("renders the embedded memo's content as markdown", async () => {
    addMemo(11, "embed-basic", "Embedded **bold** text");
    renderMemo("Before\n\n![[memos/embed-basic]]\n\nAfter");
    const bold = await screen.findByText("bold");
    expect(bold.tagName).toBe("STRONG");
    expect(screen.getByText("Before")).toBeInTheDocument();
    expect(screen.getByText("After")).toBeInTheDocument();
  });

  it("embeds a memo written on the line right after a paragraph line", async () => {
    addMemo(12, "embed-after-line", "Second memo");
    renderMemo("Intro line\n![[memos/embed-after-line]]");
    expect(await screen.findByText("Second memo")).toBeInTheDocument();
    expect(screen.getByText("Intro line")).toBeInTheDocument();
  });

  it("embeds the same memo twice in one memo", async () => {
    addMemo(13, "embed-twice", "Twice");
    renderMemo("![[memos/embed-twice]]\n\n![[memos/embed-twice]]");
    await waitFor(() => expect(screen.getAllByText("Twice")).toHaveLength(2));
  });

  it("shows the snippet with ?snippet", async () => {
    addMemo(14, "embed-snippet", "# Full content", "Just the snippet");
    renderMemo("![[memos/embed-snippet?snippet]]");
    expect(await screen.findByText("Just the snippet")).toBeInTheDocument();
    expect(screen.queryByText("Full content")).toBeNull();
  });

  it("reports a memo that does not exist", async () => {
    renderMemo("![[memos/embed-missing]]");
    expect(await screen.findByText("Memo not found: embed-missing")).toBeInTheDocument();
  });

  it("refuses to embed a memo in itself", async () => {
    const self = addMemo(15, "embed-self", "Self: ![[memos/embed-self]]\n\n![[memos/embed-self]]");
    renderMemo(self.content, self.name);
    expect(await screen.findByText("Nested Rendering Error: ![[memos/embed-self]]")).toBeInTheDocument();
  });

  it("stops a cycle of embeds after one round", async () => {
    const a = addMemo(16, "cycle-a", "Memo A\n\n![[memos/cycle-b]]");
    addMemo(17, "cycle-b", "Memo B\n\n![[memos/cycle-a]]");
    renderMemo(a.content, a.name);
    expect(await screen.findByText("Nested Rendering Error: ![[memos/cycle-a]]")).toBeInTheDocument();
    expect(screen.getAllByText("Memo A")).toHaveLength(1);
    expect(screen.getAllByText("Memo B")).toHaveLength(1);
  });

  it("stops a cycle when the outer memo is not named", async () => {
    addMemo(18, "loop-a", "Loop A\n\n![[memos/loop-b]]");
    addMemo(19, "loop-b", "Loop B\n\n![[memos/loop-a]]");
    renderMemo("![[memos/loop-a]]");
    expect(await screen.findByText("Nested Rendering Error: ![[memos/loop-a]]")).toBeInTheDocument();
    expect(screen.getAllByText("Loop A")).toHaveLength(1);
    expect(screen.getAllByText("Loop B")).toHaveLength(1);
  });
});

describe("MemoContent from Memo content: embedded resources", () => {
  it("shows the resource with the given UID", async () => {
    resources["res-uid-1"] = Resource.fromPartial({ name: "resources/7", uid: "res-uid-1", filename: "cat.png", type: "image/png" });
    const { container } = renderMemo("![[resources/res-uid-1]]");
    await waitFor(() => expect(container.querySelector("img")).not.toBeNull());
    expect(container.querySelector("img")!.getAttribute("src")).toContain("/file/resources/7/cat.png");
    expect(screen.queryByText(/Resource not found/)).toBeNull();
  });

  it("applies a width parameter", async () => {
    resources["res-uid-2"] = Resource.fromPartial({ name: "resources/8", uid: "res-uid-2", filename: "dog.png", type: "image/png" });
    const { container } = renderMemo("![[resources/res-uid-2?width=120px&align=center]]");
    await waitFor(() => expect(container.querySelector("img")).not.toBeNull());
    expect(container.querySelector("img")!.closest("[style]")).toHaveStyle({ width: "120px" });
  });

  it("reports a resource that does not exist", async () => {
    renderMemo("![[resources/res-missing]]");
    expect(await screen.findByText("Resource not found: res-missing")).toBeInTheDocument();
  });
});

const MemoDetail = () => <p>Detail of {useParams().uid}</p>;

describe("MemoContent from Memo content: referenced memos", () => {
  it("renders an inline reference that opens the memo", async () => {
    addMemo(21, "ref-basic", "A long referenced memo", "A long referenced memo");
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<MemoContent content="See [[memos/ref-basic]] for details" />} />
          <Route path="/m/:uid" element={<MemoDetail />} />
        </Routes>
      </MemoryRouter>,
    );
    const link = await screen.findByRole("link", { name: "A long refer..." });
    const paragraph = link.closest("p")!;
    expect(paragraph.textContent).toBe("See A long refer... for details");
    fireEvent.click(link);
    expect(await screen.findByText("Detail of ref-basic")).toBeInTheDocument();
  });

  it("uses the text parameter as the label", async () => {
    addMemo(22, "ref-text", "Whatever");
    renderMemo("[[memos/ref-text?text=Read this]]");
    const link = await screen.findByRole("link", { name: "Read this" });
    expect(link).toHaveAttribute("href", "/m/ref-text");
  });

  it("reports a referenced memo that does not exist", async () => {
    renderMemo("x [[memos/ref-missing]] y");
    expect(await screen.findByText("Memo not found: ref-missing")).toBeInTheDocument();
  });
});

describe("MemoContent from Memo content: text that is not an embed or reference", () => {
  it.each([
    ["inline code", "`![[memos/abc]]` and `[[memos/abc]]`", "![[memos/abc]] and [[memos/abc]]"],
    ["text after an embed on the same line", "![[memos/abc]] trailing", "![[memos/abc]] trailing"],
    ["text before an embed on the same line", "lead ![[memos/abc]]", "lead ![[memos/abc]]"],
    ["an unknown resource type", "![[notes/abc]]", "![[notes/abc]]"],
    ["a reference to something other than a memo", "see [[wiki page]]", "see [[wiki page]]"],
    ["an unclosed reference", "see [[memos/abc", "see [[memos/abc"],
    ["an empty embed", "![[]]", "![[]]"],
  ])("leaves %s as text", (_, content, text) => {
    const { container } = renderMemo(content);
    expect(container.querySelector("p")!.textContent).toBe(text);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("leaves embeds inside fenced code as code", () => {
    const { container } = renderMemo("```\n![[memos/abc]]\n[[memos/abc]]\n```");
    // Code blocks start collapsed.
    fireEvent.click(container.querySelector("svg.lucide-chevron-down")!);
    expect(container.querySelector("pre")!.textContent).toBe("![[memos/abc]]\n[[memos/abc]]");
  });

  it("embeds inside a blockquote and a list item", async () => {
    addMemo(31, "embed-nested", "Nested content");
    renderMemo("> ![[memos/embed-nested]]\n\n- ![[memos/embed-nested]]");
    await waitFor(() => expect(screen.getAllByText("Nested content")).toHaveLength(2));
    const quote = document.querySelector("blockquote")!;
    expect(within(quote).getByText("Nested content")).toBeInTheDocument();
  });
});
