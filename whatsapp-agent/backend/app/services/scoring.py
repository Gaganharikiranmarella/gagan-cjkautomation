"""Weighted, per-tenant lead scoring engine — §05 of the system design.

Deliberately NOT an LLM call: a sales manager can ask "why is this lead
scored 78?" and the answer needs to be a reproducible breakdown, not a model
explaining itself after the fact. The tenant's scoring_config (JSON) can be
tuned without a deploy.
"""

from __future__ import annotations

import datetime as dt
from typing import Any


def compute_score(
    scoring_config: dict[str, Any],
    slots: dict[str, Any],
    source: str,
    questions_completed: int,
    last_customer_message_at: dt.datetime | None,
    first_reply_latency_seconds: float | None,
) -> tuple[float, dict[str, Any]]:
    """Returns (score, breakdown) where breakdown lists each signal's
    contribution — written verbatim to lead_score_history.breakdown."""
    signals = scoring_config.get("signals", {})
    breakdown: dict[str, Any] = {}
    total = 0.0

    # source_quality
    sq = signals.get("source_quality", {})
    points = sq.get("map", {}).get(source, 0)
    breakdown["source_quality"] = {"value": source, "points": points}
    total += points

    # stated_budget
    sb = signals.get("stated_budget", {})
    budget_state = "confirmed" if slots.get("stated_budget") else "none"
    points = sb.get("map", {}).get(budget_state, 0)
    breakdown["stated_budget"] = {"value": slots.get("stated_budget"), "points": points}
    total += points

    # timeline_urgency
    tu = signals.get("timeline_urgency", {})
    raw_timeline = (slots.get("timeline_urgency") or "").lower()
    timeline_key = "exploring"
    if any(k in raw_timeline for k in ["immediate", "asap", "now", "today"]):
        timeline_key = "immediate"
    elif any(k in raw_timeline for k in ["quarter", "month", "week", "soon"]):
        timeline_key = "this_quarter"
    points = tu.get("map", {}).get(timeline_key, 0) if slots.get("timeline_urgency") else 0
    breakdown["timeline_urgency"] = {"value": slots.get("timeline_urgency"), "points": points}
    total += points

    # questions_completed
    qc = signals.get("questions_completed", {})
    per_q = qc.get("per_question", 4)
    max_q = qc.get("max_questions", 5)
    points = min(questions_completed, max_q) * per_q
    points = min(points, qc.get("weight", points))
    breakdown["questions_completed"] = {"value": questions_completed, "points": points}
    total += points

    # response_latency
    rl = signals.get("response_latency", {})
    if first_reply_latency_seconds is None:
        points = 0
    elif first_reply_latency_seconds < 3600:
        points = rl.get("under_1h", 0)
    elif first_reply_latency_seconds < 86400:
        points = rl.get("under_24h", 0)
    else:
        points = rl.get("over_24h", 0)
    breakdown["response_latency"] = {"value": first_reply_latency_seconds, "points": points}
    total += points

    # engagement_recency
    er = signals.get("engagement_recency", {})
    weight = er.get("weight", 10)
    decay = er.get("decay_per_day", 1.5)
    if last_customer_message_at is None:
        points = 0.0
    else:
        now = dt.datetime.now(dt.timezone.utc)
        last = last_customer_message_at
        if last.tzinfo is None:
            last = last.replace(tzinfo=dt.timezone.utc)
        days_since = max((now - last).total_seconds() / 86400, 0)
        points = max(weight - decay * days_since, 0)
    breakdown["engagement_recency"] = {"value": round(points, 2), "points": round(points, 2)}
    total += points

    total = round(min(total, 100), 2)
    return total, breakdown


def status_for_score(scoring_config: dict[str, Any], score: float) -> str:
    thresholds = scoring_config.get("thresholds", {})
    if score >= thresholds.get("qualified_at", 70):
        return "qualified"
    if score >= thresholds.get("contacted_below", 55):
        return "qualifying"
    if score >= thresholds.get("unqualified_below", 30):
        return "contacted"
    return "new" if score == 0 else "unqualified"
