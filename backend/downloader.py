"""
Video downloader using yt-dlp.
Downloads Meta ad videos to local storage.
"""

import os
import re
import uuid
import asyncio
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

VIDEO_DIR = Path(os.getenv("VIDEO_STORAGE_PATH", "../videos")).resolve()
VIDEO_DIR.mkdir(parents=True, exist_ok=True)


def sanitize_filename(name: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_\-]", "_", name)


def download_video(video_url: str, brand_name: str, ad_id: str, force: bool = False) -> str:
    """
    Download a video from a URL and save locally.
    Returns the local file path, or empty string on failure.
    Set force=True to re-download even if a file already exists.
    """
    if not video_url:
        return ""

    brand_dir = VIDEO_DIR / sanitize_filename(brand_name)
    brand_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{sanitize_filename(ad_id)}.mp4"
    output_path = brand_dir / filename

    # If already downloaded (and not forcing), skip
    if not force and output_path.exists() and output_path.stat().st_size > 0:
        print(f"[Downloader] Already exists: {output_path}")
        return str(output_path)

    if force and output_path.exists():
        output_path.unlink()

    # Try direct download first (for CDN URLs)
    if _direct_download(video_url, output_path):
        print(f"[Downloader] Direct download: {output_path}")
        return str(output_path)

    # Fallback to yt-dlp
    if _ytdlp_download(video_url, output_path):
        print(f"[Downloader] yt-dlp download: {output_path}")
        return str(output_path)

    print(f"[Downloader] Failed to download: {video_url}")
    return ""


def _direct_download(url: str, output_path: Path, retries: int = 3) -> bool:
    """Download video directly from CDN URL, verifying the full file arrived."""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Referer": "https://www.facebook.com/"
    }

    for attempt in range(retries):
        try:
            response = requests.get(url, headers=headers, stream=True, timeout=120)
            response.raise_for_status()

            content_type = response.headers.get("content-type", "")
            if "video" not in content_type and "octet-stream" not in content_type:
                return False

            # Expected size from server (to verify completeness)
            expected = response.headers.get("content-length")
            expected = int(expected) if expected and expected.isdigit() else None

            with open(output_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=65536):
                    f.write(chunk)

            actual = output_path.stat().st_size

            # Verify the download is complete
            if actual < 10000:
                print(f"[Downloader] File too small ({actual} bytes), retrying...")
                continue
            if expected and actual < expected * 0.98:  # allow 2% tolerance
                print(f"[Downloader] Incomplete: got {actual}/{expected} bytes (attempt {attempt+1}/{retries}), retrying...")
                continue

            return True  # complete

        except Exception as e:
            print(f"[Downloader] Direct download attempt {attempt+1} failed: {e}")

    if output_path.exists():
        output_path.unlink()
    return False


def _ytdlp_download(url: str, output_path: Path) -> bool:
    """Download using yt-dlp as fallback."""
    try:
        import yt_dlp
        ydl_opts = {
            "outtmpl": str(output_path),
            "format": "best[ext=mp4]/best",
            "quiet": True,
            "no_warnings": True,
            "http_headers": {
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36"
                )
            }
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
        return output_path.exists() and output_path.stat().st_size > 10000

    except Exception as e:
        print(f"[Downloader] yt-dlp failed: {e}")
        return False


def get_video_url_for_frontend(local_path: str) -> str:
    """Convert local path to URL served by FastAPI."""
    if not local_path:
        return ""
    path = Path(local_path)
    # Return relative path from videos/ dir for API serving
    try:
        rel = path.relative_to(VIDEO_DIR)
        return f"/videos/{rel}"
    except ValueError:
        return f"/videos/{path.name}"
