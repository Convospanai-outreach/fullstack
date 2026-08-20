import { Modal, Button } from "@craftmyfunnel/ui-sync";

export function Open() {
  return (
    <Modal
      open
      onClose={() => {}}
      title="Confirm import"
      footer={
        <>
          <Button variant="outline">Cancel</Button>
          <Button>Import 214 leads</Button>
        </>
      }
    >
      This will import 214 leads from the uploaded CSV into your active workspace.
    </Modal>
  );
}
