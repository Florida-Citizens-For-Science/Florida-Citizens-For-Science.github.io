#!/usr/bin/env python3
"""Create a private, dated snapshot of the FDOE science standards review page.

Only the five active science-review PDFs are downloaded. Microsoft Forms are
captured in a fresh, anonymous Playwright browser context. Form capture is
read-only: this script may click a button whose accessible name is exactly
"Next"; it never selects/fills an answer and never clicks Submit.

The tool writes only below --corpus-root. Do not point that root at a public
website/repository unless publication rights for every captured item have
been reviewed. The default root is the existing private research corpus under
~/Documents.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any


PORTAL_URL = "https://www.fldoe.org/standardsreview/"
CDN_PORTAL_URL = "https://cdn.fldoe.org/standardsreview/"
EXPECTED_UNIQUE_FORMS = 26
USER_AGENT = "FCS-StandardsReview-Mirror/1.0 (source preservation; contact: welsberr@flcfs.org)"
MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024
SENSITIVE_KEY_RE = re.compile(
    r"(?:anti.?forgery|csrf|xsrf|session|cookie|authorization|bearer|access.?token|"
    r"refresh.?token|verification.?token|request.?verification|nonce|viewstate|eventvalidation)",
    re.I,
)
TOKEN_VALUE_RE = re.compile(r"(?i)\b(?:bearer\s+)[A-Za-z0-9._~+/=-]{12,}")
LONG_OPAQUE_RE = re.compile(r"\b[A-Za-z0-9_-]{80,}\b")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_utc(value: datetime | None = None) -> str:
    return (value or utc_now()).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def normalized_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = "\n".join(line.rstrip() for line in text.split("\n"))
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip() + ("\n" if text.strip() else "")


def safe_url(url: str) -> str:
    """Keep the public path; retain only a public Forms form ID when needed."""
    try:
        parsed = urllib.parse.urlsplit(url)
        query = ""
        if is_forms_url(url) and "responsepage" in parsed.path.lower():
            public_id = urllib.parse.parse_qs(parsed.query).get("id", [""])[0]
            if public_id and not SENSITIVE_KEY_RE.search("id"):
                query = urllib.parse.urlencode({"id": public_id})
        return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path, query, ""))
    except Exception:
        return ""


def scrub_visible_text(value: str) -> str:
    """Remove conspicuous credential/token material from captured visible text."""
    kept: list[str] = []
    for line in value.splitlines():
        if SENSITIVE_KEY_RE.search(line) and re.search(r"[:=]", line):
            kept.append("[redacted sensitive field]")
            continue
        line = TOKEN_VALUE_RE.sub("[redacted token]", line)
        line = LONG_OPAQUE_RE.sub("[redacted opaque value]", line)
        kept.append(line)
    return normalized_text("\n".join(kept))


def scrub_portal_html(raw: bytes) -> bytes:
    """Keep static portal markup while removing scripts and token-bearing fields."""
    decoded = raw.decode("utf-8", errors="replace")
    # External scripts are inventoried by URL, but not retained as raw source:
    # dynamic scripts are the likeliest place for transient/session material.
    decoded = re.sub(r"<script\b[^>]*>.*?</script\s*>", "", decoded, flags=re.I | re.S)
    # Do not archive form markup: hidden fields and embedded form state can carry
    # anti-forgery, session, or response tokens even when their names are unusual.
    decoded = re.sub(r"<form\b[^>]*>.*?</form\s*>", "", decoded, flags=re.I | re.S)
    decoded = re.sub(r"<!--[\s\S]*?-->", "", decoded)
    decoded = re.sub(
        r"<meta\b[^>]*(?:csrf|xsrf|anti.?forgery|session|token)[^>]*>",
        "",
        decoded,
        flags=re.I | re.S,
    )
    input_re = re.compile(r"<input\b[^>]*>", re.I | re.S)

    def redact_input(match: re.Match[str]) -> str:
        tag = match.group(0)
        name_match = re.search(r"\bname\s*=\s*([\"'])(.*?)\1", tag, re.I | re.S)
        id_match = re.search(r"\bid\s*=\s*([\"'])(.*?)\1", tag, re.I | re.S)
        marker = f"{name_match.group(2) if name_match else ''} {id_match.group(2) if id_match else ''}"
        if SENSITIVE_KEY_RE.search(marker):
            return ""
        # Inputs are not needed for portal navigation or link inventory and may
        # carry opaque values that are not recognizable from their field name.
        return ""

    decoded = input_re.sub(redact_input, decoded)
    return decoded.encode("utf-8")


def fetch_url(url: str, timeout: int) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/pdf,*/*;q=0.7"},
    )
    result: dict[str, Any] = {
        "requested_url": safe_url(url),
        "final_url": "",
        "http_status": None,
        "content_type": "",
        "headers": {},
        "body": b"",
        "error": None,
    }
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read(MAX_DOWNLOAD_BYTES + 1)
            if len(body) > MAX_DOWNLOAD_BYTES:
                raise ValueError(f"response exceeds {MAX_DOWNLOAD_BYTES} byte safety limit")
            result.update(
                final_url=safe_url(response.geturl()),
                http_status=getattr(response, "status", 200),
                content_type=response.headers.get("Content-Type", ""),
                headers={
                    key: response.headers.get(key)
                    for key in ("ETag", "Last-Modified", "Content-Length", "Date")
                    if response.headers.get(key) is not None
                },
                body=body,
            )
    except urllib.error.HTTPError as exc:
        result.update(
            final_url=safe_url(exc.geturl()),
            http_status=exc.code,
            content_type=exc.headers.get("Content-Type", "") if exc.headers else "",
            error=f"HTTP {exc.code}: {exc.reason}",
        )
    except Exception as exc:  # network/TLS/size errors are recorded, not guessed around
        result["error"] = f"{type(exc).__name__}: {exc}"
    return result


class PortalLinkParser(HTMLParser):
    """Small stdlib parser that preserves visible anchor labels and hrefs."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[dict[str, str]] = []
        self._active: dict[str, str] | None = None
        self._parts: list[str] = []
        self._skip_depth = 0
        self._heading_depth = 0
        self._heading_parts: list[str] = []
        self._heading_stack: list[dict[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = dict(attrs)
        if tag.lower() in {"script", "style", "noscript"}:
            self._skip_depth += 1
        if re.fullmatch(r"h[1-6]", tag.lower()):
            self._heading_depth = int(tag[1])
            self._heading_parts = []
        if tag.lower() == "a":
            href = attr.get("href") or ""
            if href:
                self._active = {
                    "href": href,
                    "text": "",
                    "section_context": json.dumps(self._heading_stack, ensure_ascii=False),
                }
                self._parts = []

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "a" and self._active is not None:
            self._active["text"] = normalized_text(" ".join(self._parts)).strip()
            self.links.append(self._active)
            self._active = None
            self._parts = []
        if re.fullmatch(r"h[1-6]", tag.lower()) and self._heading_depth:
            text = normalized_text(" ".join(self._heading_parts)).strip()
            level = self._heading_depth
            self._heading_stack = [item for item in self._heading_stack if int(item["level"][1]) < level]
            if text:
                self._heading_stack.append({"level": f"h{level}", "text": text[:500]})
            self._heading_depth = 0
            self._heading_parts = []
        if tag.lower() in {"script", "style", "noscript"} and self._skip_depth:
            self._skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._heading_depth and not self._skip_depth:
            self._heading_parts.append(data)
        if self._active is not None and not self._skip_depth:
            self._parts.append(data)


def section_classification(headings: list[dict[str, str]]) -> str:
    heading_text = " ".join(item.get("text", "") for item in headings).lower()
    if re.search(r"\bstandards\s+under\s+review\b", heading_text):
        return "standards_under_review"
    if re.search(r"\bfurther\s+materials?\b", heading_text):
        return "further_materials"
    return "other_or_unlabeled"


def extract_page_text(raw: bytes) -> str:
    """Extract text from the portal page without requiring BeautifulSoup."""
    class TextParser(HTMLParser):
        def __init__(self) -> None:
            super().__init__(convert_charrefs=True)
            self.parts: list[str] = []
            self.skip = 0

        def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
            if tag.lower() in {"script", "style", "noscript", "svg"}:
                self.skip += 1
            elif tag.lower() in {"br", "p", "div", "li", "h1", "h2", "h3", "h4", "tr"}:
                self.parts.append("\n")

        def handle_endtag(self, tag: str) -> None:
            if tag.lower() in {"script", "style", "noscript", "svg"} and self.skip:
                self.skip -= 1
            elif tag.lower() in {"p", "div", "li", "h1", "h2", "h3", "h4", "tr"}:
                self.parts.append("\n")

        def handle_data(self, data: str) -> None:
            if not self.skip:
                self.parts.append(data)

    parser = TextParser()
    parser.feed(raw.decode("utf-8", errors="replace"))
    return scrub_visible_text(html.unescape("".join(parser.parts)))


def absolute_url(base: str, href: str) -> str:
    return urllib.parse.urljoin(base, html.unescape(href.strip()))


def form_identity(url: str) -> tuple[str, str]:
    """Return stable identity and public start URL; never retain arbitrary query data."""
    parsed = urllib.parse.urlsplit(url)
    path_parts = [part for part in parsed.path.split("/") if part]
    share_code = ""
    for index, part in enumerate(path_parts[:-1]):
        if part.lower() == "r":
            share_code = path_parts[index + 1]
            break
    query = urllib.parse.parse_qs(parsed.query)
    public_id = (query.get("id") or [""])[0]
    identifier = share_code or public_id
    if identifier:
        key = hashlib.sha256(identifier.encode("utf-8")).hexdigest()[:16]
        # For responsepage URLs retain only the public form ID; strip route and all
        # other parameters that could carry tracking or session state.
        if public_id and "responsepage" in parsed.path.lower():
            start_url = urllib.parse.urlunsplit(
                (parsed.scheme, parsed.netloc, parsed.path, urllib.parse.urlencode({"id": public_id}), "")
            )
        else:
            start_url = safe_url(url)
        return f"form-{key}", start_url
    return f"form-{hashlib.sha256(safe_url(url).encode()).hexdigest()[:16]}", safe_url(url)


def is_forms_url(url: str) -> bool:
    host = (urllib.parse.urlsplit(url).hostname or "").lower()
    return host in {"forms.cloud.microsoft", "forms.office.com", "forms.microsoft.com"} or host.endswith(".forms.office.com")


def classify_link(label: str, url: str) -> str:
    label_l = re.sub(r"\s+", " ", label).strip().lower()
    path_l = urllib.parse.urlsplit(url).path.lower()
    haystack = f"{label_l} {path_l}"
    if is_forms_url(url):
        return "comment_form"
    if not path_l.endswith(".pdf"):
        return "portal_or_other_link"
    if "foreword" in haystack:
        return "supporting_foreword"
    if "table" in haystack or "modeling skills" in haystack or "laboratory practices" in haystack:
        return "supporting_tables"
    if re.search(r"(?:^|[/\s_-])k[-_]?5(?:[/\s_.-]|$)", haystack):
        return "draft_k5"
    if re.search(r"(?:^|[/\s_-])6[-_]?8(?:[/\s_.-]|$)", haystack):
        return "draft_68"
    if re.search(r"(?:^|[/\s_-])9[-_]?12(?:[/\s_.-]|$)", haystack):
        return "draft_912"
    return "other_pdf"


ACTIVE_DOCS = ("draft_k5", "draft_68", "draft_912", "supporting_foreword", "supporting_tables")
DOC_FILENAMES = {
    "draft_k5": "k-5.pdf",
    "draft_68": "6-8.pdf",
    "draft_912": "9-12.pdf",
    "supporting_foreword": "foreword.pdf",
    "supporting_tables": "tables.pdf",
}


def parse_page_links(raw_html: bytes, page_url: str) -> tuple[list[dict[str, Any]], str]:
    parser = PortalLinkParser()
    parser.feed(raw_html.decode("utf-8", errors="replace"))
    inventory: list[dict[str, Any]] = []
    seen_forms: set[str] = set()
    for raw_link in parser.links:
        url = absolute_url(page_url, raw_link["href"])
        if not urllib.parse.urlsplit(url).scheme.startswith("http"):
            continue
        category = classify_link(raw_link["text"], url)
        try:
            section_context = json.loads(raw_link.get("section_context", "[]"))
        except (TypeError, json.JSONDecodeError):
            section_context = []
        prior_heading_context = None
        anchor_heading = None
        if category == "supporting_tables" and not any(
            "table" in item.get("text", "").lower() for item in section_context
        ):
            # The current portal renders the K-12 Tables document title as the
            # anchor itself, immediately after the Foreword block, without a
            # surrounding heading element. Preserve that anchor as its own
            # heading instead of carrying the stale Foreword h3 forward.
            prior_heading_context = section_context
            if section_context and section_context[-1].get("text", "").strip().lower() == "foreword":
                section_context = section_context[:-1]
            anchor_heading = {"level": "anchor", "text": raw_link["text"][:500]}
            section_context = [*section_context, anchor_heading]
        portal_section = section_classification(section_context)
        entry: dict[str, Any] = {
            "label": raw_link["text"][:500],
            "url": safe_url(url),
            "category": category,
            "section_context": section_context,
            "portal_section": portal_section,
            "source_role": (
                "core_standard"
                if category.startswith("draft_")
                else "adjunct_or_supporting"
                if category.startswith("supporting_") or portal_section == "further_materials"
                else "review_form"
                if category == "comment_form"
                else "unclassified"
            ),
            "fetch_status": "not_fetched_inventory_only",
        }
        if anchor_heading:
            entry["anchor_heading"] = anchor_heading
            entry["prior_heading_context"] = prior_heading_context
        if category == "comment_form":
            key, start_url = form_identity(url)
            entry["form_key"] = key
            entry["url"] = start_url
            entry["duplicate_form_link"] = key in seen_forms
            seen_forms.add(key)
        inventory.append(entry)
    portal_text = extract_page_text(raw_html)
    return inventory, portal_text


def pdf_page_count(path: Path) -> int | None:
    pdfinfo = shutil.which("pdfinfo")
    if not pdfinfo:
        return None
    try:
        result = subprocess.run([pdfinfo, str(path)], capture_output=True, text=True, timeout=30, check=False)
        if result.returncode:
            return None
        match = re.search(r"^Pages:\s+(\d+)\s*$", result.stdout, re.M)
        return int(match.group(1)) if match else None
    except Exception:
        return None


def pdf_to_text(pdf_path: Path, text_path: Path) -> tuple[str | None, str | None]:
    pdftotext = shutil.which("pdftotext")
    if not pdftotext:
        return None, "pdftotext not installed; source PDF preserved without text extraction"
    try:
        result = subprocess.run(
            [pdftotext, "-layout", str(pdf_path), str(text_path)],
            capture_output=True,
            text=True,
            timeout=180,
            check=False,
        )
        if result.returncode or not text_path.is_file():
            return None, (result.stderr.strip() or f"pdftotext exit {result.returncode}")[:1000]
        content = text_path.read_text(encoding="utf-8", errors="replace")
        return normalized_text(content), None
    except Exception as exc:
        return None, f"{type(exc).__name__}: {exc}"


def select_active_docs(inventory: list[dict[str, Any]]) -> tuple[dict[str, dict[str, Any]], list[str]]:
    selected: dict[str, dict[str, Any]] = {}
    issues: list[str] = []
    for entry in inventory:
        category = entry["category"]
        if category not in ACTIVE_DOCS:
            continue
        if category in selected:
            # Prefer an FDOE/CDN URL and the more informative label if duplicates exist.
            current = selected[category]
            url = entry["url"]
            score = int("fldoe.org" in urllib.parse.urlsplit(url).netloc) + int("K-12" in entry["label"])
            current_score = int("fldoe.org" in urllib.parse.urlsplit(current["url"]).netloc) + int("K-12" in current["label"])
            if score > current_score:
                selected[category] = entry
        else:
            selected[category] = entry
    for category in ACTIVE_DOCS:
        if category not in selected:
            issues.append(f"active source link not found in portal HTML: {category}")
    return selected, issues


def capture_form_with_playwright(
    key: str,
    start_url: str,
    timeout_ms: int,
    max_pages: int,
) -> dict[str, Any]:
    """Capture visible text/structure; the only permitted interaction is exact Next."""
    try:
        from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
        from playwright.sync_api import sync_playwright
    except Exception as exc:
        return {
            "source_key": key,
            "start_url": safe_url(start_url),
            "final_url": "",
            "status": "incomplete_playwright_unavailable",
            "error": f"{type(exc).__name__}: {exc}",
            "rights_status": "not_assessed_private_capture_only",
            "pages": [],
        }

    pages: list[dict[str, Any]] = []
    status = "incomplete_unknown"
    notes: list[str] = []
    final_url = ""
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                accept_downloads=False,
                service_workers="block",
                java_script_enabled=True,
            )
            page = context.new_page()
            page.set_default_navigation_timeout(timeout_ms)
            page.set_default_timeout(timeout_ms)
            response = None
            try:
                response = page.goto(start_url, wait_until="domcontentloaded", timeout=timeout_ms)
                page.wait_for_timeout(2500)
            except PlaywrightTimeoutError as exc:
                notes.append(f"initial navigation timed out: {exc}")
            final_url = safe_url(page.url)
            if response is not None and getattr(response, "status", None) is not None:
                initial_http_status = response.status
                initial_content_type = response.headers.get("content-type", "")
            else:
                initial_http_status = None
                initial_content_type = ""

            if not page.url.startswith("https://"):
                status = "incomplete_non_https_redirect"
                notes.append("form did not remain on HTTPS")
            else:
                for page_number in range(1, max_pages + 1):
                    snapshot = page.evaluate(
                        """() => {
                          const visible = el => {
                            const s = getComputedStyle(el), r = el.getBoundingClientRect();
                            return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
                          };
                          const clean = s => (s || '').replace(/\\u00a0/g, ' ').replace(/[ \\t]+/g, ' ').trim();
                          const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role=heading]')]
                            .filter(visible).map(e => ({level:e.tagName.toLowerCase(), text:clean(e.innerText)})).filter(x => x.text);
                          const buttons = [...document.querySelectorAll('button,[role=button]')]
                            .filter(visible).map(e => clean(e.getAttribute('aria-label') || e.innerText || e.title)).filter(Boolean);
                          const questionRoots = [...document.querySelectorAll('[data-automation-id*=question i],[role=group],[role=radiogroup]')]
                            .filter(visible).slice(0,150);
                          const questions = [];
                          const seen = new Set();
                          for (const root of questionRoots) {
                            const text = clean(root.innerText);
                            if (!text || seen.has(text)) continue;
                            seen.add(text);
                            questions.push({
                              automation_id: clean(root.getAttribute('data-automation-id')),
                              role: clean(root.getAttribute('role')),
                              text,
                              radio_count: root.querySelectorAll('input[type=radio],[role=radio]').length,
                              checkbox_count: root.querySelectorAll('input[type=checkbox],[role=checkbox]').length,
                              required: root.getAttribute('aria-required') === 'true' || !!root.querySelector('[aria-required=true],[required]')
                            });
                          }
                          const controls = {};
                          for (const type of ['radio','checkbox','text','email','number','date']) {
                            controls[type] = [...document.querySelectorAll(`input[type=${type}]`)].filter(visible).length;
                          }
                          return {
                            title: clean(document.title),
                            text: document.body ? document.body.innerText : '',
                            headings, buttons, questions, controls,
                            document_language: document.documentElement?.lang || ''
                          };
                        }"""
                    )
                    text = scrub_visible_text(snapshot.get("text", ""))
                    text_hash = sha256_bytes(text.encode("utf-8"))
                    page_record = {
                        "page_number": page_number,
                        "final_url": safe_url(page.url),
                        "title": scrub_visible_text(snapshot.get("title", ""))[:500],
                        "visible_text": text,
                        "normalized_text_sha256": text_hash,
                        "visible_text_bytes": len(text.encode("utf-8")),
                        "structure": {
                            "document_language": re.sub(r"[^A-Za-z0-9-]", "", snapshot.get("document_language", ""))[:32],
                            "headings": [
                                {"level": item["level"][:16], "text": scrub_visible_text(item["text"])[:1000]}
                                for item in snapshot.get("headings", [])
                            ],
                            "buttons": [scrub_visible_text(x)[:300] for x in snapshot.get("buttons", [])],
                            "questions": [
                                {
                                    "automation_id": (
                                        ""
                                        if SENSITIVE_KEY_RE.search(item.get("automation_id", ""))
                                        else re.sub(r"[^A-Za-z0-9_.-]", "", item.get("automation_id", ""))[:100]
                                    ),
                                    "role": re.sub(r"[^A-Za-z0-9_-]", "", item.get("role", ""))[:40],
                                    "text": scrub_visible_text(item.get("text", ""))[:5000],
                                    "radio_count": int(item.get("radio_count", 0)),
                                    "checkbox_count": int(item.get("checkbox_count", 0)),
                                    "required": bool(item.get("required", False)),
                                }
                                for item in snapshot.get("questions", [])
                            ],
                            "visible_control_counts": {
                                str(k): int(v) for k, v in snapshot.get("controls", {}).items()
                            },
                        },
                    }
                    pages.append(page_record)

                    # Find only a button whose complete accessible name/text is Next.
                    # Never locate/click answer controls, Start, Back, or Submit.
                    next_button = None
                    for button in page.get_by_role("button").all():
                        try:
                            if not button.is_visible():
                                continue
                            name = button.get_attribute("aria-label") or button.inner_text(timeout=1000)
                            if re.fullmatch(r"\s*next\s*", name or "", flags=re.I):
                                next_button = button
                                break
                        except Exception:
                            continue
                    if next_button is None:
                        visible_submit = any(
                            re.fullmatch(r"\s*submit\s*", label, flags=re.I)
                            for label in snapshot.get("buttons", [])
                        )
                        if visible_submit:
                            status = "complete_pages_submit_not_pressed"
                            notes.append("final page reached; Submit was intentionally not pressed")
                        elif page_number == 1 and pages[-1]["visible_text"].strip().lower() in {"", "loading", "loading...", "loading…"}:
                            status = "incomplete_no_visible_content"
                            notes.append("no visible form content was captured; page was empty or still loading")
                        else:
                            status = "complete_pages_no_next_button"
                            notes.append("no exact Next button was visible; no other control was activated")
                        break

                    before_hash = text_hash
                    try:
                        next_button.click(timeout=timeout_ms)
                    except PlaywrightTimeoutError as exc:
                        status = "incomplete_next_click_timeout"
                        notes.append(f"exact Next click timed out: {exc}")
                        break
                    changed = False
                    deadline = time.monotonic() + min(timeout_ms / 1000, 8)
                    while time.monotonic() < deadline:
                        page.wait_for_timeout(250)
                        try:
                            current_text = scrub_visible_text(page.locator("body").inner_text(timeout=1000))
                        except Exception:
                            current_text = ""
                        if sha256_bytes(current_text.encode("utf-8")) != before_hash:
                            changed = True
                            break
                    if not changed:
                        after_text = scrub_visible_text(page.locator("body").inner_text(timeout=2000))
                        if re.search(r"required|must answer|please answer|need to answer", after_text, re.I):
                            status = "incomplete_required_field_blocked"
                            notes.append("Next did not advance; visible validation indicates an unanswered required field. No response was selected.")
                        else:
                            status = "incomplete_next_did_not_advance"
                            notes.append("Next did not change visible content. Capture stopped without trying another control or entering an answer.")
                        break
                    final_url = safe_url(page.url)
                else:
                    status = "incomplete_page_limit"
                    notes.append(f"stopped at configured page safety limit ({max_pages})")

            context.close()
            browser.close()
            return {
                "source_key": key,
                "start_url": safe_url(start_url),
                "final_url": final_url,
                "http_status": initial_http_status,
                "content_type": initial_content_type,
                "status": status,
                "checked_at_utc": iso_utc(),
                "pages": pages,
                "notes": notes,
                "rights_status": "not_assessed_private_capture_only",
                "interaction_policy": "clicked exact-name Next only; no answer controls changed; Submit never pressed",
                "normalized_text_sha256": sha256_bytes(
                    "\n\n".join(item["visible_text"] for item in pages).encode("utf-8")
                ),
            }
    except Exception as exc:
        return {
            "source_key": key,
            "start_url": safe_url(start_url),
            "final_url": final_url,
            "status": "incomplete_capture_error",
            "error": f"{type(exc).__name__}: {exc}",
            "pages": pages,
            "notes": notes,
            "rights_status": "not_assessed_private_capture_only",
            "interaction_policy": "clicked exact-name Next only; no answer controls changed; Submit never pressed",
        }


def latest_prior_snapshot(snapshots_dir: Path) -> tuple[Path | None, dict[str, Any] | None]:
    candidates = sorted(
        (p for p in snapshots_dir.iterdir() if p.is_dir() and (p / "manifest.json").is_file()),
        key=lambda p: p.name,
    ) if snapshots_dir.exists() else []
    for path in reversed(candidates):
        try:
            return path, json.loads((path / "manifest.json").read_text(encoding="utf-8"))
        except Exception:
            continue
    return None, None


def record_by_key(manifest: dict[str, Any]) -> dict[str, dict[str, Any]]:
    records: dict[str, dict[str, Any]] = {}
    for record in manifest.get("sources", []):
        key = record.get("source_key")
        if key:
            records[key] = record
    return records


def compare_sources(current: dict[str, Any], prior: dict[str, Any] | None) -> list[dict[str, Any]]:
    old = record_by_key(prior or {})
    changes: list[dict[str, Any]] = []
    for record in current.get("sources", []):
        key = record.get("source_key")
        before = old.get(key)
        if before is None:
            state = "new"
        elif record.get("sha256") and record.get("sha256") == before.get("sha256"):
            state = "unchanged"
        elif record.get("normalized_text_sha256") and record.get("normalized_text_sha256") == before.get("normalized_text_sha256"):
            state = "bytes_changed_text_same"
        elif record.get("sha256") or record.get("normalized_text_sha256"):
            state = "changed"
        else:
            state = "not_comparable"
        record["change_state"] = state
        changes.append({
            "source_key": key,
            "title": record.get("title", ""),
            "category": record.get("category", ""),
            "state": state,
            "previous_sha256": before.get("sha256") if before else None,
            "current_sha256": record.get("sha256"),
            "previous_text_sha256": before.get("normalized_text_sha256") if before else None,
            "current_text_sha256": record.get("normalized_text_sha256"),
            "status": record.get("status"),
        })
    current_keys = {item.get("source_key") for item in current.get("sources", [])}
    for key, before in old.items():
        if key not in current_keys:
            changes.append({
                "source_key": key,
                "title": before.get("title", ""),
                "category": before.get("category", ""),
                "state": "missing_from_current_portal_or_capture",
                "previous_sha256": before.get("sha256"),
                "current_sha256": None,
                "status": None,
            })
    return changes


def write_change_report(path: Path, snapshot_id: str, prior_id: str | None, changes: list[dict[str, Any]], issues: list[str]) -> None:
    counts: dict[str, int] = {}
    for item in changes:
        counts[item["state"]] = counts.get(item["state"], 0) + 1
    lines = [
        "# FDOE Standards Review snapshot comparison",
        "",
        f"- Snapshot: `{snapshot_id}`",
        f"- Compared with: `{prior_id or 'no prior snapshot (baseline)'}`",
        f"- Checked: `{iso_utc()}`",
        "",
        "## Summary",
        "",
    ]
    if not changes:
        lines.append("No source records were available for comparison.")
    else:
        lines.append("; ".join(f"{state}: {count}" for state, count in sorted(counts.items())))
    if issues:
        lines.extend(["", "## Incomplete items", ""])
        lines.extend(f"- {issue}" for issue in issues)
    lines.extend(["", "## Source changes", "", "| Source | Category | State | Status |", "|---|---|---|---|"])
    for item in changes:
        title = re.sub(r"[|\r\n]", " ", str(item.get("title") or item["source_key"]))
        lines.append(f"| {title} (`{item['source_key']}`) | {item.get('category','')} | {item['state']} | {item.get('status') or ''} |")
    lines.extend([
        "",
        "A change state is a preservation alert, not an interpretation of standards meaning. Review source bytes/text before revising analysis.",
    ])
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def unique_snapshot_dir(snapshots_dir: Path, stamp: str) -> Path:
    base = stamp.replace(":", "").replace("-", "")
    candidate = snapshots_dir / base
    suffix = 1
    while candidate.exists():
        candidate = snapshots_dir / f"{base}-{suffix:02d}"
        suffix += 1
    return candidate


def main() -> int:
    default_root = Path.home() / "Documents" / "Florida-Science-Standards-Provenance-2026-10-21"
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--corpus-root", type=Path, default=default_root, help="private corpus root (default: %(default)s)")
    parser.add_argument("--portal-url", default=PORTAL_URL, help="FDOE Standards Review page URL")
    parser.add_argument("--no-forms", action="store_true", help="inventory Forms links but do not open/capture them")
    parser.add_argument("--timeout", type=int, default=30, help="HTTP and form navigation timeout in seconds")
    parser.add_argument("--max-form-pages", type=int, default=300, help="safety cap for pages captured per Form")
    args = parser.parse_args()

    corpus_root = args.corpus_root.expanduser().resolve()
    snapshots_dir = corpus_root / "sources" / "2026-process" / "fldoe-standardsreview" / "snapshots"
    snapshots_dir.mkdir(parents=True, exist_ok=True)
    prior_dir, prior_manifest = latest_prior_snapshot(snapshots_dir)

    fetched_at = utc_now()
    snapshot_stamp = fetched_at.strftime("%Y%m%dT%H%M%SZ")
    snapshot_dir = unique_snapshot_dir(snapshots_dir, snapshot_stamp)
    docs_dir = snapshot_dir / "documents"
    forms_dir = snapshot_dir / "forms"
    headers_dir = snapshot_dir / "response-headers"
    docs_dir.mkdir(parents=True)
    headers_dir.mkdir()

    issues: list[str] = []
    portal_result = fetch_url(args.portal_url, args.timeout)
    if not (portal_result.get("http_status") == 200 and portal_result.get("body")):
        primary_error = portal_result.get("error") or f"HTTP {portal_result.get('http_status')}"
        cdn_result = fetch_url(CDN_PORTAL_URL, args.timeout)
        if cdn_result.get("http_status") == 200 and cdn_result.get("body"):
            portal_result = cdn_result
            portal_result["fallback_used"] = True
            portal_result["primary_error"] = primary_error
        else:
            issues.append(f"portal fetch failed at primary and CDN fallback: {primary_error}; fallback: {cdn_result.get('error') or cdn_result.get('http_status')}")
            portal_result["fallback_error"] = cdn_result.get("error") or cdn_result.get("http_status")

    portal_html_path = snapshot_dir / "portal.html"
    portal_text_path = snapshot_dir / "portal.txt"
    inventory_path = snapshot_dir / "link-inventory.json"
    sources: list[dict[str, Any]] = []
    inventory: list[dict[str, Any]] = []
    form_candidates: dict[str, dict[str, Any]] = {}
    portal_text = ""
    if portal_result.get("http_status") == 200 and portal_result.get("body"):
        safe_html = scrub_portal_html(portal_result["body"])
        portal_html_path.write_bytes(safe_html)
        inventory, portal_text = parse_page_links(safe_html, portal_result.get("final_url") or args.portal_url)
        portal_text_path.write_text(portal_text, encoding="utf-8")
        for entry in inventory:
            if entry["category"] == "comment_form":
                key = entry["form_key"]
                form_candidates.setdefault(key, {"source_key": key, "url": entry["url"], "label": entry["label"]})
        inventory_path.write_text(json.dumps(inventory, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        sources.append({
            "source_key": "portal-html",
            "title": "FDOE Standards Review portal",
            "category": "portal_html",
            "requested_url": safe_url(args.portal_url),
            "final_url": portal_result.get("final_url"),
            "http_status": portal_result.get("http_status"),
            "content_type": portal_result.get("content_type"),
            "response_headers": portal_result.get("headers", {}),
            "path": "portal.html",
            "sha256": sha256_bytes(safe_html),
            "normalized_text_path": "portal.txt",
            "normalized_text_sha256": sha256_bytes(portal_text.encode("utf-8")),
            "bytes": len(safe_html),
            "pages": None,
            "rights_status": "private_snapshot_only; redistribution_not_assessed",
            "status": "captured",
        })
    else:
        sources.append({
            "source_key": "portal-html",
            "title": "FDOE Standards Review portal",
            "category": "portal_html",
            "requested_url": safe_url(args.portal_url),
            "final_url": portal_result.get("final_url"),
            "http_status": portal_result.get("http_status"),
            "content_type": portal_result.get("content_type"),
            "error": portal_result.get("error"),
            "sha256": None,
            "normalized_text_sha256": None,
            "bytes": 0,
            "pages": None,
            "rights_status": "private_snapshot_only; redistribution_not_assessed",
            "status": "incomplete_fetch",
        })

    docs, missing_docs = select_active_docs(inventory)
    issues.extend(missing_docs)
    for category in ACTIVE_DOCS:
        entry = docs.get(category)
        if not entry:
            continue
        requested_url = entry["url"]
        response = fetch_url(requested_url, args.timeout)
        fallback_used = False
        if response.get("http_status") != 200 or not response.get("body"):
            parsed = urllib.parse.urlsplit(requested_url)
            if parsed.hostname == "www.fldoe.org":
                cdn_url = urllib.parse.urlunsplit((parsed.scheme, "cdn.fldoe.org", parsed.path, parsed.query, ""))
                retry = fetch_url(cdn_url, args.timeout)
                if retry.get("http_status") == 200 and retry.get("body"):
                    retry["fallback_used"] = True
                    retry["primary_error"] = response.get("error") or response.get("http_status")
                    response = retry
                    fallback_used = True
        filename = DOC_FILENAMES[category]
        pdf_path = docs_dir / filename
        text_path = docs_dir / f"{Path(filename).stem}.txt"
        item: dict[str, Any] = {
            "source_key": category,
            "title": entry.get("label") or category,
            "category": category,
            "portal_section": entry.get("portal_section", "other_or_unlabeled"),
            "section_context": entry.get("section_context", []),
            "source_role": entry.get("source_role", "unclassified"),
            "requested_url": safe_url(requested_url),
            "final_url": response.get("final_url"),
            "http_status": response.get("http_status"),
            "content_type": response.get("content_type"),
            "response_headers": response.get("headers", {}),
            "fallback_used": fallback_used or bool(response.get("fallback_used")),
            "fallback_primary_error": response.get("primary_error"),
            "path": None,
            "normalized_text_path": None,
            "sha256": None,
            "normalized_text_sha256": None,
            "bytes": len(response.get("body") or b""),
            "pages": None,
            "rights_status": "private_snapshot_only; redistribution_not_assessed",
            "status": "captured" if response.get("http_status") == 200 and response.get("body") else "incomplete_fetch",
            "error": response.get("error"),
        }
        if item["status"] == "captured" and not response["body"].startswith(b"%PDF-"):
            item["status"] = "incomplete_not_pdf"
            item["error"] = "successful response did not begin with the PDF signature"
        if item["status"] == "captured":
            body = response["body"]
            pdf_path.write_bytes(body)
            item["path"] = str(pdf_path.relative_to(snapshot_dir))
            item["sha256"] = sha256_bytes(body)
            item["pages"] = pdf_page_count(pdf_path)
            text, extraction_error = pdf_to_text(pdf_path, text_path)
            if text is not None:
                text_path.write_text(text, encoding="utf-8")
                item["normalized_text_path"] = str(text_path.relative_to(snapshot_dir))
                item["normalized_text_sha256"] = sha256_bytes(text.encode("utf-8"))
            if extraction_error:
                item["extraction_note"] = extraction_error
                issues.append(f"text extraction incomplete for {category}: {extraction_error}")
        else:
            issues.append(f"active PDF fetch failed for {category}: {item['error'] or item['http_status']}")
        entry.update({
            "fetch_status": item["status"],
            "http_status": item.get("http_status"),
            "final_url": item.get("final_url"),
            "content_type": item.get("content_type"),
            "sha256": item.get("sha256"),
            "normalized_text_sha256": item.get("normalized_text_sha256"),
            "bytes": item.get("bytes"),
            "pages": item.get("pages"),
            "rights_status": item.get("rights_status"),
        })
        sources.append(item)

    forms_capture_status = "not_requested" if args.no_forms else "captured"
    form_states: dict[str, str] = {}
    if args.no_forms:
        issues.append("Microsoft Forms were inventoried but skipped by --no-forms")
        for entry in inventory:
            if entry["category"] == "comment_form":
                entry["fetch_status"] = "skipped_by_no_forms"
    else:
        forms_dir.mkdir(parents=True)
        if len(form_candidates) != EXPECTED_UNIQUE_FORMS:
            forms_capture_status = "incomplete_inventory_count"
            issues.append(
                f"found {len(form_candidates)} unique Microsoft Forms links; expected {EXPECTED_UNIQUE_FORMS}; captured discovered forms without guessing missing links"
            )
        for index, (key, form) in enumerate(sorted(form_candidates.items()), start=1):
            print(f"[{index}/{len(form_candidates)}] Form {key}", file=sys.stderr)
            record = capture_form_with_playwright(
                key,
                form["url"],
                args.timeout * 1000,
                args.max_form_pages,
            )
            record["title"] = form.get("label") or key
            record["category"] = "comment_form"
            link_match = next((link for link in inventory if link.get("form_key") == key), {})
            record["portal_section"] = link_match.get("portal_section", "other_or_unlabeled")
            record["section_context"] = link_match.get("section_context", [])
            record["source_role"] = link_match.get("source_role", "unclassified")
            record["form_link_count"] = sum(1 for link in inventory if link.get("form_key") == key)
            record["page_count"] = len(record.get("pages", []))
            form_states[key] = record.get("status", "incomplete_unknown")
            if record.get("pages"):
                form_json = forms_dir / f"{key}.json"
                form_text = forms_dir / f"{key}.txt"
                joined = "\n\n".join(
                    f"--- Form page {page['page_number']} ---\n{page['visible_text']}"
                    for page in record["pages"]
                )
                form_text.write_text(normalized_text(joined), encoding="utf-8")
                record["path"] = str(form_json.relative_to(snapshot_dir))
                record["normalized_text_path"] = str(form_text.relative_to(snapshot_dir))
                record["normalized_text_sha256"] = sha256_bytes(normalized_text(joined).encode("utf-8"))
                # Do not embed a file's own hash in its payload (self-referential).
                json_payload = {k: v for k, v in record.items() if k != "sha256"}
                form_json.write_text(json.dumps(json_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                record["sha256"] = sha256_bytes(form_json.read_bytes())
                record["bytes"] = len(form_json.read_bytes())
            else:
                record["path"] = None
                record["normalized_text_path"] = None
                record["sha256"] = None
                record["normalized_text_sha256"] = None
                record["bytes"] = 0
            if not str(record.get("status", "")).startswith("complete"):
                forms_capture_status = "incomplete"
                issues.append(f"form {key} capture incomplete: {record.get('status')} ({'; '.join(record.get('notes', []))})")
            sources.append(record)
            # Rewrite with final path/hash fields, which are not known until saved.
            if record.get("path"):
                for link in inventory:
                    if link.get("form_key") == key:
                        link.update({
                            "fetch_status": record.get("status"),
                            "http_status": record.get("http_status"),
                            "final_url": record.get("final_url"),
                            "content_type": record.get("content_type"),
                            "sha256": record.get("sha256"),
                            "normalized_text_sha256": record.get("normalized_text_sha256"),
                            "bytes": record.get("bytes"),
                            "pages": len(record.get("pages", [])),
                            "rights_status": record.get("rights_status"),
                        })
        for entry in inventory:
            if entry["category"] == "comment_form":
                entry["fetch_status"] = form_states.get(entry.get("form_key"), "not_captured")

    inventory_path.write_text(json.dumps(inventory, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # Save a checksum list for every retained payload, excluding manifests and reports.
    checksum_lines = []
    for path in sorted(snapshot_dir.rglob("*")):
        if path.is_file() and path.name not in {"SHA256SUMS.txt", "manifest.json", "change-report.md"}:
            checksum_lines.append(f"{sha256_bytes(path.read_bytes())}  {path.relative_to(snapshot_dir).as_posix()}")
    (snapshot_dir / "SHA256SUMS.txt").write_text("\n".join(checksum_lines) + "\n", encoding="utf-8")

    # Headers are small, non-secret, and useful for version comparison.
    if portal_result.get("headers"):
        (headers_dir / "portal.json").write_text(json.dumps(portal_result["headers"], indent=2) + "\n", encoding="utf-8")

    manifest: dict[str, Any] = {
        "schema": "fcs.fldoe.standardsreview.snapshot.v1",
        "snapshot_id": snapshot_dir.name,
        "checked_at_utc": iso_utc(fetched_at),
        "corpus_root": str(corpus_root),
        "portal_requested_url": safe_url(args.portal_url),
        "portal_final_url": portal_result.get("final_url"),
        "portal_status": portal_result.get("http_status"),
        "portal_content_type": portal_result.get("content_type"),
        "portal_fallback_used": bool(portal_result.get("fallback_used")),
        "forms_expected_unique": EXPECTED_UNIQUE_FORMS,
        "forms_discovered_unique": len(form_candidates),
        "forms_capture_status": forms_capture_status,
        "source_count": len(sources),
        "issues": issues,
        "rights_policy": "All source captures are private research witnesses; redistribution rights have not been assessed. Do not publish captured PDFs/form text without review.",
        "interaction_policy": "Microsoft Forms capture clicks exact-name Next only; never selects or fills response controls; Submit is never pressed.",
        "sources": sources,
    }
    for source in sources:
        source.setdefault("checked_at_utc", iso_utc(fetched_at))
    changes = compare_sources(manifest, prior_manifest)
    manifest["previous_snapshot_id"] = prior_dir.name if prior_dir else None
    manifest["changes"] = changes
    manifest["snapshot_status"] = "complete" if not issues and forms_capture_status == "captured" else "incomplete_or_partial"
    write_change_report(snapshot_dir / "change-report.md", snapshot_dir.name, prior_dir.name if prior_dir else None, changes, issues)
    (snapshot_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "snapshot_id": snapshot_dir.name,
        "snapshot_path": str(snapshot_dir),
        "status": manifest["snapshot_status"],
        "portal_status": portal_result.get("http_status"),
        "forms_discovered": len(form_candidates),
        "forms_capture_status": forms_capture_status,
        "issues": issues,
        "change_report": str(snapshot_dir / "change-report.md"),
    }, ensure_ascii=False, indent=2))
    return 0 if portal_result.get("http_status") == 200 else 2


if __name__ == "__main__":
    raise SystemExit(main())
