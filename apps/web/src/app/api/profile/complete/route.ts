import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { profileFieldsSchema } from "@/lib/passwordAuth";

// The team name signup generated for this user (googleOnboarding / setupUser): "My Team" or
// "<their previous name>'s Team". Only that exact name is safe to overwrite with the company
// name - a team someone already named, or one the user was merely invited into, is left alone.
function isDefaultTeamName(name: string, previousUserName: string | null) {
    return name === "My Team" || (!!previousUserName && name === `${previousUserName}'s Team`);
}

export async function POST(req: Request) {
    const { prisma } = await import("@/lib/db");
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const parsed = profileFieldsSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const { firstName, lastName, phone, company } = parsed.data;

    const [before, owned] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
        prisma.teamMember.findMany({
            where: { userId, role: "owner", status: "active" },
            select: { team: { select: { id: true, name: true } } },
        }),
    ]);

    const userUpdate = prisma.user.update({
        where: { id: userId },
        data: {
            firstName,
            lastName,
            phone,
            company,
            name: `${firstName} ${lastName}`,
            profileCompletedAt: new Date(),
        },
    });
    const ownedTeam = owned.length === 1 ? owned[0]?.team : undefined;
    // One transaction, so a failed rename can't leave the profile marked complete with the old team name.
    if (ownedTeam && isDefaultTeamName(ownedTeam.name, before?.name ?? null)) {
        await prisma.$transaction([userUpdate, prisma.team.update({ where: { id: ownedTeam.id }, data: { name: company } })]);
    } else {
        await userUpdate;
    }

    return NextResponse.json({ success: true });
}
