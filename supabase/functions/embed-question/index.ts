import {
  AuthenticationError,
  requireAuthenticatedUser,
} from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  createEmbeddingCacheKey,
  getCachedEmbedding,
  setCachedEmbedding,
} from "../_shared/embedding-cache.ts";

const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const EMBEDDING_MODEL = "text-embedding-3-small";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    await requireAuthenticatedUser(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Request body must be valid JSON" }, 400);
    }

    const question = (body as { question?: unknown })?.question;
    if (typeof question !== "string" || question.trim().length === 0) {
      return jsonResponse(
        { error: "A non-empty question string is required" },
        400,
      );
    }

    const normalizedQuestion = question.normalize("NFKC").trim().replace(
      /\s+/g,
      " ",
    );
    const cacheKey = await createEmbeddingCacheKey(
      EMBEDDING_MODEL,
      normalizedQuestion,
    );
    const cachedEmbedding = await getCachedEmbedding(cacheKey);

    if (cachedEmbedding) {
      return jsonResponse({ embedding: cachedEmbedding });
    }

    const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiApiKey) {
      console.error("OPENAI_API_KEY is not configured");
      return jsonResponse({ error: "Embedding service is not configured" }, 500);
    }

    const openAiResponse = await fetch(OPENAI_EMBEDDINGS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: normalizedQuestion,
      }),
    });

    if (!openAiResponse.ok) {
      const errorText = await openAiResponse.text();
      console.error(
        `OpenAI embeddings request failed (${openAiResponse.status}): ${errorText}`,
      );
      return jsonResponse({ error: "Failed to generate embedding" }, 502);
    }

    const openAiData = await openAiResponse.json() as {
      data?: Array<{ embedding?: number[] }>;
    };
    const embedding = openAiData.data?.[0]?.embedding;

    if (!Array.isArray(embedding)) {
      console.error("OpenAI returned an invalid embeddings response");
      return jsonResponse({ error: "Failed to generate embedding" }, 502);
    }

    await setCachedEmbedding(cacheKey, EMBEDDING_MODEL, embedding);

    return jsonResponse({ embedding });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return jsonResponse({ error: "Authentication required" }, 401);
    }

    console.error("embed-question failed:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
