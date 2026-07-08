"""
Meta Ad Library scraper using Playwright + GraphQL network interception.
Intercepts Meta's own GraphQL responses (clean JSON) instead of fragile DOM parsing.
No API token needed.
"""

import asyncio
import json
import re
from datetime import datetime, date
from playwright.async_api import async_playwright


META_AD_LIBRARY_URL = "https://www.facebook.com/ads/library/"


def extract_ad_id(url_or_id: str) -> str:
    """Pull the ad archive ID from a Meta Ad Library URL or a bare ID."""
    s = (url_or_id or "").strip()
    m = re.search(r"[?&]id=(\d+)", s)
    if m:
        return m.group(1)
    m = re.search(r"(\d{8,})", s)  # bare numeric id
    if m:
        return m.group(1)
    return ""


async def scrape_single_ad(url_or_id: str) -> dict:
    """
    Scrape ONE specific ad by its Meta Ad Library link or ID.
    Uses GraphQL interception (same as brand scraper) so we get the EXACT ad
    matching the requested ID — not whatever Meta happens to show first on page.
    Returns a single ad dict, or None.
    """
    ad_id = extract_ad_id(url_or_id)
    if not ad_id:
        print(f"[Scraper] Could not extract ad ID from: {url_or_id}")
        return None

    matched_ad = None  # will hold the GraphQL-parsed ad that matches our ID

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            locale="en-US",
        )
        page = await context.new_page()

        # Intercept GraphQL responses — same technique as brand scraper
        async def on_response(response):
            nonlocal matched_ad
            if matched_ad:
                return  # already found it
            if "api/graphql" not in response.url:
                return
            try:
                body = await response.text()
            except Exception:
                return
            if "ad_archive_id" not in body and "ad_library" not in body:
                return

            # Try parsing as GraphQL search results first
            ads = parse_graphql_ads(body)
            for ad in ads:
                if ad.get("meta_library_id") == ad_id:
                    print(f"[Scraper] ✓ Found exact ad {ad_id} in GraphQL response")
                    matched_ad = ad
                    return

            # Also search raw JSON for the specific ad_archive_id
            # (Meta sometimes embeds it differently for single-ad pages)
            # IMPORTANT: We ONLY accept a match when "ad_archive_id":"<our_id>" appears
            # explicitly as a field — NOT just the number appearing anywhere in the response.
            # This prevents grabbing another ad's video when our ID shows up in a "related ads"
            # array inside a different ad's JSON object.
            ad_field_patterns = [
                f'"ad_archive_id":"{ad_id}"',
                f'"ad_archive_id": "{ad_id}"',
                f'"adArchiveID":"{ad_id}"',
            ]
            chunk_start = -1
            for fp in ad_field_patterns:
                idx = body.find(fp)
                if idx >= 0:
                    chunk_start = idx
                    print(f"[Scraper] raw scan: found ad_archive_id field at index {idx}")
                    break

            if chunk_start >= 0:
                try:
                    # Look FORWARD from the ad_archive_id field for this ad's video URL.
                    # Search up to 5000 chars ahead (enough for one ad object).
                    chunk = body[chunk_start: chunk_start + 10000]

                    def find_chunk(pat, default=""):
                        fm = re.search(pat, chunk)
                        if fm:
                            return fm.group(1)
                        fm2 = re.search(pat, body)
                        return fm2.group(1) if fm2 else default

                    video_url = ""
                    for vp in [r'"video_hd_url":"([^"]+)"', r'"video_sd_url":"([^"]+)"']:
                        raw_v = find_chunk(vp)
                        if raw_v:
                            try:
                                video_url = json.loads('"' + raw_v + '"')
                            except Exception:
                                video_url = raw_v.replace("\\/", "/")
                            break

                    if video_url:
                        print(f"[Scraper] ✓ Found ad {ad_id} via raw JSON scan (ad_archive_id field)")

                        start_ts = find_chunk(r'"start_date":(\d+)')
                        started_on, days_running = None, 0
                        if start_ts:
                            try:
                                sd = datetime.fromtimestamp(int(start_ts)).date()
                                started_on = sd.isoformat()
                                days_running = (date.today() - sd).days
                            except Exception:
                                pass

                        page_name_raw = find_chunk(r'"page_name":"([^"]+)"')
                        page_name = ""
                        try:
                            page_name = json.loads('"' + page_name_raw + '"') if page_name_raw else ""
                        except Exception:
                            page_name = page_name_raw.replace("\\/", "/")

                        body_text_raw = find_chunk(r'"body":\{"text":"([^"]*)"')
                        body_text = ""
                        try:
                            body_text = json.loads('"' + body_text_raw + '"') if body_text_raw else ""
                        except Exception:
                            body_text = body_text_raw

                        advertiser_brand = ""
                        if " with " in page_name:
                            advertiser_brand = page_name.split(" with ", 1)[1].strip()

                        matched_ad = {
                            "meta_library_id": ad_id,
                            "started_running_on": started_on,
                            "days_running": days_running,
                            "performance_tier": tier_for_days(days_running),
                            "platforms": ["facebook"],
                            "video_url": video_url,
                            "thumbnail_url": "",
                            "ad_copy": body_text[:1000],
                            "cta_text": find_chunk(r'"cta_text":"([^"]*)"'),
                            "page_name": page_name,
                            "advertiser_brand": advertiser_brand,
                            "status": "active",
                        }
                        return
                except Exception as e:
                    print(f"[Scraper] raw scan error: {e}")

        page.on("response", on_response)

        url = f"{META_AD_LIBRARY_URL}?id={ad_id}"
        print(f"[Scraper] Opening single ad: {url}")
        try:
            await page.goto(url, wait_until="networkidle", timeout=45000)
        except Exception as e:
            print(f"[Scraper] goto warning: {e}")
        await page.wait_for_timeout(5000)

        # ── DOM fallback: if GraphQL interception found nothing ───────────────
        # Strategy: search the full page HTML for "ad_archive_id":"<our_id>"
        # (same approach as the JSON scanner above). The page HTML contains
        # React-embedded JSON blobs with the ad data. We ONLY accept a video URL
        # that is within the same JSON object as our specific ad_archive_id.
        # We do NOT blindly grab the first <video> or first video_hd_url — that
        # always returns the wrong (cached/background) ad.
        if not matched_ad:
            print(f"[Scraper] GraphQL miss — trying HTML scan for {ad_id}")
            html = await page.content()

            def unesc(s):
                if not s:
                    return s
                try:
                    return json.loads('"' + s + '"')
                except Exception:
                    return s.replace("\\/", "/")

            # Find the specific ad's JSON object in the page HTML
            ad_field_patterns = [
                f'"ad_archive_id":"{ad_id}"',
                f'"ad_archive_id": "{ad_id}"',
                f'"adArchiveID":"{ad_id}"',
                f'ad_archive_id\\u003A{ad_id}',
            ]
            html_chunk_start = -1
            for fp in ad_field_patterns:
                idx = html.find(fp)
                if idx >= 0:
                    html_chunk_start = idx
                    print(f"[Scraper] HTML scan: found ad_archive_id field for {ad_id}")
                    break

            if html_chunk_start >= 0:
                try:
                    chunk = html[html_chunk_start: html_chunk_start + 10000]

                    def find_chunk_html(pat, default=""):
                        # Search in chunk first, then broader HTML
                        fm = re.search(pat, chunk)
                        if fm:
                            return fm.group(1)
                        fm2 = re.search(pat, html)
                        return fm2.group(1) if fm2 else default

                    video_url = ""
                    for vp in [r'"video_hd_url":"([^"]+)"', r'"video_sd_url":"([^"]+)"']:
                        raw_v = find_chunk_html(vp)
                        if raw_v:
                            video_url = unesc(raw_v)
                            break

                    if video_url:
                        start_ts = find_chunk_html(r'"start_date":(\d+)')
                        started_on, days_running = None, 0
                        if start_ts:
                            try:
                                sd = datetime.fromtimestamp(int(start_ts)).date()
                                started_on = sd.isoformat()
                                days_running = (date.today() - sd).days
                            except Exception:
                                pass

                        page_name = unesc(find_chunk_html(r'"page_name":"([^"]+)"'))
                        body_text = unesc(find_chunk_html(r'"body":\{"text":"([^"]*)"'))
                        cta_text = find_chunk_html(r'"cta_text":"([^"]*)"')

                        advertiser_brand = ""
                        if " with " in (page_name or ""):
                            advertiser_brand = page_name.split(" with ", 1)[1].strip()

                        matched_ad = {
                            "meta_library_id": ad_id,
                            "started_running_on": started_on,
                            "days_running": days_running,
                            "performance_tier": tier_for_days(days_running),
                            "platforms": ["facebook"],
                            "video_url": video_url,
                            "thumbnail_url": "",
                            "ad_copy": (body_text or "")[:1000],
                            "cta_text": cta_text,
                            "page_name": page_name or "",
                            "advertiser_brand": advertiser_brand,
                            "status": "active",
                        }
                        print(f"[Scraper] HTML scan succeeded — page_name='{page_name}'")
                except Exception as e:
                    print(f"[Scraper] HTML scan error: {e}")

            if not matched_ad:
                print(f"[Scraper] HTML scan found no ad_archive_id field for {ad_id} in page")

        await browser.close()

    if not matched_ad:
        print(f"[Scraper] Could not find video for ad {ad_id} via any method")
        return None

    print(f"[Scraper] page_name='{matched_ad.get('page_name')}' advertiser_brand='{matched_ad.get('advertiser_brand')}'")
    return matched_ad


def tier_for_days(days: int) -> str:
    if days >= 60:
        return "PROVEN"
    if days >= 30:
        return "TESTING"
    return "NEW"


def parse_graphql_ads(body: str) -> list[dict]:
    """Extract ads from a Meta Ad Library GraphQL response body."""
    ads = []
    try:
        data = json.loads(body)
    except Exception:
        return ads

    try:
        edges = (
            data.get("data", {})
            .get("ad_library_main", {})
            .get("search_results_connection", {})
            .get("edges", [])
        )
    except Exception:
        return ads

    today = date.today()

    for edge in edges:
        node = edge.get("node", {})
        results = node.get("collated_results") or [node]
        for ad in results:
            try:
                snap = ad.get("snapshot") or {}
                videos = snap.get("videos") or []
                video_url = ""
                if videos:
                    video_url = videos[0].get("video_hd_url") or videos[0].get("video_sd_url") or ""

                # Skip ads with no video
                if not video_url:
                    continue

                start_ts = ad.get("start_date")
                started_on = None
                days_running = 0
                if start_ts:
                    start_dt = datetime.fromtimestamp(start_ts).date()
                    started_on = start_dt.isoformat()
                    days_running = (today - start_dt).days

                body_text = ""
                b = snap.get("body")
                if isinstance(b, dict):
                    body_text = b.get("text") or ""

                platforms = [p.lower() for p in (ad.get("publisher_platform") or [])]
                if not platforms:
                    platforms = ["facebook"]

                thumb = ""
                imgs = snap.get("images") or []
                if imgs:
                    thumb = imgs[0].get("resized_image_url") or imgs[0].get("original_image_url") or ""
                if not thumb and videos:
                    thumb = videos[0].get("video_preview_image_url") or ""

                ads.append({
                    "meta_library_id": str(ad.get("ad_archive_id") or ad.get("ad_id") or ""),
                    "started_running_on": started_on,
                    "days_running": days_running,
                    "performance_tier": tier_for_days(days_running),
                    "platforms": platforms,
                    "video_url": video_url,
                    "thumbnail_url": thumb,
                    "ad_copy": (body_text or (snap.get("caption") or ""))[:1000],
                    "cta_text": snap.get("cta_text") or "",
                    "page_name": snap.get("page_name") or node.get("page_name") or "",
                    "status": "active" if ad.get("is_active") else "inactive",
                })
            except Exception as e:
                print(f"[Scraper] parse error on one ad: {e}")
                continue

    return ads


async def scrape_ads_for_brand(brand_name: str, max_ads: int = 15) -> list[dict]:
    """
    Scrape video ads from Meta Ad Library.
    brand_name can be a full Meta Ad Library URL (pasted from browser) or a plain brand name.
    If a URL is pasted, we use it directly so the user gets exactly what they see.
    """
    collected: list[dict] = []
    seen_ids = set()

    # Detect if input is a URL or a plain brand name
    if brand_name.startswith("http"):
        url = brand_name.strip()
        # Force media_type=video and active_status=active if not already set
        if "media_type=video" not in url and "media_type=all" not in url:
            url += "&media_type=video"
        display_name = url  # for logging
        print(f"[Scraper] Using pasted URL directly")
    else:
        params = {
            "active_status": "active",
            "ad_type": "all",
            "country": "IN",
            "q": brand_name,
            "media_type": "video",
        }
        query = "&".join(f"{k}={v}" for k, v in params.items())
        url = f"{META_AD_LIBRARY_URL}?{query}"
        display_name = brand_name

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            locale="en-US",
        )
        page = await context.new_page()

        async def on_response(response):
            if "api/graphql" not in response.url:
                return
            try:
                body = await response.text()
            except Exception:
                return
            if "ad_library_main" not in body:
                return
            for ad in parse_graphql_ads(body):
                if ad["meta_library_id"] and ad["meta_library_id"] not in seen_ids:
                    seen_ids.add(ad["meta_library_id"])
                    collected.append(ad)

        page.on("response", on_response)

        print(f"[Scraper] Opening Meta Ad Library for: {display_name}")
        try:
            await page.goto(url, wait_until="networkidle", timeout=45000)
        except Exception as e:
            print(f"[Scraper] goto warning: {e}")
        await page.wait_for_timeout(4000)

        # Scroll to trigger more GraphQL fetches.
        # Scale scroll attempts with how many ads we want (more ads = scroll deeper).
        max_scrolls = max(8, max_ads // 2 + 6)
        stagnant = 0
        last_count = 0
        for _ in range(max_scrolls):
            try:
                await page.evaluate("window.scrollBy(0, window.innerHeight * 2)")
            except Exception:
                # Page navigated mid-scroll (Meta redirect/refresh) — wait and continue
                await page.wait_for_timeout(2000)
                continue
            await page.wait_for_timeout(2500)
            if len(collected) >= max_ads:
                break
            # Stop early if scrolling stops yielding new ads (reached the end)
            if len(collected) == last_count:
                stagnant += 1
                if stagnant >= 3:
                    print(f"[Scraper] No new ads after {stagnant} scrolls — reached end")
                    break
            else:
                stagnant = 0
            last_count = len(collected)

        await browser.close()

    print(f"[Scraper] Collected {len(collected)} video ads for {brand_name}")
    # Keep Meta's original order (respects impression sorting from pasted URL)
    return collected[:max_ads]
