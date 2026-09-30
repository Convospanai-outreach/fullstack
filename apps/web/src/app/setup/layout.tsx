import type { ReactNode } from "react";
import { connection } from "next/server";

// Signed-in page: render per request so Next can attach proxy.ts's CSP nonce (roadmap 3.6).
export default async function Layout({ children }: { children: ReactNode }) {
    await connection();
    return children;
}
