"""Check which Supabase tables are readable with the public anon key.

Usage:
    python scripts/06_test_anon_access.py

This script performs SELECT queries only. It intentionally uses the anon key
from config.public.json rather than the service-role key.
"""

import json
from pathlib import Path

from supabase import create_client


PROJECT_ROOT = Path(__file__).resolve().parent.parent
PUBLIC_CONFIG_FILE = PROJECT_ROOT / "config.public.json"


def main() -> None:
    with PUBLIC_CONFIG_FILE.open(encoding="utf-8") as config_file:
        public = json.load(config_file)

    client = create_client(
        public["SUPABASE_URL"],
        public["SUPABASE_ANON_KEY"],
    )

    # page_views has a public SELECT policy, so the anon client can read it.
    page_views = client.table("page_views").select("*").limit(5).execute()
    print(f"page_views: {len(page_views.data)} rows [OK]")

    # sentence_embeddings requires authentication, so RLS hides its rows.
    sentence_embeddings = (
        client.table("sentence_embeddings").select("*").limit(5).execute()
    )
    print(
        f"sentence_embeddings: {len(sentence_embeddings.data)} rows "
        "(expected: 0) [LOCKED]"
    )


if __name__ == "__main__":
    main()
