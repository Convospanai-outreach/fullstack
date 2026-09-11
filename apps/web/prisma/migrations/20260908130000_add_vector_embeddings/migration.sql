CREATE EXTENSION IF NOT EXISTS vector;

-- KnowledgeItem.embedding (old String? column) is confirmed always NULL in
-- every existing row (nothing ever wrote it) - safe to drop and recreate typed.
ALTER TABLE "KnowledgeItem" DROP COLUMN "embedding";
ALTER TABLE "KnowledgeItem" ADD COLUMN "embedding" vector(1536);
ALTER TABLE "KnowledgeItem" ALTER COLUMN "embeddingModel" SET DEFAULT 'text-embedding-3-small';

-- AgentMemory has no prior embedding column.
ALTER TABLE "AgentMemory" ADD COLUMN "embedding" vector(1536);

-- HNSW: no lists-tuning parameter needed, works correctly from an empty or
-- small table, which fits per-team knowledge bases that start small.
CREATE INDEX "KnowledgeItem_embedding_hnsw_idx" ON "KnowledgeItem"
  USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX "AgentMemory_embedding_hnsw_idx" ON "AgentMemory"
  USING hnsw ("embedding" vector_cosine_ops);
