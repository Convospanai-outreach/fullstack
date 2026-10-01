import { redirect } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { postLoginPath } from "@/lib/postLoginPath";
import CompleteProfileForm from "./CompleteProfileForm";

export default async function CompleteProfilePage({
    searchParams,
}: {
    searchParams: Promise<{ next?: string }>;
}) {
    await connection();
    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, firstName: true, lastName: true, phone: true, company: true, profileCompletedAt: true },
    });
    if (!user) redirect("/login");

    // Only same-site relative paths, so this can't be turned into an open redirect.
    const { next } = await searchParams;
    const nextPath = next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : postLoginPath();
    if (user.profileCompletedAt) redirect(nextPath);

    const [guessFirst = "", ...rest] = (user.name ?? "").split(" ");
    return (
        <CompleteProfileForm
            nextPath={nextPath}
            initial={{
                firstName: user.firstName ?? guessFirst,
                lastName: user.lastName ?? rest.join(" "),
                phone: user.phone ?? "",
                company: user.company ?? "",
            }}
        />
    );
}
