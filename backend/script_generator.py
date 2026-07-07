"""
Script generator — rewrites a competitor ad or doubles down on a winning ad using Claude Sonnet.
Uses a two-step psychological decoding approach for maximum script quality.
"""

import os
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")


def _call_sonnet(prompt: str, max_tokens: int = 3000) -> str:
    import anthropic
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    message = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}]
    )
    return message.content[0].text.strip()


def _decode_ad_psychology(transcript: str, analysis: dict, brand_name: str) -> str:
    """
    Step 1: Force Claude to deeply decode WHY this ad works before writing anything.
    Returns a psychology brief that gets fed into the script generation step.
    """
    tone = analysis.get("tone", "")
    hook_type = analysis.get("hook_type", "")
    why_it_works = analysis.get("why_it_works", "")
    pain_points = ", ".join(analysis.get("pain_points", [])) or "not specified"

    prompt = f"""You are an expert in Indian consumer psychology and performance advertising.

Analyze this ad transcript deeply. Your job is NOT to write a new script — just decode exactly why this ad works on a psychological level.

━━━━━━━━━━━━━━━━━━━━━━━━━
AD TRANSCRIPT ({brand_name}):
{transcript}
━━━━━━━━━━━━━━━━━━━━━━━━━

Surface-level data we already have:
- Tone: {tone}
- Hook type: {hook_type}
- Pain points: {pain_points}
- Why it works (surface): {why_it_works}

Go DEEPER. Decode the following:

1. PSYCHOLOGICAL TRIGGER — What primal emotion or social fear does this activate? (e.g. fear of judgment, social comparison, loss aversion, desire for status, relief from shame)

2. STORY STRUCTURE — Break down the exact arc: what's the setup, what's the tension, how does it resolve, where does the brand come in?

3. CHARACTER PSYCHOLOGY — Who are the characters? What do they represent to the Indian viewer? Why does the audience immediately relate to or recognize them?

4. THE HOOK MECHANISM — Why does the first line/scene make someone stop scrolling? What specific curiosity, shock, or emotion does it create in the first 2 seconds?

5. LANGUAGE & DELIVERY PATTERN — What specific words, phrases, or sentence structures make this feel real and not like an ad? What's the rhythm?

6. THE INVISIBLE FORMULA — If you had to write down the repeatable template of this ad in one paragraph (so someone could write 10 more like it), what would that template be?

Be specific. Be ruthless. No fluff. This analysis will be used to write new scripts."""

    return _call_sonnet(prompt, max_tokens=1000)


def generate_multidown_scripts(
    ads: list[dict],  # list of { transcript, hook, analysis, brand_name }
    client_name: str,
    client_brief: str,
) -> list[dict]:
    """
    Multi-ad Double Down:
    Step 1 — Decode psychology of each winning ad individually
    Step 2 — Find the common pattern across all of them
    Step 3 — Write 2 scripts from that combined intelligence
    """
    if not ANTHROPIC_API_KEY:
        return [{"label": "Error", "script": "No Anthropic API key configured."}]

    if len(ads) < 2:
        return [{"label": "Error", "script": "Need at least 2 ads for Multi Double Down."}]

    # Step 1 — Decode each ad's psychology individually
    decoded = []
    for i, ad in enumerate(ads):
        if not ad.get("transcript", "").strip():
            continue
        try:
            psych = _decode_ad_psychology(ad["transcript"], ad.get("analysis", {}), ad.get("brand_name", ""))
            decoded.append({
                "transcript": ad["transcript"],
                "psychology": psych,
                "hook": ad.get("hook", ""),
                "tone": ad.get("analysis", {}).get("tone", ""),
                "hook_type": ad.get("analysis", {}).get("hook_type", ""),
            })
        except Exception as e:
            print(f"[MultiDown] Decode failed for ad {i}: {e}")

    if not decoded:
        return [{"label": "Error", "script": "Could not decode any of the selected ads."}]

    # Step 2 + 3 — Find common pattern and write 2 scripts
    ads_block = ""
    for i, d in enumerate(decoded):
        ads_block += f"""
AD {i+1} (Tone: {d['tone']}, Hook: {d['hook_type']}):
Transcript: {d['transcript']}

Psychology:
{d['psychology']}

{"━"*40}
"""

    prompt = f"""You are India's top performance ad scriptwriter working for {client_name}.

Your team has identified {len(decoded)} ads that all performed well. Your job:
1. Find the COMMON PATTERN across all of them — what psychological formula keeps working
2. Write 2 brand new scripts built from that combined intelligence

━━━━━━━━━━━━━━━━━━━━━━━━━
WINNING ADS + THEIR PSYCHOLOGY:
{ads_block}
━━━━━━━━━━━━━━━━━━━━━━━━━

CLIENT — {client_name.upper()}:
{client_brief or "Use brand details from the transcripts above."}
━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 — FIND THE MASTER PATTERN (think this through before writing):
Look across all {len(decoded)} ads and identify:
- The ONE psychological trigger that appears in all of them
- The character archetypes that keep showing up
- The story structure that repeats
- The language/tone pattern the audience keeps responding to
- The "unfair advantage" — what does this content format do that most ads don't

STEP 2 — WRITE 2 SCRIPTS from that master pattern.

Separate only with: ---SCRIPT---

FORMAT EACH SCRIPT EXACTLY LIKE THIS:

MASTER PATTERN USED:
[1-2 lines on what common formula you extracted and are using]

CHARACTERS:
• [Character Name] — [description]
• [Character Name] — [description]

---

SCENE 1
📍 [Location]
🎬 [Situation setup]

[CHARACTER NAME]: [dialogue]
[CHARACTER NAME]: [dialogue]

---

SCENE 2
📍 [Location]
🎬 [Situation]

[CHARACTER NAME]: [dialogue]
[CHARACTER NAME]: [dialogue]

---

SCENE 3 (if needed)
📍 [Location]
🎬 [Situation]

[CHARACTER NAME]: [dialogue]

---

🎯 CTA SCENE
📍 [Location]
🎬 [Final moment]

[CHARACTER NAME or VOICEOVER]: [CTA for {client_name}]

═══════════════════════════

SCRIPT 1 — Evolution of the pattern
Take the master pattern and push it slightly further. New characters, new situation, but clearly from the same creative DNA as the winning ads.

SCRIPT 2 — Pattern in a new context
Apply the master pattern to a completely different life situation or character type than what's been used before. Same emotional core, fresh territory.

Non-negotiable:
- Same language mix as the original ads (Hindi/Hinglish/English)
- Hook lands in first line of Scene 1
- Real dialogue, not ad speak
- 3-4 scenes max
- CTA for {client_name} at the end
- ONLY the 2 formatted scripts separated by ---SCRIPT---"""

    try:
        raw = _call_sonnet(prompt, max_tokens=5000)
        parts = raw.split("---SCRIPT---")
        labels = [
            "Script 1 — Evolution of the master pattern",
            "Script 2 — Pattern in new territory",
        ]
        scripts = []
        for i, part in enumerate(parts[:2]):
            scripts.append({
                "label": labels[i] if i < len(labels) else f"Script {i+1}",
                "script": part.strip()
            })
        while len(scripts) < 2:
            scripts.append({"label": labels[len(scripts)], "script": "(Not generated — try regenerating)"})
        return scripts
    except Exception as e:
        return [{"label": "Error", "script": f"Error: {e}"}]


def generate_doubledown_scripts(
    transcript: str,
    hook: str,
    analysis: dict,
    brand_name: str,
    client_brief: str,
) -> list[dict]:
    """
    Two-step process:
    1. Psychologically decode the winning ad
    2. Use that decoded framework to write 3 fresh scripts
    """
    if not ANTHROPIC_API_KEY:
        return [{"label": "Error", "script": "No Anthropic API key configured."}]

    if not transcript or len(transcript.strip()) < 5:
        return [{"label": "Error", "script": "This ad has no transcript to double down from."}]

    # Step 1 — Decode psychology
    try:
        psychology = _decode_ad_psychology(transcript, analysis, brand_name)
    except Exception as e:
        psychology = f"(Psychology decode failed: {e})"

    tone = analysis.get("tone", "")
    hook_type = analysis.get("hook_type", "")
    core_offer = analysis.get("core_offer", "")

    # Step 2 — Write 3 scripts using the decoded framework
    prompt = f"""You are India's top performance ad scriptwriter. You write scripts that actually convert — not scripts that sound like ads.

You've decoded why a winning ad works. Now write 3 completely NEW scripts for {brand_name} using that psychological framework. Format each as a proper production-ready script with scenes, characters, and dialogue clearly laid out.

━━━━━━━━━━━━━━━━━━━━━━━━━
ORIGINAL WINNING AD:
{transcript}
━━━━━━━━━━━━━━━━━━━━━━━━━

PSYCHOLOGICAL DECODING:
{psychology}
━━━━━━━━━━━━━━━━━━━━━━━━━

CLIENT — {brand_name.upper()}:
{client_brief or "Use brand details visible in the original transcript."}
━━━━━━━━━━━━━━━━━━━━━━━━━

Write 3 scripts. Separate ONLY with: ---SCRIPT---

FORMAT EACH SCRIPT EXACTLY LIKE THIS — no exceptions:

CHARACTERS:
• [Character Name] — [1 line description, age, who they are]
• [Character Name] — [1 line description]

---

SCENE 1
📍 [Location — e.g. "Living room, evening"]
🎬 [2-3 line situation setup — what's happening before the dialogue starts]

[CHARACTER NAME]: [dialogue]
[CHARACTER NAME]: [dialogue]
[CHARACTER NAME]: [dialogue]

---

SCENE 2
📍 [Location]
🎬 [Situation — what changed, what's happening now]

[CHARACTER NAME]: [dialogue]
[CHARACTER NAME]: [dialogue]

---

SCENE 3 (if needed)
📍 [Location]
🎬 [Situation]

[CHARACTER NAME]: [dialogue]
[CHARACTER NAME]: [dialogue]

---

🎯 CTA SCENE
📍 [Location — usually close-up or screen]
🎬 [Final moment]

[CHARACTER NAME or VOICEOVER]: [CTA line for {brand_name}]

═══════════════════════════

SCRIPT TYPES:

SCRIPT 1 — Same relationship dynamic, completely new scene
Keep the same character archetypes and relationship from the original (e.g. father-son, husband-wife, friends). New situation, new dialogue, same psychological trigger.

SCRIPT 2 — New characters, same psychological trigger
Entirely new characters, new relatable Indian situation. Activate the EXACT same psychological trigger. Different world, same emotional gut punch.

Non-negotiable rules:
- Write in the same language mix as the original (Hindi/Hinglish/English — do NOT switch)
- Hook must land in the first line of Scene 1 — no slow builds
- Dialogue must sound like real people, not an ad
- Each script 3-4 scenes max (same length as original ad)
- NO extra explanation outside the script format
- Just the 3 formatted scripts separated by ---SCRIPT---"""

    try:
        raw = _call_sonnet(prompt, max_tokens=5000)
        parts = raw.split("---SCRIPT---")
        labels = [
            "Variation 1 — Same characters, new scene",
            "Variation 2 — New characters, same trigger",
        ]
        scripts = []
        for i, part in enumerate(parts[:2]):
            scripts.append({
                "label": labels[i] if i < len(labels) else f"Variation {i+1}",
                "script": part.strip()
            })
        while len(scripts) < 2:
            scripts.append({"label": labels[len(scripts)], "script": "(Not generated — try regenerating)"})
        return scripts
    except Exception as e:
        return [{"label": "Error", "script": f"Error generating scripts: {e}"}]


def generate_adapted_script(
    competitor_transcript: str,
    competitor_hook: str,
    competitor_analysis: dict,
    client_name: str,
    client_brief: str,
) -> str:
    """
    Two-step process:
    1. Psychologically decode the competitor ad
    2. Adapt it for the client using the decoded framework
    """
    if not ANTHROPIC_API_KEY:
        return "Error: No Anthropic API key configured."

    if not competitor_transcript or len(competitor_transcript.strip()) < 5:
        return "Error: Competitor ad has no transcript to adapt from."

    # Step 1 — Decode psychology
    try:
        psychology = _decode_ad_psychology(competitor_transcript, competitor_analysis, "competitor")
    except Exception as e:
        psychology = f"(Psychology decode failed: {e})"

    tone = competitor_analysis.get("tone", "")
    hook_type = competitor_analysis.get("hook_type", "")
    pain_points = ", ".join(competitor_analysis.get("pain_points", [])) or "not specified"
    cta_style = competitor_analysis.get("cta", "")

    # Step 2 — Adapt for client
    prompt = f"""You are India's top performance ad scriptwriter working for {client_name}.

A competitor's ad performed well. You've decoded exactly WHY it works psychologically. Now adapt it for {client_name} — not a copy, but a version that uses the same psychological mechanism rebuilt around {client_name}'s brand and audience.

━━━━━━━━━━━━━━━━━━━━━━━━━
COMPETITOR AD:
{competitor_transcript}
━━━━━━━━━━━━━━━━━━━━━━━━━

PSYCHOLOGICAL DECODING:
{psychology}
━━━━━━━━━━━━━━━━━━━━━━━━━

{client_name.upper()} CLIENT BRIEF:
{client_brief or "No brief provided. Use the brand visible in the competitor ad as reference for the category."}
━━━━━━━━━━━━━━━━━━━━━━━━━

Reconstruct this ad from the psychological formula up for {client_name}. Do NOT just swap brand names.

Format the output as a proper production-ready script EXACTLY like this:

CHARACTERS:
• [Character Name] — [1 line description, age, who they are]
• [Character Name] — [1 line description]

---

SCENE 1
📍 [Location]
🎬 [2-3 line situation setup — what's happening before dialogue starts]

[CHARACTER NAME]: [dialogue]
[CHARACTER NAME]: [dialogue]

---

SCENE 2
📍 [Location]
🎬 [What changed, what's happening now]

[CHARACTER NAME]: [dialogue]
[CHARACTER NAME]: [dialogue]

---

SCENE 3 (if needed)
📍 [Location]
🎬 [Situation]

[CHARACTER NAME]: [dialogue]

---

🎯 CTA SCENE
📍 [Location]
🎬 [Final moment]

[CHARACTER NAME or VOICEOVER]: [CTA line for {client_name}]

Rules:
- Same language mix as original (Hindi/Hinglish/English — do NOT switch)
- Hook lands in the first line of Scene 1
- Dialogue sounds like real people, not an ad
- 3-4 scenes max
- Write ONLY the formatted script. No explanation, no title outside the format."""

    try:
        return _call_sonnet(prompt, max_tokens=1500)
    except Exception as e:
        return f"Error generating script: {e}"


def generate_fresh_scripts(
    client_name: str,
    client_brief: str,
    prompt_instruction: str,  # what the user typed
    proven_ads: list,   # top performing client ads { transcript, hook, analysis }
    competitor_ads: list,  # top competitor ads { transcript, hook, analysis, brand_name }
) -> list:
    """
    Write 2 completely fresh scripts from scratch using full client context:
    - Client brief / requirement doc
    - What's already proven to work (their own ads)
    - What competitors are doing that works
    - The user's specific prompt/direction
    """
    if not ANTHROPIC_API_KEY:
        return [{"label": "Error", "script": "No Anthropic API key configured."}]

    # Build proven ads block
    proven_block = ""
    for i, ad in enumerate(proven_ads[:4]):
        t = ad.get("transcript", "").strip()
        hook = ad.get("hook", "")
        tone = ad.get("analysis", {}).get("tone", "")
        score = ad.get("analysis", {}).get("script_quality_score", "")
        if not t:
            continue
        proven_block += f"""
AD {i+1} (Tone: {tone}, Score: {score}/10, Hook: "{hook}"):
{t[:600]}
{"━"*30}
"""

    # Build competitor intel block
    comp_block = ""
    for i, ad in enumerate(competitor_ads[:4]):
        t = ad.get("transcript", "").strip()
        hook = ad.get("hook", "")
        brand = ad.get("brand_name", "competitor")
        days = ad.get("days_running", "")
        if not t:
            continue
        comp_block += f"""
{brand.upper()} (Running {days} days, Hook: "{hook}"):
{t[:500]}
{"━"*30}
"""

    sep = "━" * 25
    proven_section = ("THEIR OWN PROVEN ADS (these already worked — understand the formula):\n" + proven_block + sep) if proven_block else ""
    comp_section = ("COMPETITOR ADS THAT ARE RUNNING LONG (decode why these work):\n" + comp_block + sep) if comp_block else ""
    brief_text = client_brief or "No brief provided — use context from their ads below."

    prompt = (
        "You are India's best performance ad scriptwriter. You write scripts that feel real, convert hard, and people actually watch till the end.\n\n"
        "You have been given EVERYTHING about this client — their requirements, what has already worked for them, and what competitors are doing. Use all of it.\n\n"
        + sep + "\n"
        "CLIENT: " + client_name.upper() + "\n"
        + sep + "\n"
        "CLIENT BRIEF & REQUIREMENTS:\n"
        + brief_text + "\n\n"
        + sep + "\n"
        "WHAT THE TEAM WANTS:\n"
        + prompt_instruction + "\n"
        + sep + "\n\n"
        + (proven_section + "\n\n") if proven_section else ""
        + (comp_section + "\n\n") if comp_section else ""
        + "TASK: Write 2 completely FRESH scripts for " + client_name + ". Not adaptations. Not copies. Brand new ideas informed by everything above.\n\n"
        "Before writing, think:\n"
        "1. What psychological trigger is working in both their own ads AND competitor ads?\n"
        "2. What gap or angle has not been used yet?\n"
        "3. What does the team's prompt tell you about direction?\n\n"
        "Write 2 scripts. Separate ONLY with: ---SCRIPT---\n\n"
        "FORMAT EACH SCRIPT EXACTLY:\n\n"
        "CHARACTERS:\n"
        "• [Name] — [description]\n\n"
        "---\n\n"
        "SCENE 1\n"
        "📍 [Location]\n"
        "🎬 [2-3 line situation setup]\n\n"
        "[CHARACTER NAME]: [dialogue]\n"
        "[CHARACTER NAME]: [dialogue]\n\n"
        "---\n\n"
        "SCENE 2\n"
        "📍 [Location]\n"
        "🎬 [Situation]\n\n"
        "[CHARACTER NAME]: [dialogue]\n"
        "[CHARACTER NAME]: [dialogue]\n\n"
        "---\n\n"
        "SCENE 3 (if needed)\n"
        "📍 [Location]\n"
        "🎬 [Situation]\n\n"
        "[CHARACTER NAME]: [dialogue]\n\n"
        "---\n\n"
        "🎯 CTA SCENE\n"
        "📍 [Location]\n"
        "🎬 [Final moment]\n\n"
        "[CHARACTER NAME or VOICEOVER]: [CTA for " + client_name + "]\n\n"
        "SCRIPT DIRECTIONS:\n"
        "SCRIPT 1 — Follow the direction the team specified. Stay true to the brief.\n"
        "SCRIPT 2 — Take a creative risk. Different angle, unexpected character, surprising scenario — but same psychological trigger.\n\n"
        "Rules:\n"
        "- Language mix exactly as in their proven ads (Hindi/Hinglish/English — match it)\n"
        "- Hook in first line of Scene 1, no slow builds\n"
        "- Real dialogue, not ad speak\n"
        "- 3-4 scenes max\n"
        "- ONLY the 2 scripts separated by ---SCRIPT---. Nothing else."
    )

    try:
        raw = _call_sonnet(prompt, max_tokens=5000)
        parts = raw.split("---SCRIPT---")
        # fallback: try splitting on ## SCRIPT headers if separator wasn't used
        if len(parts) < 2:
            import re
            parts = re.split(r"\n##\s*SCRIPT\s*\d+", raw)
        labels = [
            "Script 1 — On brief",
            "Script 2 — Creative risk",
        ]
        scripts = []
        for i, part in enumerate(parts[:2]):
            scripts.append({
                "label": labels[i] if i < len(labels) else "Script " + str(i+1),
                "script": part.strip()
            })
        while len(scripts) < 2:
            scripts.append({"label": labels[len(scripts)], "script": "(Not generated — try regenerating)"})
        return scripts
    except Exception as e:
        return [{"label": "Error", "script": "Error: " + str(e)}]
