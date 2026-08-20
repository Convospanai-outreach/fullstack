import { Nav } from "@craftmyfunnel/ui-sync";

// Nav's dropdown is internal useState toggled by a click on its own trigger
// button — no controlled prop exists to force it open, so the closed trigger
// (a real, complete state of this component) is what renders here.
export function Default() {
  return (
    <div style={{ background: "#020617", padding: 24, display: "inline-block" }}>
      <Nav />
    </div>
  );
}
