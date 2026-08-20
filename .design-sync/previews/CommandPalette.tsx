import { useEffect } from "react";
import { CommandPalette } from "@craftmyfunnel/ui-sync";

// CommandPalette has no open prop — it opens itself in response to its own
// documented public API: a Cmd/Ctrl+K keydown, or the "convo:open-command-palette"
// window event. Dispatching that event is how the app itself opens it; this
// mirrors that, it does not reimplement the component.
export function Open() {
  useEffect(() => {
    const id = setTimeout(() => {
      window.dispatchEvent(new Event("convo:open-command-palette"));
    }, 0);
    return () => clearTimeout(id);
  }, []);
  return <CommandPalette />;
}
