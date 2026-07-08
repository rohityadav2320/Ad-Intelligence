"""
Transcription: ElevenLabs Scribe only.
ElevenLabs handles all Indian languages + background music + speaker diarization.
"""

import os
import re
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")


def transcribe_from_url(video_url: str, ad_id: str) -> dict:
    """
    Download a video from a URL (Meta CDN or Supabase Storage) to /tmp/,
    transcribe it, then delete the temp file.
    Called by the backend when the agent requests transcription for an ad.
    """
    import requests as req

    if not video_url:
        print("[Transcriber] No video URL provided")
        return _empty()

    tmp_path = f"/tmp/ad_{ad_id[:8]}.mp4"
    try:
        print(f"[Transcriber] Downloading from CDN...")
        r = req.get(video_url, timeout=60, stream=True)
        r.raise_for_status()
        with open(tmp_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)
        size_kb = Path(tmp_path).stat().st_size // 1024
        print(f"[Transcriber] Downloaded {size_kb}KB, transcribing...")
        return transcribe_video(tmp_path)
    except Exception as e:
        print(f"[Transcriber] Error downloading from URL: {e}")
        return _empty()
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass


def transcribe_video(video_path: str) -> dict:
    if not video_path or not Path(video_path).exists():
        print(f"[Transcriber] Video not found: {video_path}")
        return _empty()

    if not ELEVENLABS_API_KEY:
        print("[Transcriber] No ELEVENLABS_API_KEY set")
        return _empty()

    print("[Transcriber] Sending to ElevenLabs Scribe...")
    result = _transcribe_elevenlabs(video_path)

    if not result or not result.get("full_text", "").strip():
        print("[Transcriber] No speech detected")
        return _empty()

    # Clean up any artifacts
    text = result["full_text"]
    text = re.sub(r'\.{2,}', '', text)
    text = re.sub(r'\s{2,}', ' ', text).strip()
    result["full_text"] = text

    # Hook from first speaker line
    if not result.get("hook_text") and text:
        first_line = text.split("\n")[0]
        result["hook_text"] = first_line.split(":", 1)[1].strip() if ("Speaker" in first_line and ":" in first_line) else first_line.strip()

    print(f"[Transcriber] Done — {len(text)} chars, lang: {result.get('language')}, hook: '{result.get('hook_text','')[:60]}'")
    return result


def _transcribe_elevenlabs(video_path: str) -> dict:
    try:
        import requests

        with open(video_path, "rb") as f:
            response = requests.post(
                "https://api.elevenlabs.io/v1/speech-to-text",
                headers={"xi-api-key": ELEVENLABS_API_KEY},
                files={"file": (Path(video_path).name, f, "video/mp4")},
                data={
                    "model_id": "scribe_v1",
                    "diarize": "true",
                    "tag_audio_events": "false",
                },
                timeout=120,
            )

        if response.status_code != 200:
            print(f"[ElevenLabs] Error {response.status_code}: {response.text[:200]}")
            return None

        data = response.json()
        words_raw = data.get("words", [])
        detected_lang = data.get("language_code", "unknown")

        if not words_raw:
            print("[ElevenLabs] Empty response")
            return None

        # Build Speaker N: labelled transcript
        speaker_map = {}
        lines = []
        current_speaker = None
        current_words = []

        for w in words_raw:
            if w.get("type") != "word":
                continue
            spk_id = w.get("speaker_id") or "A"
            text = w.get("text", "")
            if spk_id not in speaker_map:
                speaker_map[spk_id] = f"Speaker {len(speaker_map) + 1}"
            if spk_id != current_speaker:
                if current_speaker is not None and current_words:
                    lines.append(f"{speaker_map[current_speaker]}: {' '.join(current_words)}")
                current_speaker = spk_id
                current_words = [text]
            else:
                current_words.append(text)

        if current_speaker and current_words:
            lines.append(f"{speaker_map[current_speaker]}: {' '.join(current_words)}")

        full_text = "\n".join(lines) if lines else data.get("text", "")
        hook_words = [w.get("text", "") for w in words_raw if w.get("type") == "word" and (w.get("start") or 0) <= 3.0]

        print(f"[ElevenLabs] Done — {len(speaker_map)} speakers, lang: {detected_lang}")
        return {
            "full_text": full_text,
            "hook_text": " ".join(hook_words),
            "word_timestamps": [
                {"text": w.get("text"), "start": int((w.get("start") or 0) * 1000), "end": int((w.get("end") or 0) * 1000), "confidence": 1.0}
                for w in words_raw if w.get("type") == "word"
            ],
            "language": detected_lang,
        }

    except Exception as e:
        print(f"[ElevenLabs] Exception: {e}")
        return None


def _empty() -> dict:
    return {"full_text": "", "hook_text": "", "word_timestamps": [], "language": "unknown"}
