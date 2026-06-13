#!/usr/bin/env python3
"""Advisory lead journey analyzer.

Reads one JSON payload from stdin and writes suggestion JSON to stdout.
This module is intentionally stdlib-only so it can run inside the API service
without depending on the optional edge FastAPI runtime.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


Suggestion = Dict[str, Any]


def parse_date(value: Any) -> Optional[datetime]:
    if not isinstance(value, str) or not value:
        return None
    try:
        normalized = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def days_since(value: Any, now: datetime) -> Optional[int]:
    parsed = parse_date(value)
    if not parsed:
        return None
    return max(0, (now - parsed).days)


def latest_date(values: List[Any]) -> Optional[datetime]:
    dates = [parsed for parsed in (parse_date(value) for value in values) if parsed]
    return max(dates) if dates else None


def channel_status_map(lead: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    result: Dict[str, Dict[str, Any]] = {}
    for item in lead.get("channelStatuses") or []:
        channel = str(item.get("channel") or "").upper()
        if channel:
            result[channel] = {
                "status": str(item.get("status") or "NOT_STARTED").upper(),
                "lastActivityAt": item.get("lastActivityAt"),
            }
    return result


def add_suggestion(
    suggestions: List[Suggestion],
    suggestion_id: str,
    severity: str,
    title: str,
    reason: str,
    recommendation: str,
    suggested_action: Optional[Dict[str, str]] = None,
) -> None:
    suggestions.append(
        {
            "id": suggestion_id,
            "severity": severity,
            "title": title,
            "reason": reason,
            "recommendation": recommendation,
            "suggestedAction": suggested_action,
        }
    )


def analyze(payload: Dict[str, Any]) -> Dict[str, Any]:
    now = parse_date(payload.get("now")) or datetime.now(timezone.utc)
    lead = payload.get("lead") or {}
    channels = channel_status_map(lead)
    activities = lead.get("leadActivities") or []
    emails = lead.get("emails") or []
    status = str(lead.get("status") or "NEW").upper()
    pipeline_state = str(lead.get("pipelineState") or "COLD").upper()
    suggestions: List[Suggestion] = []

    last_activity = latest_date(
        [
            lead.get("updatedAt"),
            lead.get("pipelineStateChangedAt"),
            *(item.get("lastActivityAt") for item in channels.values()),
            *(item.get("createdAt") for item in activities),
            *(item.get("createdAt") for item in emails),
        ]
    )
    stale_days = (now - last_activity).days if last_activity else days_since(lead.get("createdAt"), now)

    if stale_days is not None and stale_days >= 15 and status not in {"WON", "LOST", "CONVERTED"}:
        add_suggestion(
            suggestions,
            "lead_stale_15_days",
            "high",
            "Lead has not moved for 15+ days",
            f"No meaningful journey activity was detected for {stale_days} days.",
            "Review the lead, confirm whether follow-up is still needed, or close it as won/lost/not relevant.",
            {"channel": "CALL", "status": "FOLLOW_UP"},
        )

    email = channels.get("EMAIL")
    linkedin = channels.get("LINKEDIN")
    whatsapp = channels.get("WHATSAPP")
    call = channels.get("CALL")

    if email and email["status"] in {"CONTACTED", "REPLIED", "FOLLOW_UP"} and not linkedin:
        add_suggestion(
            suggestions,
            "email_only_linkedin_missing",
            "medium",
            "Email touched, LinkedIn not started",
            "This lead has email activity but no LinkedIn channel status.",
            "Consider capturing the LinkedIn profile or preparing a LinkedIn follow-up if this lead is still relevant.",
            {"channel": "LINKEDIN", "status": "CAPTURED"},
        )

    if linkedin and linkedin["status"] in {"CAPTURED", "DRAFTED"}:
        age = days_since(linkedin.get("lastActivityAt"), now)
        if age is not None and age >= 7:
            add_suggestion(
                suggestions,
                "linkedin_captured_not_contacted",
                "medium",
                "LinkedIn captured but not contacted",
                f"LinkedIn has been {linkedin['status'].lower()} for {age} days without a contacted update.",
                "If the user already sent the LinkedIn message manually, mark LinkedIn as contacted. Otherwise prepare follow-up.",
                {"channel": "LINKEDIN", "status": "CONTACTED"},
            )

    if email and email["status"] == "CONTACTED":
        age = days_since(email.get("lastActivityAt"), now)
        if age is not None and age >= 5 and status not in {"REPLIED", "FOLLOW_UP_NEEDED"}:
            add_suggestion(
                suggestions,
                "email_sent_no_reply",
                "medium",
                "Email sent, no reply recorded",
                f"Email was marked contacted {age} days ago and no reply/follow-up state is recorded.",
                "Check inbox context and mark follow-up needed if there is no reply.",
                {"channel": "EMAIL", "status": "FOLLOW_UP"},
            )

    if status == "FOLLOW_UP_NEEDED":
        age = days_since(lead.get("updatedAt"), now)
        if age is not None and age >= 3:
            add_suggestion(
                suggestions,
                "follow_up_waiting",
                "high",
                "Follow-up needed is aging",
                f"The lead has been waiting in follow-up state for about {age} days.",
                "Assign a human follow-up path, log the next outreach channel, or close if no longer relevant.",
                {"channel": "CALL", "status": "FOLLOW_UP"},
            )

    if pipeline_state == "HOT" and not call:
        age = days_since(lead.get("hotAt") or lead.get("pipelineStateChangedAt"), now)
        if age is not None and age >= 2:
            add_suggestion(
                suggestions,
                "hot_without_caller",
                "high",
                "Hot lead needs human caller review",
                f"The lead has been hot for {age} days with no call status.",
                "Review for caller handoff and log call progress once a human caller acts.",
                {"channel": "CALL", "status": "CONTACTED"},
            )

    if pipeline_state == "COORDINATING" and call and call["status"] != "CONTACTED":
        age = days_since(lead.get("pipelineStateChangedAt"), now)
        if age is not None and age >= 7:
            add_suggestion(
                suggestions,
                "coordinating_without_call_outcome",
                "medium",
                "Coordination has no call outcome",
                f"The lead has been coordinating for {age} days without a completed call status.",
                "Ask the caller to log contacted, follow-up, closed, or not relevant.",
                {"channel": "CALL", "status": "CONTACTED"},
            )

    if whatsapp and whatsapp["status"] == "CONTACTED" and not lead.get("whatsappConsent"):
        add_suggestion(
            suggestions,
            "whatsapp_consent_missing",
            "high",
            "WhatsApp contacted without consent flag",
            "WhatsApp channel is marked contacted, but the lead consent flag is not set.",
            "Verify consent proof before further WhatsApp outreach and update consent if confirmed.",
            {"channel": "WHATSAPP", "status": "FOLLOW_UP"},
        )

    severity_rank = {"high": 0, "medium": 1, "low": 2}
    suggestions.sort(key=lambda item: severity_rank.get(item["severity"], 3))
    return {"suggestions": suggestions, "generatedAt": now.isoformat()}


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        print(json.dumps(analyze(payload), separators=(",", ":")))
        return 0
    except Exception as exc:  # keep API caller safe and structured
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
