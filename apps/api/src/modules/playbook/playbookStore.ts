import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { aiService } from "@/lib/aiService";
import { toVectorLiteral } from "@/lib/ai/vectorLiteral";
import { assertOutsideRepo } from "@/evals/copy/evalData";
import { chunkMarkdown, type PlaybookChunk } from "./chunkPlaybook";

// The playbook is private: this repo holds only the loader and search. The text is read from a
// folder outside the checkout and stored in the database as one knowledge base under a platform
// team (PLAYBOOK_TEAM_ID). Customer searches are scoped to their own team's knowledge bases, so
// they never see it; the generator reaches it only through searchPlaybook.

export const PLAYBOOK_KB_NAME = "CMF Playbook";
const SOURCE = "playbook";
const EXTENSIONS = new Set([".md", ".markdown", ".txt"]);

export function readPlaybookChunks(dir: string, repoRoot?: string | null): PlaybookChunk[] {
    if (repoRoot === undefined) assertOutsideRepo(dir);
    else assertOutsideRepo(dir, repoRoot);
    const chunks: PlaybookChunk[] = [];
    const walk = (current: string) => {
        for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
                const rel = path.relative(dir, full).split(path.sep).join("/");
                chunks.push(...chunkMarkdown(rel, fs.readFileSync(full, "utf8")));
            }
        }
    };
    walk(dir);
    if (chunks.length === 0) throw new Error(`No playbook text found in ${dir} (looked for .md, .markdown, .txt).`);
    return chunks;
}

export interface SyncPlan {
    toAdd: PlaybookChunk[];
    toRemove: string[]; // KnowledgeItem ids whose text is gone or changed
    unchanged: number;
}

export function planSync(chunks: PlaybookChunk[], existing: { id: string; hash: string | null }[]): SyncPlan {
    const wanted = new Set(chunks.map((c) => c.hash));
    const have = new Set(existing.map((e) => e.hash).filter((h): h is string => !!h));
    return {
        toAdd: chunks.filter((c, i) => !have.has(c.hash) && chunks.findIndex((o) => o.hash === c.hash) === i),
        toRemove: existing.filter((e) => !e.hash || !wanted.has(e.hash)).map((e) => e.id),
        unchanged: [...wanted].filter((h) => have.has(h)).length,
    };
}

async function findOrCreateKnowledgeBase(teamId: string, create: boolean) {
    const existing = await prisma.knowledgeBase.findFirst({ where: { teamId, name: PLAYBOOK_KB_NAME }, select: { id: true } });
    if (existing || !create) return existing;
    return prisma.knowledgeBase.create({
        data: { teamId, name: PLAYBOOK_KB_NAME, description: "Private outreach playbook used to ground generated copy." },
        select: { id: true },
    });
}

export interface SyncResult extends SyncPlan {
    dryRun: boolean;
    added: number;
    removed: number;
    failed: number;
}

// Brings the stored playbook in line with the folder: new or changed chunks are embedded and added,
// chunks whose text is gone or changed are removed. A chunk that cannot be embedded is not kept,
// so the next sync tries it again.
export async function syncPlaybook(chunks: PlaybookChunk[], teamId: string, options: { dryRun: boolean }): Promise<SyncResult> {
    const kb = await findOrCreateKnowledgeBase(teamId, !options.dryRun);
    const items = kb ? await prisma.knowledgeItem.findMany({ where: { knowledgeBaseId: kb.id }, select: { id: true, metadata: true } }) : [];
    const plan = planSync(chunks, items.map((i) => ({ id: i.id, hash: ((i.metadata as any)?.hash as string | undefined) ?? null })));
    if (options.dryRun || !kb) return { ...plan, dryRun: true, added: 0, removed: 0, failed: 0 };

    let added = 0;
    let failed = 0;
    for (const chunk of plan.toAdd) {
        try {
            const embedding = await aiService.getRagEmbedding(chunk.text, teamId);
            const item = await prisma.knowledgeItem.create({
                data: {
                    content: chunk.text,
                    knowledgeBaseId: kb.id,
                    metadata: { source: SOURCE, file: chunk.file, heading: chunk.heading, hash: chunk.hash },
                },
                select: { id: true },
            });
            try {
                await prisma.$executeRawUnsafe(`UPDATE "KnowledgeItem" SET embedding = $1::vector WHERE id = $2`, toVectorLiteral(embedding), item.id);
            } catch (error) {
                await prisma.knowledgeItem.delete({ where: { id: item.id } }).catch(() => {});
                throw error;
            }
            added++;
        } catch (error: any) {
            failed++;
            logger.warn("[playbook] Could not add a chunk", { file: chunk.file, heading: chunk.heading, error: error?.message ?? String(error) });
        }
    }

    // Removed only after the additions, so a failed run never leaves the playbook emptier than it was.
    const removed = plan.toRemove.length
        ? (await prisma.knowledgeItem.deleteMany({ where: { id: { in: plan.toRemove }, knowledgeBaseId: kb.id } })).count
        : 0;
    return { ...plan, dryRun: false, added, removed, failed };
}

export interface PlaybookHit {
    id: string;
    content: string;
    heading: string | null;
    file: string | null;
    similarity: number;
}

// Nearest playbook chunks to the query. Fails open: with no playbook, no embedding key or a search
// error it returns nothing (and warns), so copy generation carries on without playbook context.
export async function searchPlaybook(
    query: string,
    teamId: string | undefined,
    options: { limit?: number; minSimilarity?: number } = {},
): Promise<PlaybookHit[]> {
    if (!query.trim() || !teamId) return [];
    const limit = Math.min(Math.max(Math.trunc(options.limit ?? 4), 1), 20);
    try {
        const embedding = await aiService.getRagEmbedding(query, teamId);
        const rows = await prisma.$queryRawUnsafe<{ id: string; content: string; metadata: any; similarity: number }[]>(
            `SELECT ki.id, ki.content, ki.metadata, 1 - (ki.embedding <=> $1::vector) AS similarity
             FROM "KnowledgeItem" ki
             JOIN "KnowledgeBase" kb ON ki."knowledgeBaseId" = kb.id
             WHERE kb."teamId" = $2 AND kb.name = $3 AND ki.embedding IS NOT NULL
             ORDER BY ki.embedding <=> $1::vector
             LIMIT $4`,
            toVectorLiteral(embedding),
            teamId,
            PLAYBOOK_KB_NAME,
            limit,
        );
        return rows
            .map((r) => ({ id: r.id, content: r.content, heading: r.metadata?.heading ?? null, file: r.metadata?.file ?? null, similarity: Number(r.similarity) }))
            .filter((r) => r.similarity >= (options.minSimilarity ?? 0));
    } catch (error: any) {
        logger.warn("[playbook] Search unavailable, continuing without playbook context", { error: error?.message ?? String(error) });
        return [];
    }
}
