"""
Standalone pipeline runner — invoked as an isolated subprocess by the API.
This avoids event-loop/subprocess conflicts with FastAPI's background threads.

Brand mode:  python run_job.py <brand_name> <session_id> <max_ads> [client_id] [role] [reprocess]
Single-ad:   python run_job.py --single "<ad_url_or_id>" <session_id>
"""

import sys
import asyncio
from pipeline import run_pipeline, run_single_ad_pipeline


def main():
    if len(sys.argv) >= 4 and sys.argv[1] == "--single":
        url_or_id = sys.argv[2]
        session_id = sys.argv[3]
        client_id = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != "-" else None
        role = sys.argv[5] if len(sys.argv) > 5 else "competitor"
        asyncio.run(run_single_ad_pipeline(url_or_id, session_id, client_id, role))
        return

    if len(sys.argv) < 3:
        print("Usage: python run_job.py <brand_name> <session_id> [max_ads] [client_id] [role] [reprocess]")
        sys.exit(1)

    brand_name = sys.argv[1]
    session_id = sys.argv[2]
    max_ads = int(sys.argv[3]) if len(sys.argv) > 3 else 10
    client_id = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != "-" else None
    role = sys.argv[5] if len(sys.argv) > 5 else "competitor"
    reprocess = len(sys.argv) > 6 and sys.argv[6] == "reprocess"

    asyncio.run(run_pipeline(brand_name, session_id, max_ads, client_id, role, reprocess))


if __name__ == "__main__":
    main()
