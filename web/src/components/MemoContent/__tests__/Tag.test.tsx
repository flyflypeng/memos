import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "@/test/render";
import Tag from "../Tag";
import { RendererContext } from "../types";

describe("MemoContent Tag", () => {
  it("renders the tag with a leading hash and no filter affordance when filtering is disabled", () => {
    renderWithRouter(
      <RendererContext.Provider value={{ nodes: [], embeddedMemos: new Set(), disableFilter: true }}>
        <Tag content="project/memos" />
      </RendererContext.Provider>,
    );
    const tag = screen.getByText("#project/memos");
    expect(tag).toBeInTheDocument();
    expect(tag).not.toHaveClass("cursor-pointer");
  });
});
