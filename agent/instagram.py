"""
Instagram Reel downloader for the agent.
Downloads to /tmp/ using yt-dlp + Chrome cookies (logged-in session on this laptop).
The agent then sends the file to the backend for transcription.
"""

import os
import sys
import subprocess
import uuid
from pathlib import Path

# Use yt-dlp from the same venv
YTDLP = str(Path(sys.executable).parent / "yt-dlp")
TMP_DIR = Path("/tmp/ad-intelligence")
TMP_DIR.mkdir(parents=True, exist_ok=True)


def is_instagram_url(url: str) -> bool:
    return "instagram.com" in url and ("/reel/" in url or "/p/" in url or "/tv/" in url)


def download_reel(url: str) -> dict:
    """
    Download an Instagram Reel to /tmp/ using yt-dlp + Chrome cookies.
    Returns { success, local_path, error }
    """
    url = url.strip().split("?")[0]  # strip tracking params

    file_id = str(uuid.uuid4())[:8]
    out_path = TMP_DIR / f"{file_id}.mp4"

    try:
        result = subprocess.run(
            [
                YTDLP,
                "--quiet",
                "--no-warnings",
                "--cookies-from-browser", "chrome",   # reads Chrome's logged-in Instagram session
                "-f", "mp4/best[ext=mp4]/best",
                "--output", str(out_path),
                "--no-playlist",
                url,
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )

        if result.returncode != 0:
            err = result.stderr.strip() or "yt-dlp failed"
            print(f"[Instagram] yt-dlp error: {err}")
            return {"success": False, "error": err}

        # yt-dlp sometimes adds extension — find the file
        if not out_path.exists():
            matches = list(TMP_DIR.glob(f"{file_id}*"))
            if matches:
                out_path = matches[0]
            else:
                return {"success": False, "error": "File not found after download"}

        size_kb = out_path.stat().st_size // 1024
        print(f"[Instagram] Downloaded: {out_path.name} ({size_kb}KB)")
        return {"success": True, "local_path": str(out_path)}

    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Download timed out (120s)"}
    except Exception as e:
        return {"success": False, "error": str(e)}
