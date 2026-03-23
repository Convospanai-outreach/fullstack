import { NextRequest, NextResponse } from 'next/server';
import { getCurrentContext } from '@/lib/auth';
import { prisma } from '@/lib/db';

const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
    try {
        const ctx = await getCurrentContext();
        if (!ctx.teamId || !ctx.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided. Use form field "file".' }, { status: 400 });
        }

        // Validate file type
        if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
            return NextResponse.json({ error: 'Only PDF files are accepted.' }, { status: 400 });
        }

        // Validate file size
        if (file.size > MAX_PDF_SIZE) {
            return NextResponse.json(
                { error: `File too large. Maximum size is ${MAX_PDF_SIZE / (1024 * 1024)}MB.` },
                { status: 413 }
            );
        }

        // Read file content
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const textContent = buffer.toString('utf-8');

        // First, ensure a KnowledgeBase exists for this team
        let knowledgeBase = await prisma.knowledgeBase.findFirst({
            where: { teamId: ctx.teamId }
        });

        if (!knowledgeBase) {
            knowledgeBase = await prisma.knowledgeBase.create({
                data: {
                    teamId: ctx.teamId,
                    name: 'Default Knowledge Base',
                    description: 'Auto-created for document uploads'
                }
            });
        }

        // Store as a KnowledgeItem
        const item = await prisma.knowledgeItem.create({
            data: {
                knowledgeBaseId: knowledgeBase.id,
                content: textContent.substring(0, 500000), // Cap content at 500K chars
                metadata: {
                    source: 'PDF',
                    type: 'PDF',
                    originalName: file.name,
                    sizeBytes: file.size,
                    mimeType: file.type,
                    uploadedBy: ctx.userId,
                    uploadedAt: new Date().toISOString()
                }
            }
        });

        return NextResponse.json({
            ok: true,
            documentId: item.id,
            knowledgeBaseId: knowledgeBase.id,
            title: file.name.replace('.pdf', ''),
            sizeBytes: file.size
        }, { status: 201 });

    } catch (error: any) {
        console.error('[PDF Upload] Error:', error);
        return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
    }
}
