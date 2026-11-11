import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { isKnownExtensionId } from "@/lib/extensionIds";
import { LogoMark } from "@/components/brand/LogoMark";
import ConnectExtension from "./ConnectExtension";

export const metadata: Metadata = {
    title: "Connect the Chrome extension | CraftMyFunnel",
    robots: { index: false, follow: false },
};

// Opened by the extension's Connect button as /extension/connect?ext=<extension id>.
export default async function ExtensionConnectPage({
    searchParams,
}: {
    searchParams: Promise<{ ext?: string | string[] }>;
}) {
    await connection();
    const { ext } = await searchParams;
    const extensionId = Array.isArray(ext) ? ext[0] : ext;

    // The proxy normally sends signed-out visitors to sign-in first; this covers the rest.
    const session = await auth();
    if (!session?.user?.id) {
        const back = extensionId ? `/extension/connect?ext=${encodeURIComponent(extensionId)}` : "/extension/connect";
        redirect(`/login?callbackUrl=${encodeURIComponent(back)}`);
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-white">
            <div className="w-full max-w-md space-y-4">
                <div className="mb-2 flex items-center justify-center gap-2 text-xl font-black">
                    <LogoMark priority className="h-9 w-9" />
                    CraftMyFunnel AI
                </div>
                <h1 className="text-center text-lg font-semibold">Connect the Chrome extension</h1>
                {isKnownExtensionId(extensionId) ? (
                    <ConnectExtension extensionId={extensionId} />
                ) : (
                    <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                        This link doesn&apos;t come from the CraftMyFunnel extension, so nothing was connected. Open the extension and click Connect to start again.
                    </p>
                )}
            </div>
        </div>
    );
}
