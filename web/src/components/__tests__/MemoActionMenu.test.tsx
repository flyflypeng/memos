import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "@/test/render";
import { Memo } from "@/types/proto/api/v1/memo_service";
import MemoActionMenu from "../MemoActionMenu";

const updateMemo = vi.hoisted(() => vi.fn());

vi.mock("@/grpcweb", () => ({
  memoServiceClient: { updateMemo },
}));

const REMOVE_DONE = "Remove done";

const openMenu = (content: string) => {
  renderWithRouter(<MemoActionMenu memo={Memo.fromPartial({ name: "memos/1", uid: "menu-memo", content })} />);
  fireEvent.click(screen.getByRole("button"));
};

// Clicks "Remove done", confirms, and returns the Memo content written back through UpdateMemo.
const removeDone = async (content: string) => {
  openMenu(content);
  fireEvent.click(screen.getByText(REMOVE_DONE));
  await vi.waitFor(() => expect(updateMemo).toHaveBeenCalledTimes(1));
  const [{ memo, updateMask }] = updateMemo.mock.calls[0];
  expect(memo.name).toBe("memos/1");
  expect(updateMask).toEqual(["content"]);
  return memo.content as string;
};

describe("MemoActionMenu: remove completed tasks", () => {
  beforeEach(() => {
    updateMemo.mockReset();
    updateMemo.mockImplementation(async ({ memo }: { memo: Partial<Memo> }) => Memo.fromPartial(memo));
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("is offered only when the content has a completed task", () => {
    openMenu("- [ ] open\n- [x] done");
    expect(screen.getByText(REMOVE_DONE)).toBeInTheDocument();
  });

  it.each([
    ["no tasks", "just text"],
    ["only open tasks", "- [ ] open\n- [ ] also open"],
    ["a checked box inside code", "```\n- [x] not a task\n```"],
  ])("is hidden with %s", (_, content) => {
    openMenu(content);
    expect(screen.queryByText(REMOVE_DONE)).toBeNull();
  });

  it("deletes the completed task lines and keeps every other line as is", async () => {
    const content = "# Today\n\n- [x] done *one*\n- [ ] keep **me**\n- [X] done two\n\nNotes stay.\n";
    expect(await removeDone(content)).toBe("# Today\n\n- [ ] keep **me**\n\nNotes stay.\n");
  });

  it("removes a completed task as the last line without leaving a trailing newline", async () => {
    expect(await removeDone("- [ ] open\n- [x] done")).toBe("- [ ] open");
  });

  it("removes completed tasks in nested lists and blockquotes", async () => {
    const content = "- [ ] parent\n  - [x] child done\n  - [ ] child open\n\n> - [x] quoted done\n> - [ ] quoted open";
    expect(await removeDone(content)).toBe("- [ ] parent\n  - [ ] child open\n\n> - [ ] quoted open");
  });

  it("keeps the open subtasks of a removed task", async () => {
    expect(await removeDone("- [x] parent\n  - [ ] child\n- [ ] next")).toBe("  - [ ] child\n- [ ] next");
  });

  it("removes a completed task after a table", async () => {
    const content = "| a | b |\n| - | - |\n| 1 | 2 |\n\n- [x] after\n- [ ] stays";
    expect(await removeDone(content)).toBe("| a | b |\n| - | - |\n| 1 | 2 |\n\n- [ ] stays");
  });

  it("does nothing when the confirmation is cancelled", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    openMenu("- [x] done");
    fireEvent.click(screen.getByText(REMOVE_DONE));
    expect(updateMemo).not.toHaveBeenCalled();
  });
});
