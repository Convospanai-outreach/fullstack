import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from "@craftmyfunnel/ui-sync";

// Rendered with `open` controlled true (no click/hover in a static preview)
// so the actual dialog content — not the trigger — is what's on the card.
export function Open() {
  return (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pause outreach?</DialogTitle>
          <DialogDescription>
            This stops all queued messages for the selected campaign. You can resume at
            any time.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button variant="destructive">Pause campaign</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
