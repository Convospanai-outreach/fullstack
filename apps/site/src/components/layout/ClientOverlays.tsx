"use client";

import dynamic from "next/dynamic";

const SupportAssistant = dynamic(
  () => import("@/components/support/SupportAssistant").then((mod) => mod.SupportAssistant),
  { ssr: false }
);

export function ClientOverlays() {
  return (
    <>
      <SupportAssistant />
    </>
  );
}
