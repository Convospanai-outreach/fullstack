import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, Button } from "@craftmyfunnel/ui-sync";

// `open` is controlled true so the tooltip content — not just the trigger —
// renders in a static preview (there's no hover in a screenshot).
export function Open() {
  return (
    <TooltipProvider>
      <div style={{ paddingTop: 40 }}>
        <Tooltip open>
          <TooltipTrigger asChild>
            <Button variant="outline">Hover me</Button>
          </TooltipTrigger>
          <TooltipContent>Runs the outreach sequence now</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
