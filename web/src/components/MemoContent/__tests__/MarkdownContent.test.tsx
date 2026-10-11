import { fireEvent, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "@/test/render";
import MemoContent from "..";

const renderMemo = (content: string) => renderWithRouter(<MemoContent content={content} />);

// Text of each table row's cells, header row first.
const tableRows = () => screen.getAllByRole("row").map((row) => Array.from(row.querySelectorAll("th, td"), (cell) => cell.textContent));

describe("MemoContent from Memo content: tables", () => {
  it("keeps an escaped pipe as a literal pipe inside a cell", () => {
    renderMemo("| cmd | note |\n| --- | --- |\n| a \\| b | or |");
    expect(tableRows()).toEqual([
      ["cmd", "note"],
      ["a | b", "or"],
    ]);
  });

  it("renders inline code containing an escaped pipe as code inside the cell", () => {
    renderMemo("| shell |\n| --- |\n| `ls \\| wc` |");
    expect(tableRows()[1]).toEqual(["ls | wc"]);
    expect(screen.getByText("ls | wc").tagName).toBe("CODE");
  });

  it("renders a link whose text and URL contain escaped pipes", () => {
    renderMemo("| link |\n| --- |\n| [a\\|b](https://example.com/?q=a\\|b) |");
    const link = screen.getByRole("link", { name: "a|b" });
    expect(link).toHaveAttribute("href", "https://example.com/?q=a%7Cb");
  });

  it("renders cells without padding spaces", () => {
    renderMemo("|a|b|\n|-|-|\n|1|2|");
    expect(tableRows()).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("renders empty cells written with and without a space", () => {
    renderMemo("| a | b | c |\n| --- | --- | --- |\n| | x ||");
    expect(tableRows()[1]).toEqual(["", "x", ""]);
  });

  it("pads short rows and drops excess cells to the header's column count", () => {
    renderMemo("| a | b | c |\n| --- | --- | --- |\n| 1 |\n| 1 | 2 | 3 | 4 |");
    expect(tableRows()).toEqual([
      ["a", "b", "c"],
      ["1", "", ""],
      ["1", "2", "3"],
    ]);
  });

  it("renders a table without leading and trailing pipes", () => {
    renderMemo("a | b\n--- | ---\n1 | 2");
    expect(tableRows()).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("turns <br> in a cell into a line break", () => {
    renderMemo("| lines |\n| --- |\n| one<br>two |");
    const cell = screen.getAllByRole("row")[1].querySelector("td")!;
    expect(cell.querySelector("br")).not.toBeNull();
    expect(cell.textContent).toBe("onetwo");
  });

  it("aligns columns according to the delimiter row", () => {
    renderMemo("| l | c | r | n |\n| :-- | :-: | --: | --- |\n| 1 | 2 | 3 | 4 |");
    const cells = screen.getAllByRole("row")[1].querySelectorAll("td");
    expect(cells[0]).toHaveStyle({ textAlign: "left" });
    expect(cells[1]).toHaveStyle({ textAlign: "center" });
    expect(cells[2]).toHaveStyle({ textAlign: "right" });
    expect(cells[3].style.textAlign).toBe("");
  });

  it("renders full-width CJK punctuation and emoji in cells", () => {
    renderMemo("| 项目 | 状态 |\n| --- | --- |\n| 写作（草稿）：完成！ | ✅🎉 |");
    expect(tableRows()).toEqual([
      ["项目", "状态"],
      ["写作（草稿）：完成！", "✅🎉"],
    ]);
  });

  it("wraps tables in a horizontally scrollable container", () => {
    renderMemo("| a |\n| --- |\n| 1 |");
    expect(screen.getByRole("table").parentElement).toHaveClass("overflow-x-auto");
  });
});

describe("MemoContent from Memo content: HTML", () => {
  it("renders allowed inline HTML", () => {
    const { container } = renderMemo(
      "<details><summary>More</summary>\n\nHidden\n\n</details>\n\nPress <kbd>Ctrl</kbd>, H<sub>2</sub>O, x<sup>2</sup>, <mark>hot</mark><br>next",
    );
    expect(container.querySelector("details summary")).toHaveTextContent("More");
    expect(screen.getByText("Ctrl").tagName).toBe("KBD");
    expect(screen.getByText("2", { selector: "sub" })).toBeInTheDocument();
    expect(screen.getByText("2", { selector: "sup" })).toBeInTheDocument();
    expect(screen.getByText("hot").tagName).toBe("MARK");
    expect(container.querySelector("br")).not.toBeNull();
  });

  it("removes scripts, event handlers and javascript: links", () => {
    const { container } = renderMemo(
      '<script>window.pwned = true</script>\n\n<img src="x.png" onerror="alert(1)" onload="alert(2)">\n\n<a href="javascript:alert(1)">raw</a> [md](javascript:alert(1))',
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.innerHTML).not.toContain("pwned");
    expect(container.querySelector("img")).not.toHaveAttribute("onerror");
    expect(container.querySelector("img")).not.toHaveAttribute("onload");
    for (const name of ["raw", "md"]) {
      expect(screen.getByText(name).closest("a")?.getAttribute("href") ?? "").not.toContain("javascript:");
    }
  });

  it("renders a ```__html block without sanitizing it", () => {
    const { container } = renderMemo('```__html\n<div class="custom" style="color: red">raw <u>html</u></div>\n```');
    const custom = container.querySelector("div.custom");
    expect(custom).toHaveStyle({ color: "rgb(255, 0, 0)" });
    expect(custom?.querySelector("u")).toHaveTextContent("html");
  });
});

describe("MemoContent from Memo content: code and math", () => {
  it("highlights fenced code by language", async () => {
    const { container } = renderMemo("```js\nconst answer = 42;\n```");
    expect(screen.getByText("js")).toBeInTheDocument();
    // Code blocks start collapsed, as with the previous renderer.
    fireEvent.click(container.querySelector("svg.lucide-chevron-down")!);
    const code = container.querySelector("pre code.language-js")!;
    expect(code.querySelector(".hljs-keyword")).toHaveTextContent("const");
    expect(code).toHaveTextContent("const answer = 42;");
  });

  it("hands ```mermaid blocks to the diagram renderer", () => {
    const { container } = renderMemo("```mermaid\ngraph TD\n  A-->B\n```");
    const pre = container.querySelector("pre")!;
    expect(pre.querySelector("code")).toBeNull();
    expect(pre.textContent).toBe("graph TD\n  A-->B");
  });

  it("renders $…$ and $$…$$ as formulas", () => {
    const { container } = renderMemo("Inline $E=mc^2$ here.\n\n$$\n\\int_0^1 x\\,dx\n$$");
    expect(container.querySelectorAll(".katex")).toHaveLength(2);
    expect(container.querySelectorAll(".katex-display")).toHaveLength(1);
    expect(container.textContent).not.toContain("$");
  });
});

describe("MemoContent from Memo content: images", () => {
  it("shows a lone image lazily at its natural ratio, bounded by the content width and 60vh", () => {
    renderMemo("![shot](/file/resources/1/shot.png)");
    const image = screen.getByRole("img", { name: "shot" });
    expect(image).toHaveAttribute("src", "/file/resources/1/shot.png");
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveClass("max-w-full", "max-h-[60vh]", "object-contain");
    expect(image).not.toHaveClass("h-[15rem]");
  });

  it("opens the image viewer when an image is clicked", async () => {
    renderMemo("![shot](https://example.com/shot.png)");
    fireEvent.click(screen.getByRole("img", { name: "shot" }));
    expect(await screen.findByRole("dialog")).toHaveClass("PhotoView-Portal");
  });

  it("groups consecutive image-only lines into one row of thumbnails", () => {
    const { container } = renderMemo(
      "![a](/file/resources/1/a.png)\n![b](/file/resources/2/b.png)\n![c](https://example.com/c.png)\n\n![d](/d.png)",
    );
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(2);
    const group = paragraphs[0];
    expect(group).toHaveClass("flex", "overflow-x-auto");
    expect(Array.from(group.querySelectorAll("img"), (img) => img.getAttribute("src"))).toEqual([
      "/file/resources/1/a.png?thumbnail=true",
      "/file/resources/2/b.png?thumbnail=true",
      "https://example.com/c.png",
    ]);
    expect(group.querySelector("br")).toBeNull();
    expect(paragraphs[1]).not.toHaveClass("flex");
  });
});

describe("MemoContent from Memo content: standard markdown", () => {
  it("renders CommonMark and GFM blocks and inlines", () => {
    const { container } = renderMemo(
      [
        "# Title",
        "## Sub",
        "- one",
        "  - nested",
        "1. first",
        "> quoted",
        "",
        "---",
        "",
        "**bold** *italic* ~~gone~~ `code` [link](https://example.com) https://auto.example.com",
        "line one",
        "line two",
      ].join("\n"),
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Title");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Sub");
    expect(container.querySelector("ul ul li")).toHaveTextContent("nested");
    expect(container.querySelector("ol li")).toHaveTextContent("first");
    expect(container.querySelector("blockquote")).toHaveTextContent("quoted");
    expect(container.querySelector("hr")).not.toBeNull();
    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(screen.getByText("italic").tagName).toBe("EM");
    expect(screen.getByText("gone").tagName).toBe("DEL");
    expect(screen.getByText("code").tagName).toBe("CODE");
    expect(screen.getByRole("link", { name: "link" })).toHaveAttribute("href", "https://example.com");
    expect(screen.getByRole("link", { name: "https://auto.example.com" })).toHaveAttribute("href", "https://auto.example.com");
    // A single newline inside a paragraph is a line break, as before.
    expect(
      screen
        .getByText(/line one/)
        .closest("p")
        ?.querySelector("br"),
    ).not.toBeNull();
  });
});

describe("MemoContent from Memo content: task lists", () => {
  it("shows GFM task items as read-only checkboxes that carry their marker's source offset", () => {
    const content = "- [ ] todo\n- [x] done\n\n> - [ ] quoted";
    renderMemo(content);
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.map((box) => (box as HTMLInputElement).checked)).toEqual([false, true, false]);
    checkboxes.forEach((box) => expect(box).toBeDisabled());
    const offsets = checkboxes.map((box) => Number(box.getAttribute("data-task-marker-offset")));
    expect(offsets.map((offset) => content.slice(offset, offset + 3))).toEqual(["[ ]", "[x]", "[ ]"]);
    expect(offsets).toEqual([2, 13, 27]);
    expect(screen.getByText("done")).toHaveClass("line-through");
    expect(screen.getByText("todo")).not.toHaveClass("line-through");
  });

  it("strikes through a completed task's own text but not its nested items", () => {
    renderMemo("- [x] parent\n  - child");
    expect(screen.getByText("parent")).toHaveClass("line-through");
    expect(screen.getByText("child").closest(".line-through")).toBeNull();
  });
});

describe("MemoContent from Memo content: collapse", () => {
  it("clamps collapsed content and toggles with show more / show less", () => {
    const onToggleCollapse = vi.fn();
    const { container, rerender } = renderWithRouter(
      <MemoContent content={"long\n\ntext"} collapsible isCollapsed onToggleCollapse={onToggleCollapse} />,
    );
    expect(container.querySelector(".line-clamp-6")).not.toBeNull();
    fireEvent.click(screen.getByText("Show more"));
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
    rerender(
      <MemoryRouter>
        <MemoContent content={"long\n\ntext"} collapsible isCollapsed={false} onToggleCollapse={onToggleCollapse} />
      </MemoryRouter>,
    );
    expect(container.querySelector(".line-clamp-6")).toBeNull();
    expect(screen.getByText("Show less")).toBeInTheDocument();
  });

  it("reports collapsibility from the rendered height", () => {
    const onCollapsibleChange = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    const scrollHeight = vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(300);
    renderWithRouter(<MemoContent content="tall" enableCollapse onCollapsibleChange={onCollapsibleChange} />);
    scrollHeight.mockRestore();
    vi.unstubAllGlobals();
    expect(onCollapsibleChange).toHaveBeenCalledWith(true);
  });
});
