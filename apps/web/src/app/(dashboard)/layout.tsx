import type { ReactNode } from "react";
import { connection } from "next/server";
import DashboardShell from "./DashboardShell";

// Signed-in pages render per request so Next can attach proxy.ts's per-request CSP nonce
// to its scripts (roadmap 3.6 part 2: strict script policy for the signed-in app only).
export default async function DashboardLayout({ children }: { children: ReactNode }) {
    await connection();
    return <DashboardShell>{children}</DashboardShell>;
}
