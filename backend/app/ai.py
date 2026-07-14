"""External AI task-generation — STUBBED.

`call_ai_model()` is the single seam to replace with a real HTTP call to an
external model. Everything else (prompt building, 30s timeout, strict-JSON
validation, typed errors) stays the same when you swap in the real service.

The stub returns strict JSON so the parse/validation path is real code.
"""

from __future__ import annotations

import asyncio
import json
import os
import random
from datetime import datetime, timedelta, timezone

from pydantic import ValidationError

from .schemas import DraftTask

# 30s per spec; overridable via env so tests can exercise the timeout path fast.
AI_TIMEOUT_SECONDS = int(os.getenv("FIELDOPS_AI_TIMEOUT", "30"))


class AIError(Exception):
    """Typed failure the UI can render, e.g. 'Task generation failed — model_timeout'."""

    def __init__(self, code: str, message: str | None = None):
        self.code = code
        self.message = message or f"Task generation failed — {code}"
        super().__init__(self.message)


# A pool of task templates keyed by the designation category best suited to them.
_TEMPLATES: list[tuple[str, str, str]] = [
    ("Engineering", "Define service boundaries & API contract", "Draft the REST contract and error model."),
    ("Engineering", "Implement core data layer", "Build the persistence + data-access functions."),
    ("Engineering", "Wire authentication & sessions", "Access/refresh tokens and route guards."),
    ("Engineering", "Backend integration for {name}", "Connect services and background jobs."),
    ("Engineering", "Mobile client sync", "Offline queue and retry for field devices."),
    ("Quality", "Author end-to-end test plan", "Cover the critical flows with automation."),
    ("Quality", "Accessibility & keyboard pass", "Audit against WCAG AA and fix gaps."),
    ("Quality", "Design review of {name} screens", "Validate against the design system."),
    ("Delivery", "Draft rollout & runbook", "Sequencing, owners, and rollback plan."),
    ("Delivery", "Stakeholder status cadence", "Set up reporting and risk tracking."),
    ("Delivery", "Scope & milestone breakdown", "Decompose objectives into milestones."),
    ("Operations", "Provision infrastructure", "Environments, secrets, and monitoring."),
    ("Operations", "CI/CD pipeline for {name}", "Build, test, and deploy automation."),
    ("Business", "Customer rollout comms", "Prepare enablement and messaging."),
]

_PRIORITIES = ["HIGH", "MEDIUM", "LOW"]


def build_prompt(context: dict) -> str:
    """Construct the model prompt. (Kept as a string for easy swap to a real API.)"""
    team_lines = "\n".join(
        f"- {m['fullName']} ({m['designation']}, {m['category']}) id={m['id']}"
        for m in context.get("team", [])
    )
    objectives = "\n".join(f"- {o}" for o in context.get("objectives", []))
    return (
        "You are planning work for a field-operations project.\n"
        f"Project: {context.get('name')}\n"
        f"Description: {context.get('description')}\n"
        f"Timeline: {context.get('timeline')}\n"
        f"Objectives:\n{objectives}\n"
        f"Team:\n{team_lines}\n"
        "Return strict JSON: {\"tasks\": [{title, description, suggestedAssigneeId, "
        "priority, dueDate}]} with about 12 tasks mapped to member skills by designation."
    )


async def call_ai_model(prompt: str, context: dict) -> str:
    """SEAM: replace this stub with a real call to the external model API.

    Must return the model's raw response as a JSON string. Simulated failure
    modes let us exercise the timeout / parse-error surfaces.
    """
    mode = context.get("_simulate") or os.getenv("FIELDOPS_AI_MODE", "ok")

    if mode == "timeout":
        # Sleep past the timeout; asyncio.wait_for will cancel this.
        await asyncio.sleep(AI_TIMEOUT_SECONDS + 5)
    if mode == "badjson":
        return "{ this is not valid json "

    # Simulate a little model latency.
    await asyncio.sleep(0.2)

    team = context.get("team", [])
    by_category: dict[str, list[dict]] = {}
    for m in team:
        by_category.setdefault(m["category"], []).append(m)

    name = context.get("name", "the project")
    now = datetime.now(timezone.utc)
    tasks = []
    for i, (category, title, desc) in enumerate(_TEMPLATES[:12]):
        candidates = by_category.get(category) or team
        assignee = random.choice(candidates)["id"] if candidates else None
        tasks.append(
            {
                "title": title.format(name=name),
                "description": desc,
                "suggestedAssigneeId": assignee,
                "priority": _PRIORITIES[i % 3],
                "dueDate": (now + timedelta(days=5 + i * 2)).isoformat(),
            }
        )
    return json.dumps({"tasks": tasks})


async def generate_tasks(context: dict) -> list[dict]:
    """Return ~12 validated DRAFT tasks. Nothing is persisted here.

    Raises AIError('model_timeout') on timeout and AIError('parse_error') when
    the model output isn't valid, validatable JSON.
    """
    prompt = build_prompt(context)
    try:
        raw = await asyncio.wait_for(
            call_ai_model(prompt, context), timeout=AI_TIMEOUT_SECONDS
        )
    except asyncio.TimeoutError:
        raise AIError("model_timeout")

    try:
        data = json.loads(raw)
        items = data["tasks"]
        drafts = [DraftTask(**item).model_dump() for item in items]
    except (json.JSONDecodeError, KeyError, TypeError, ValidationError):
        raise AIError("parse_error")

    if not drafts:
        raise AIError("empty_result")
    return drafts
