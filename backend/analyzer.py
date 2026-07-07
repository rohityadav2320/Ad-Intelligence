"""
AI analysis using Claude API.
Extracts hook, CTA, tone, pain points, score from transcript.
"""

import os
import json
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")


def analyze_transcript(
    transcript: str,
    hook_text: str,
    brand_name: str,
    days_running: int
) -> dict:
    """
    Send transcript to Claude and extract structured ad analysis.
    Returns dict matching ai_analysis table schema.
    """
    if not ANTHROPIC_API_KEY:
        print("[Analyzer] No Anthropic key — skipping analysis")
        return _empty_analysis()

    if not transcript or len(transcript.strip()) < 3:
        print("[Analyzer] Transcript empty — skipping")
        return _empty_analysis()

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

        prompt = f"""You are analyzing a video ad for the brand "{brand_name}".
This ad has been running for {days_running} days (longer = more likely it's converting well).

HOOK (first 3 seconds of the video):
{hook_text or "(not available)"}

FULL TRANSCRIPT:
{transcript}

Note: If the transcript is very short (1-2 lines), this is likely a visual-heavy ad where most communication happens through video — analyze based on what you can infer from the hook/transcript alone.

Extract and return ONLY valid JSON (no markdown, no explanation):
{{
  "hook": "the exact opening line or question from the transcript",
  "core_offer": "what product or benefit are they selling in one sentence",
  "cta": "what specific action do they ask the viewer to take",
  "tone": "one of: comedy / fear / emotional / informational / aspirational / story",
  "pain_points": ["list", "of", "specific", "problems", "this", "ad", "addresses"],
  "target_audience": "who this ad is clearly speaking to (age, job, situation, city tier if apparent)",
  "why_it_works": "2 sentence explanation of why this ad has likely been running well",
  "script_quality_score": 7,
  "hook_type": "one of: question / shocking_statement / story / pain_point / curiosity / stat"
}}

If any field is unclear from the transcript, use your best judgment based on context. Return only the JSON object."""

        message = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}]
        )

        response_text = message.content[0].text.strip()

        # Strip markdown code blocks if present
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]

        analysis = json.loads(response_text)
        print(f"[Analyzer] Done — hook: '{analysis.get('hook', '')[:50]}'")
        return analysis

    except json.JSONDecodeError as e:
        print(f"[Analyzer] JSON parse error: {e}")
        return _empty_analysis()
    except Exception as e:
        print(f"[Analyzer] Exception: {e}")
        return _empty_analysis()


def _empty_analysis() -> dict:
    return {
        "hook": "",
        "core_offer": "",
        "cta": "",
        "tone": "",
        "pain_points": [],
        "target_audience": "",
        "why_it_works": "",
        "script_quality_score": 0,
        "hook_type": ""
    }
