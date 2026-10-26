CREATE TABLE IF NOT EXISTS public.question_embedding_cache (
    question_hash TEXT PRIMARY KEY,
    model TEXT NOT NULL,
    embedding vector(1536) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT question_embedding_cache_hash_format
        CHECK (question_hash ~ '^[0-9a-f]{64}$')
);

ALTER TABLE public.question_embedding_cache ENABLE ROW LEVEL SECURITY;

-- The Edge Function accesses this table with its service-role key. Browser
-- clients should never read or write the cache directly.
REVOKE ALL ON TABLE public.question_embedding_cache FROM anon, authenticated;
