// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

const statusProps = vi.fn();
vi.mock("@/components/system/ConnectionStatusBar", () => ({
  ConnectionStatusBar: (props: Record<string, unknown>) => {
    statusProps(props);
    return <div data-testid="status" />;
  },
}));
vi.mock("@/components/dashboard/EdgeStatusChip", () => ({ EdgeStatusChip: () => <div data-testid="edge" /> }));
vi.mock("@/components/ui/NotificationBell", () => ({ NotificationBell: () => <div data-testid="bell" /> }));
vi.mock("@/components/dashboard/WorkspaceHelpPanel", () => ({ WorkspaceHelpPanel: () => <div data-testid="help" /> }));
vi.mock("@/components/dashboard/ThemeToggle", () => ({ ThemeToggle: () => <button aria-label="Switch to dark theme" /> }));

import { DashboardHeader } from "@/components/dashboard/DashboardHeader";

describe("DashboardHeader", () => {
  it("always shows the system status dropdown and the theme switch", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<DashboardHeader onToggleSidebar={() => undefined} />));
    expect(container.querySelector('[data-testid="status"]')).not.toBeNull();
    expect(statusProps).toHaveBeenCalledWith(expect.not.objectContaining({ onlyWhenUnhealthy: true }));
    expect(container.querySelector('[aria-label="Switch to dark theme"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="edge"]')).not.toBeNull();
    act(() => root.unmount());
    container.remove();
  });
});
