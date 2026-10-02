import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { profileFieldsSchema } from "@/lib/passwordAuth";

// The auto-generated team names from signup (googleOnboarding / setupUser). Only
// these are safe to overwrite with the company name - a team someone already
// named, or one the user was merely invited into, must be left alone.
function isDefaultTeamName(name: string) {
    return name === "My Team" || name.endsWith("'s Team") || name.endsWith(" Workspace");
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

    await prisma.user.update({
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

    const owned = await prisma.teamMember.findMany({
        where: { userId, role: "owner", status: "active" },
        select: { team: { select: { id: true, name: true } } },
    });
    if (owned.length === 1 && owned[0] && isDefaultTeamName(owned[0].team.name)) {
        await prisma.team.update({ where: { id: owned[0].team.id }, data: { name: company } });
    }

    return NextResponse.json({ success: true });
}
