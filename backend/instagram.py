"""
Instagram Reel downloader using yt-dlp.
Downloads public reels, saves to videos/instagram/ folder.
"""

import os
import sys
import subprocess
import uuid
from pathlib import Path

VIDEO_DIR = Path(os.getenv("VIDEO_STORAGE_PATH", "../videos")).resolve()
INSTA_DIR = VIDEO_DIR / "instagram"
INSTA_DIR.mkdir(parents=True, exist_ok=True)

# Use yt-dlp from the same venv as the backend
YTDLP = str(Path(sys.executable).parent / "yt-dlp")


def is_instagram_url(url: str) -> bool:
    return "instagram.com" in url and ("/reel/" in url or "/p/" in url or "/tv/" in url)


def download_reel(url: str) -> dict:
    """
    Download an Instagram Reel using yt-dlp.
    Returns { success, local_path, serve_url, title, error }
    """
    url = url.strip().split("?")[0]  # strip tracking params

    file_id = str(uuid.uuid4())[:8]
    out_path = INSTA_DIR / f"{file_id}.mp4"

    try:
        result = subprocess.run(
            [
                YTDLP,
                "--quiet",
                "--no-warnings",
                "--cookies-from-browser", "chrome",
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

        if not out_path.exists():
            # yt-dlp sometimes adds extension — find the file
            matches = list(INSTA_DIR.glob(f"{file_id}*"))
            if matches:
                out_path = matches[0]
            else:
                return {"success": False, "error": "File not found after download"}

        serve_url = f"/videos/instagram/{out_path.name}"
        print(f"[Instagram] Downloaded: {out_path.name} ({out_path.stat().st_size // 1024}KB)")

        return {
            "success": True,
            "local_path": str(out_path),
            "serve_url": serve_url,
            "filename": out_path.name,
        }

    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Download timed out (120s)"}
    except Exception as e:
        return {"success": False, "error": str(e)}
