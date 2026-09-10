-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Update KnowledgeItem table to use vector type
-- Note: This migration assumes embeddings are currently stored as JSON
-- You may need to convert existing data

-- Add a temporary vector column
ALTER TABLE "KnowledgeItem" ADD COLUMN IF NOT EXISTS "embedding_vector" vector(768);

-- Migrate existing JSON embeddings to vector type (if data exists)
-- UPDATE "KnowledgeItem" 
-- SET "embedding_vector" = embedding::text::vector
-- WHERE embedding IS NOT NULL;

-- Once migration is verified, you can drop the old column and rename:
-- ALTER TABLE "KnowledgeItem" DROP COLUMN "embedding";
-- ALTER TABLE "KnowledgeItem" RENAME COLUMN "embedding_vector" TO "embedding";

-- Create index for fast similarity search
CREATE INDEX IF NOT EXISTS "KnowledgeItem_embedding_idx" 
ON "KnowledgeItem" 
USING ivfflat ("embedding_vector" vector_cosine_ops)
WITH (lists = 100);
