import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";

export async function GET(_req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch Team, Members (Users), and Campaigns
    const team = await prisma.team.findUnique({
        where: { id: ctx.teamId },
        include: {
            members: {
                include: {
                    user: {
                        select: { id: true, name: true, image: true, email: true }
                    }
                }
            },
            campaigns: {
                select: { id: true, name: true, status: true, ownerId: true }
            }
        }
    });

    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

    const nodes: any[] = [];
    const edges: any[] = [];

    // 1. Root Node: Team
    nodes.push({
        id: `team-${team.id}`,
        type: 'input', // ReactFlow input type (root)
        data: { label: team.name },
        position: { x: 250, y: 0 },
        style: { background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', padding: '10px' }
    });

    // 2. Member Nodes (Level 1)
    team.members.forEach((member, index) => {
        const memberId = `user-${member.userId}`;
        const userName = member.user?.name || member.email;

        nodes.push({
            id: memberId,
            data: { label: userName },
            position: { x: 100 + (index * 200), y: 150 }, // Simple horizontal spread
            style: { border: '1px solid #777', padding: '10px', borderRadius: '5px' }
        });

        // Edge: Team -> Member
        edges.push({
            id: `e-team-${member.userId}`,
            source: `team-${team.id}`,
            target: memberId,
            animated: true
        });
    });

    // 3. Campaign Nodes (Level 2)
    // Group campaigns by owner (if tracked) or link to Team if ownerId is null/generic
    const campaignsByOwner = new Map<string, any[]>();

    team.campaigns.forEach(c => {
        const ownerId = c.ownerId || "unassigned"; // Campaigns usually have ownerId if created by user
        if (!campaignsByOwner.has(ownerId)) campaignsByOwner.set(ownerId, []);
        campaignsByOwner.get(ownerId)!.push(c);
    });

    let campIndex = 0;

    // Process unassigned
    if (campaignsByOwner.has("unassigned")) {
        campaignsByOwner.get("unassigned")!.forEach((c) => {
            const campId = `camp-${c.id}`;
            nodes.push({
                id: campId,
                data: { label: c.name },
                position: { x: campIndex * 200, y: 300 },
                style: { background: '#10b981', color: 'white', border: 'none', borderRadius: '20px', fontSize: '12px' }
            });
            edges.push({
                id: `e-team-${c.id}`, // Link to team directly
                source: `team-${team.id}`,
                target: campId,
                style: { stroke: '#10b981' }
            });
            campIndex++;
        });
    }

    // Process User Campaigns
    team.members.forEach((member) => {
        if (!member.userId) return; // Pending
        const userCamps = campaignsByOwner.get(member.userId);
        if (userCamps) {
            userCamps.forEach((c) => {
                const campId = `camp-${c.id}`;
                nodes.push({
                    id: campId,
                    data: { label: c.name },
                    position: { x: campIndex * 180, y: 350 }, // Roughly below
                    style: { background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '20px', fontSize: '12px' }
                });
                edges.push({
                    id: `e-${member.userId}-${c.id}`,
                    source: `user-${member.userId}`,
                    target: campId,
                    style: { stroke: '#8b5cf6' }
                });
                campIndex++;
            });
        }
    });

    return NextResponse.json({ nodes, edges });
}
