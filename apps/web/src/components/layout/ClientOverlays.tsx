"use client";

import dynamic from "next/dynamic";

const CommandPalette = dynamic(
  () => import("@/components/ui/CommandPalette").then((mod) => mod.CommandPalette),
  { ssr: false }
);

const SupportAssistant = dynamic(
  () => import("@/components/support/SupportAssistant").then((mod) => mod.SupportAssistant),
  { ssr: false }
);

export function ClientOverlays() {
  return (
    <>
      <CommandPalette />
      <SupportAssistant />
    </>
  );
}
