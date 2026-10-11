import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";

// renderWithRouter renders UI inside a MemoryRouter, which MemoContent leaves (e.g. Tag) require.
export const renderWithRouter = (ui: ReactElement, { route = "/" }: { route?: string } = {}) => {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
};
