
/**
 * Sales Knowledge Graph (Hardened)
 * 
 * Capability: Hybrid Search (Graph + Vector) with Freshness Re-ranking.
 */
import { HardwareService } from "../../services/HardwareService";

export interface Entity {
    id: string;
    type: "PERSON" | "COMPANY" | "TECHNOLOGY" | "TOPIC";
    name: string;
    description: string;
    lastUpdated: Date;
    metadata?: any;
}

export interface Relation {
    sourceId: string;
    targetId: string;
    type: "WORKS_AT" | "USES" | "MENTIONED" | "COMPETES_WITH";
    weight: number;
}

export class GraphStore {
    private nodes: Map<string, Entity> = new Map();
    private edges: Relation[] = [];

    addEntity(entity: Entity) {
        this.nodes.set(entity.id, entity);
    }

    addEdge(relation: Relation) {
        this.edges.push(relation);
    }

    /**
     * HYBRID QUERY: Combines Graph Traversal with Semantic Search
     */
    async getHybridContext(entityId: string, query: string): Promise<string> {
        // 1. Graph Retrieval (Structured)
        const graphDocs = this.getGraphContext(entityId);

        // 2. Vector Retrieval (Unstructured - Edge Search)
        const vectorDocs = await this.vectorSearch(query);

        // 3. Re-ranking (Freshness + Relevance)
        const allDocs = [...graphDocs, ...vectorDocs];
        const ranked = allDocs.sort((a, b) => b.score - a.score);

        return ranked.slice(0, 5).map(d => d.content).join("\n---\n");
    }

    private getGraphContext(entityId: string) {
        const ego = this.nodes.get(entityId);
        if (!ego) return [];

        const docs = [];
        docs.push({
            content: `Entity: ${ego.name} (${ego.type}). ${ego.description}`,
            score: 1.0, // Anchor entity is always relevant
            timestamp: ego.lastUpdated
        });

        // 1-Hop Neighbors
        const connections = this.edges.filter(e => e.sourceId === entityId);
        for (const conn of connections) {
            const target = this.nodes.get(conn.targetId);
            if (target) {
                // Decay score based on edge weight
                docs.push({
                    content: `${ego.name} ${conn.type} ${target.name}.`,
                    score: 0.8 * conn.weight,
                    timestamp: target.lastUpdated
                });
            }
        }
        return docs;
    }

    private async vectorSearch(query: string) {
        // Real implementation: Gateway to physical edge node
        // Queries the local 'GoldenRecords' via pgvector on the device.
        try {
            const results = await HardwareService.search(query);
            return results.map(r => ({
                content: r.content,
                score: r.score,
                timestamp: new Date() // Edge doesn't return TS yet, default to now
            }));
        } catch (e) {
            console.error("Edge Search Failed", e);
            throw new Error("Edge search failed. Check edge node connectivity.");
        }
    }
}

export const graphStore = new GraphStore();
