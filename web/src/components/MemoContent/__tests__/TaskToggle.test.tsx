import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMemoStore, useUserStore } from "@/store/v1";
import { renderWithRouter } from "@/test/render";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { User, User_Role } from "@/types/proto/api/v1/user_service";
import MemoContent from "..";

const updateMemo = vi.hoisted(() => vi.fn());

vi.mock("@/grpcweb", () => ({
  memoServiceClient: { updateMemo },
}));

const MEMO_NAME = "memos/1";
const CURRENT_USER = "users/1";

// Renders a memo owned by the signed-in user, so its checkboxes are editable.
const renderOwnMemo = (content: string) => {
  const memo = Memo.fromPartial({ name: MEMO_NAME, uid: "task-memo", creator: CURRENT_USER, content });
  useMemoStore.setState({ memoMapByName: { [MEMO_NAME]: memo } });
  return renderWithRouter(<MemoContent content={content} memoName={MEMO_NAME} />);
};

// The Memo content the click wrote back through UpdateMemo.
const savedContent = () => {
  expect(updateMemo).toHaveBeenCalledTimes(1);
  const [{ memo, updateMask }] = updateMemo.mock.calls[0];
  expect(memo.name).toBe(MEMO_NAME);
  expect(updateMask).toEqual(["content"]);
  return memo.content as string;
};

const clickCheckbox = (index: number) => fireEvent.click(screen.getAllByRole("checkbox")[index]);

describe("MemoContent from Memo content: toggling a task", () => {
  beforeEach(() => {
    updateMemo.mockReset();
    updateMemo.mockImplementation(async ({ memo }: { memo: Partial<Memo> }) => Memo.fromPartial({ creator: CURRENT_USER, ...memo }));
    useUserStore.setState({
      currentUser: CURRENT_USER,
      userMapByName: { [CURRENT_USER]: User.fromPartial({ name: CURRENT_USER, role: User_Role.USER }) },
    });
  });

  it("checks an open task by rewriting only its marker", () => {
    renderOwnMemo("Plan:\n- [ ] write *tests*\n- [ ] ship");
    clickCheckbox(1);
    expect(savedContent()).toBe("Plan:\n- [ ] write *tests*\n- [x] ship");
  });

  it("unchecks a done task, including an uppercase X marker", () => {
    renderOwnMemo("- [X] done\n- [x] also done");
    clickCheckbox(0);
    expect(savedContent()).toBe("- [ ] done\n- [x] also done");
  });

  it("toggles the right task in a nested list", () => {
    renderOwnMemo("- [ ] parent\n  - [ ] child one\n  - [x] child two\n    1. [ ] grandchild");
    clickCheckbox(3);
    expect(savedContent()).toBe("- [ ] parent\n  - [ ] child one\n  - [x] child two\n    1. [x] grandchild");
  });

  it("toggles a task inside a blockquote", () => {
    renderOwnMemo("- [ ] outside\n\n> quoted\n> - [ ] inside\n> - [x] kept");
    clickCheckbox(1);
    expect(savedContent()).toBe("- [ ] outside\n\n> quoted\n> - [x] inside\n> - [x] kept");
  });

  it("toggles a task written after a table", () => {
    renderOwnMemo("| a | b |\n| --- | --- |\n| [ ] | `[x]` |\n\n- [ ] after table\n- [ ] last");
    clickCheckbox(1);
    expect(savedContent()).toBe("| a | b |\n| --- | --- |\n| [ ] | `[x]` |\n\n- [ ] after table\n- [x] last");
  });

  it("keeps CRLF line endings and unicode text byte for byte", () => {
    renderOwnMemo("待办 ✅\r\n- [ ] 第一\r\n- [ ] 🚀 second\r\n");
    clickCheckbox(1);
    expect(savedContent()).toBe("待办 ✅\r\n- [ ] 第一\r\n- [x] 🚀 second\r\n");
  });

  it("does not save when the memo belongs to someone else", () => {
    useUserStore.setState({ currentUser: "users/2" });
    renderOwnMemo("- [ ] not mine");
    expect(screen.getByRole("checkbox")).toBeDisabled();
    clickCheckbox(0);
    expect(updateMemo).not.toHaveBeenCalled();
  });
});
