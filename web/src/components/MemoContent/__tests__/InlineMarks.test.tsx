import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useMemoFilterStore } from "@/store/v1";
import { renderWithRouter } from "@/test/render";
import MemoContent from "..";
import fixtures from "../../../../../testdata/tag-fixtures.json";

const renderMemo = (content: string) => renderWithRouter(<MemoContent content={content} />);

const renderedTags = (container: HTMLElement) =>
  new Set(Array.from(container.querySelectorAll("[data-memo-tag]"), (el) => el.getAttribute("data-memo-tag")));

describe("MemoContent from Memo content: tags match the shared fixtures", () => {
  it.each(fixtures)("$name", ({ content, tags }) => {
    const { container } = renderMemo(content);
    expect(renderedTags(container)).toEqual(new Set(tags));
  });
});

describe("MemoContent from Memo content: tag click", () => {
  beforeEach(() => {
    useMemoFilterStore.getState().removeFilter(() => true);
  });

  it("toggles the tag filter like the old Tag component", () => {
    renderMemo("hello #work");
    const tag = screen.getByText("#work");
    expect(tag).toHaveClass("cursor-pointer");
    fireEvent.click(tag);
    expect(useMemoFilterStore.getState().getFiltersByFactor("tagSearch")).toEqual([{ factor: "tagSearch", value: "work" }]);
    fireEvent.click(tag);
    expect(useMemoFilterStore.getState().getFiltersByFactor("tagSearch")).toEqual([]);
  });
});

describe("MemoContent from Memo content: inline marks", () => {
  it("renders ==x== as a highlight that may contain a tag", () => {
    const { container } = renderMemo("a ==big #news== b");
    const mark = container.querySelector("mark");
    expect(mark?.textContent).toBe("big #news");
    expect(mark?.querySelector("[data-memo-tag]")?.getAttribute("data-memo-tag")).toBe("news");
  });

  it("renders ||x|| as a spoiler that reveals on click", () => {
    renderMemo("the end: ||he lives||");
    const inner = screen.getByText("he lives");
    expect(inner).toHaveClass("opacity-0");
    fireEvent.click(inner);
    expect(inner).toHaveClass("opacity-100");
  });

  it("renders ^x^ and ~x~ as superscript and subscript", () => {
    const { container } = renderMemo("E=mc^2^ and H~2~O");
    expect(container.querySelector("sup")?.textContent).toBe("2");
    expect(container.querySelector("sub")?.textContent).toBe("2");
  });

  it.each([
    ["in inline code", "`==a== ||b|| ^c^ ~d~`"],
    ["in a code block", "```\n==a== ||b|| ^c^ ~d~\n```"],
    ["unclosed", "==a ||b ^c ~d"],
    ["empty", "==== |||| ^^ x~~y"],
    ["across lines", "==a\nb== ||a\nb|| ^a\nb^ ~a\nb~"],
  ])("leaves marks %s as text", (_, content) => {
    const { container } = renderMemo(content);
    expect(container.querySelector("mark, sup, sub, .select-none")).toBeNull();
  });
});
