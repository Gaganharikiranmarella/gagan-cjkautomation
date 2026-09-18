"""The one place this codebase talks to Claude.

Per the system design (§04/§10): the qualification path is a deterministic
script + scoring engine, not an LLM improvising a sales conversation — so
Claude is deliberately scoped to three jobs:

  1. detect the customer's language (Hindi / English / Hinglish at v1)
  2. extract a structured answer for the qualification question currently
     in play (slot filling)
  3. draft a free-text fallback reply, in the customer's own language, when
     they say something the script didn't anticipate

A fourth, dashboard-side job — suggesting a CSV column mapping — reuses the
same client for the CSV import wizard.
"""

from __future__ import annotations

import json
from typing import Any, Optional

import anthropic

from app.config import get_settings

QUALIFICATION_SCRIPT = [
    {
        "step": 1,
        "slot": "interest",
        "question_en": "Thanks for reaching out! Could you tell me a bit about what you're looking for?",
        "question_hi": "सम्पर्क करने के लिए धन्यवाद! कृपया बताएं आप क्या तलाश रहे हैं?",
    },
    {
        "step": 2,
        "slot": "stated_budget",
        "question_en": "Got it. Do you have a budget range in mind for this?",
        "question_hi": "समझ गया। क्या आपके पास इसके लिए एक अनुमानित बजट है?",
    },
    {
        "step": 3,
        "slot": "timeline_urgency",
        "question_en": "And what's your timeline — are you looking to move on this immediately, this quarter, or just exploring?",
        "question_hi": "और आपकी समय-सीमा क्या है — तुरंत, इस तिमाही में, या अभी सिर्फ जानकारी ले रहे हैं?",
    },
    {
        "step": 4,
        "slot": "company",
        "question_en": "Great — last thing, which company / team is this for?",
        "question_hi": "बढ़िया — आखिरी सवाल, यह किस कंपनी / टीम के लिए है?",
    },
]

_SYSTEM_PROMPT = """You are the language & extraction layer behind a WhatsApp lead-qualification bot.
You never invent the sales script yourself. Given the customer's latest WhatsApp message and the
qualification slot currently being asked about, respond with STRICT JSON only, matching this shape:

{
  "language": "en" | "hi" | "hinglish" | "other",
  "opted_out": boolean,               // true only if the message is a clear STOP/unsubscribe/opt-out request
  "extracted_value": string | null,   // best-effort structured answer to the current slot, or null if unclear
  "confidence": number,               // 0-1
  "fallback_reply": string | null     // ONLY set this if the message doesn't answer the current slot at all
                                       // (off-script question, confusion, chit-chat) — a short, warm reply
                                       // in the customer's own detected language. Otherwise null.
}

No prose, no markdown fences — a single JSON object."""


def _client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=get_settings().anthropic_api_key)


def analyze_message(message_text: str, current_slot: Optional[str], history: list[dict[str, Any]]) -> dict[str, Any]:
    """Runs jobs 1-3 in a single call: language detection, slot extraction,
    and (when needed) a fallback reply."""
    settings = get_settings()
    if not settings.anthropic_api_key:
        # Graceful degradation if no key is configured yet — the rest of the
        # pipeline (scoring, persistence, dashboard) still works end to end.
        return {
            "language": "en",
            "opted_out": message_text.strip().lower() in {"stop", "unsubscribe"},
            "extracted_value": message_text.strip() or None,
            "confidence": 0.3,
            "fallback_reply": None,
        }

    transcript = "\n".join(f"{m['direction']}: {m['text']}" for m in history[-6:])
    user_prompt = (
        f"Current qualification slot being asked about: {current_slot or 'none (open greeting)'}\n\n"
        f"Recent conversation:\n{transcript}\n\n"
        f"Customer's latest message: {message_text!r}"
    )

    resp = _client().messages.create(
        model=settings.claude_model,
        max_tokens=400,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )
    raw = resp.content[0].text if resp.content else "{}"
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {
            "language": "en",
            "opted_out": False,
            "extracted_value": None,
            "confidence": 0.0,
            "fallback_reply": "Sorry, could you rephrase that?",
        }


def suggest_csv_column_mapping(headers: list[str]) -> dict[str, Optional[str]]:
    """Agentic assist for the CSV import wizard: given the uploaded file's
    column headers, suggest which one maps to each lead field."""
    settings = get_settings()
    target_fields = ["name", "phone", "company", "source", "notes", "tags"]
    if not settings.anthropic_api_key:
        # Fallback heuristic: case-insensitive substring match.
        mapping: dict[str, Optional[str]] = {}
        for field in target_fields:
            mapping[field] = next((h for h in headers if field in h.lower()), None)
        return mapping

    prompt = (
        "A CSV of sales leads has these column headers: "
        f"{json.dumps(headers)}. Map each of these target fields to the best matching "
        f"header (or null if none fits): {json.dumps(target_fields)}. "
        "Respond with STRICT JSON only: {\"field\": \"header_or_null\", ...}."
    )
    resp = _client().messages.create(
        model=settings.claude_model,
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = resp.content[0].text if resp.content else "{}"
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {field: None for field in target_fields}


def suggest_reply_draft(transcript: list[dict[str, Any]], instruction: str) -> str:
    """Used by the sales rep's "suggest a reply" button in the conversation
    view — drafts a reply for the rep to review and send, never sent automatically."""
    settings = get_settings()
    if not settings.anthropic_api_key:
        return "(Set ANTHROPIC_API_KEY to enable AI-drafted replies.)"

    convo = "\n".join(f"{m['direction']}: {m['text']}" for m in transcript[-10:])
    resp = _client().messages.create(
        model=settings.claude_model,
        max_tokens=300,
        system="You draft short, professional WhatsApp reply suggestions for a sales rep. "
        "Match the customer's language and tone. Output only the message text, nothing else.",
        messages=[{"role": "user", "content": f"Conversation so far:\n{convo}\n\nInstruction: {instruction}"}],
    )
    return resp.content[0].text if resp.content else ""
