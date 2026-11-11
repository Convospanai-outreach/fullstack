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
//
// syncKnowledgeItems and searchKnowledgeBase are the shared mechanics; the gold set uses them too.

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

export interface SyncPlan<T extends { hash: string } = PlaybookChunk> {
    toAdd: T[];
    toRemove: string[]; // KnowledgeItem ids whose text is gone or changed
    unchanged: number;
}

export function planSync<T extends { hash: string }>(chunks: T[], existing: { id: string; hash: string | null }[]): SyncPlan<T> {
    const wanted = new Set(chunks.map((c) => c.hash));
    const have = new Set(existing.map((e) => e.hash).filter((h): h is string => !!h));
    return {
        toAdd: chunks.filter((c, i) => !have.has(c.hash) && chunks.findIndex((o) => o.hash === c.hash) === i),
        toRemove: existing.filter((e) => !e.hash || !wanted.has(e.hash)).map((e) => e.id),
        unchanged: [...wanted].filter((h) => have.has(h)).length,
    };
}

async function findOrCreateKnowledgeBase(teamId: string, name: string, description: string, create: boolean) {
    const existing = await prisma.knowledgeBase.findFirst({ where: { teamId, name }, select: { id: true } });
    if (existing || !create) return existing;
    return prisma.knowledgeBase.create({ data: { teamId, name, description }, select: { id: true } });
}

export interface SyncResult<T extends { hash: string } = PlaybookChunk> extends SyncPlan<T> {
    dryRun: boolean;
    added: number;
    removed: number;
    failed: number;
}

// One thing to store: `content` is what gets embedded and returned; `metadata` rides along (the
// item's `hash` is added to it when stored).
export interface KbItem {
    hash: string;
    content: string;
    metadata: Record<string, unknown>;
    label: string; // for log lines only
}

// Brings a knowledge base in line with the items: new or changed ones are embedded and added, ones
// whose text is gone or changed are removed. An item that cannot be embedded is not kept, so the
// next sync tries it again.
export async function syncKnowledgeItems(
    kbName: string,
    kbDescription: string,
    items: KbItem[],
    teamId: string,
    options: { dryRun: boolean },
): Promise<SyncResult<KbItem>> {
    const kb = await findOrCreateKnowledgeBase(teamId, kbName, kbDescription, !options.dryRun);
    const existing = kb ? await prisma.knowledgeItem.findMany({ where: { knowledgeBaseId: kb.id }, select: { id: true, metadata: true } }) : [];
    const plan = planSync(items, existing.map((i) => ({ id: i.id, hash: ((i.metadata as any)?.hash as string | undefined) ?? null })));
    if (options.dryRun || !kb) return { ...plan, dryRun: true, added: 0, removed: 0, failed: 0 };

    let added = 0;
    let failed = 0;
    for (const item of plan.toAdd) {
        try {
            const embedding = await aiService.getRagEmbedding(item.content, teamId);
            const row = await prisma.knowledgeItem.create({
                data: { content: item.content, knowledgeBaseId: kb.id, metadata: { ...item.metadata, hash: item.hash } as any },
                select: { id: true },
            });
            try {
                await prisma.$executeRawUnsafe(`UPDATE "KnowledgeItem" SET embedding = $1::vector WHERE id = $2`, toVectorLiteral(embedding), row.id);
            } catch (error) {
                await prisma.knowledgeItem.delete({ where: { id: row.id } }).catch(() => {});
                throw error;
            }
            added++;
        } catch (error: any) {
            failed++;
            logger.warn("[knowledge sync] Could not add an item", { kb: kbName, item: item.label, error: error?.message ?? String(error) });
        }
    }

    // Removed only after the additions, so a failed run never leaves the knowledge base emptier than it was.
    const removed = plan.toRemove.length
        ? (await prisma.knowledgeItem.deleteMany({ where: { id: { in: plan.toRemove }, knowledgeBaseId: kb.id } })).count
        : 0;
    return { ...plan, dryRun: false, added, removed, failed };
}

export async function syncPlaybook(chunks: PlaybookChunk[], teamId: string, options: { dryRun: boolean }): Promise<SyncResult<KbItem>> {
    return syncKnowledgeItems(
        PLAYBOOK_KB_NAME,
        "Private outreach playbook used to ground generated copy.",
        chunks.map((c) => ({
            hash: c.hash,
            content: c.text,
            metadata: { source: SOURCE, file: c.file, heading: c.heading },
            label: `${c.file} > ${c.heading}`,
        })),
        teamId,
        options,
    );
}

export interface KbHit {
    id: string;
    content: string;
    metadata: Record<string, any> | null;
    similarity: number;
}

// Nearest items in one named knowledge base of a team, optionally limited to rows whose metadata
// field equals a value. Fails open: with no knowledge base, no embedding key or a search error it
// returns nothing (and warns), so copy generation carries on without the extra context.
export async function searchKnowledgeBase(
    kbName: string,
    query: string,
    teamId: string | undefined,
    options: { limit?: number; minSimilarity?: number; metadataEquals?: { key: string; value: string } } = {},
): Promise<KbHit[]> {
    if (!query.trim() || !teamId) return [];
    const limit = Math.min(Math.max(Math.trunc(options.limit ?? 4), 1), 20);
    const filter = options.metadataEquals;
    try {
        const embedding = await aiService.getRagEmbedding(query, teamId);
        const rows = await prisma.$queryRawUnsafe<{ id: string; content: string; metadata: any; similarity: number }[]>(
            `SELECT ki.id, ki.content, ki.metadata, 1 - (ki.embedding <=> $1::vector) AS similarity
             FROM "KnowledgeItem" ki
             JOIN "KnowledgeBase" kb ON ki."knowledgeBaseId" = kb.id
             WHERE kb."teamId" = $2 AND kb.name = $3 AND ki.embedding IS NOT NULL${filter ? " AND ki.metadata->>$5 = $6" : ""}
             ORDER BY ki.embedding <=> $1::vector
             LIMIT $4`,
            toVectorLiteral(embedding),
            teamId,
            kbName,
            limit,
            ...(filter ? [filter.key, filter.value] : []),
        );
        return rows
            .map((r) => ({ id: r.id, content: r.content, metadata: r.metadata ?? null, similarity: Number(r.similarity) }))
            .filter((r) => r.similarity >= (options.minSimilarity ?? 0));
    } catch (error: any) {
        logger.warn("[knowledge search] Search unavailable, continuing without it", { kb: kbName, error: error?.message ?? String(error) });
        return [];
    }
}

export interface PlaybookHit {
    id: string;
    content: string;
    heading: string | null;
    file: string | null;
    similarity: number;
}

export async function searchPlaybook(
    query: string,
    teamId: string | undefined,
    options: { limit?: number; minSimilarity?: number } = {},
): Promise<PlaybookHit[]> {
    const hits = await searchKnowledgeBase(PLAYBOOK_KB_NAME, query, teamId, options);
    return hits.map((h) => ({ id: h.id, content: h.content, heading: h.metadata?.heading ?? null, file: h.metadata?.file ?? null, similarity: h.similarity }));
}
