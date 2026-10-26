import { createClient } from "npm:@supabase/supabase-js@2";

const CACHE_TABLE = "question_embedding_cache";

function getSecretKey(): string | null {
  const secretKeysJson = Deno.env.get("SUPABASE_SECRET_KEYS");

  if (secretKeysJson) {
    try {
      const secretKeys = JSON.parse(secretKeysJson) as Record<string, unknown>;
      if (typeof secretKeys.default === "string") {
        return secretKeys.default;
      }
    } catch {
      console.error("SUPABASE_SECRET_KEYS contains invalid JSON");
    }
  }

  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? null;
}

function createAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey = getSecretKey();

  if (!supabaseUrl || !secretKey) {
    return null;
  }

  return createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function parseEmbedding(value: unknown): number[] | null {
  let parsed = value;

  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }

  if (
    !Array.isArray(parsed) ||
    parsed.length !== 1536 ||
    !parsed.every((item) => typeof item === "number")
  ) {
    return null;
  }

  return parsed;
}

export async function createEmbeddingCacheKey(
  model: string,
  question: string,
): Promise<string> {
  const normalizedQuestion = question.normalize("NFKC").trim().replace(/\s+/g, " ");
  const input = new TextEncoder().encode(`${model}\n${normalizedQuestion}`);
  const digest = await crypto.subtle.digest("SHA-256", input);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function getCachedEmbedding(
  cacheKey: string,
): Promise<number[] | null> {
  const supabase = createAdminClient();
  if (!supabase) {
    console.warn("Embedding cache is unavailable: Supabase is not configured");
    return null;
  }

  const { data, error } = await supabase
    .from(CACHE_TABLE)
    .select("embedding")
    .eq("question_hash", cacheKey)
    .maybeSingle();

  if (error) {
    console.error("Failed to read embedding cache:", error.message);
    return null;
  }

  return parseEmbedding(data?.embedding);
}

export async function setCachedEmbedding(
  cacheKey: string,
  model: string,
  embedding: number[],
): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) {
    console.warn("Embedding cache is unavailable: Supabase is not configured");
    return;
  }

  const { error } = await supabase.from(CACHE_TABLE).upsert({
    question_hash: cacheKey,
    model,
    embedding,
  });

  if (error) {
    console.error("Failed to write embedding cache:", error.message);
  }
}
