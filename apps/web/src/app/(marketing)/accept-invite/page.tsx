import { redirect } from "next/navigation";

export default async function AcceptInvitePage({
    searchParams,
}: {
    searchParams: Promise<{ token?: string }>;
}) {
    const params = await searchParams;
    const token = params.token || "";

    if (!token) {
        redirect("/signup");
    }

    redirect(`/signup?token=${encodeURIComponent(token)}`);
}
