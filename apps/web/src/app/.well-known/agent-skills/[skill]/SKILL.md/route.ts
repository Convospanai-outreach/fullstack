import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAgentSkillContent } from '@/lib/agentSkills';

export const dynamic = 'force-static';
export const revalidate = 86400; // 24 hours

export async function GET(
    _req: NextRequest,
    context: { params: Promise<{ skill: string }> }
) {
    const { skill } = await context.params;
    const content = getAgentSkillContent(skill);

    if (!content) {
        return new NextResponse('Skill not found', { status: 404 });
    }

    return new NextResponse(content, {
        status: 200,
        headers: {
            'Content-Type': 'text/markdown; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        },
    });
}
