-- Accelerate cosine-distance searches performed by match_sentences().
CREATE INDEX IF NOT EXISTS sentence_embeddings_embedding_hnsw_idx
ON public.sentence_embeddings
USING hnsw (embedding vector_cosine_ops);

ANALYZE public.sentence_embeddings;
