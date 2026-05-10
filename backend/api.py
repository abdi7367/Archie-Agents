"""Archie FastAPI server.

Endpoints:
  POST /run          — start a pipeline run in the background, returns thread_id immediately
  GET  /run/{id}     — poll the state of a run (pending | running | complete | error)
  GET  /health       — liveness check

FIX: The original api.py called ainvoke() synchronously inside the POST handler.
     For 3 LLM calls this takes 30-90 seconds — enough to timeout in most proxies.
     Now POST returns immediately with thread_id; the graph runs in a background task.
     The frontend polls GET /run/{id} until status is "complete" or "error".

Run locally:
  uvicorn backend.api:app --reload --port 8001
"""
import os
import uuid
import json
import pathlib
import tempfile
import threading
from typing import Any, Optional

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.graph import archie_graph
from backend.state import Constraints


# ── App setup ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Archie API",
    description="Multi-agent architecture intelligence pipeline",
    version="0.2.0",
)

origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    
]
frontend_url = os.getenv("FRONTEND_URL", "")
if frontend_url:
    origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    # FIX: lock this down to your actual frontend origin before deploying
    allow_origins=origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ── In-memory run status registry ────────────────────────────────────────────
# Tracks whether a thread is still running so the GET endpoint can return
# a "running" status before the graph checkpoints its final state.
# NOTE: this is per-process. If you run multiple workers, use Redis instead.
# Use the system temp dir so Windows (no /tmp) and Linux both work. Override
# with ARCHIE_RUNS_STATE_DIR if you need a fixed path in containers.

_STATUS_FILE = pathlib.Path(
    os.environ.get("ARCHIE_RUNS_STATE_DIR", tempfile.gettempdir())
) / "archie_runs.json"
_lock = threading.Lock()

def _get_status(tid: str) -> str | None:
    try:
        return json.loads(_STATUS_FILE.read_text()).get(tid)
    except Exception:
        return None

def _set_status(tid: str, status: str) -> None:
    with _lock:
        _STATUS_FILE.parent.mkdir(parents=True, exist_ok=True)
        try:
            data = json.loads(_STATUS_FILE.read_text()) if _STATUS_FILE.exists() else {}
        except Exception:
            data = {}
        data[tid] = status
        _STATUS_FILE.write_text(json.dumps(data))


# ── Request / response schemas ───────────────────────────────────────────────

class RunRequest(BaseModel):
    user_input: str
    thread_id: Optional[str] = None


class RunResponse(BaseModel):
    thread_id: str
    status: str                          # "pending" | "running" | "complete" | "error"
    current_agent: Optional[str] = None
    constraints: Optional[dict] = None
    architectures: Optional[list] = None
    tech_decisions: Optional[list] = None
    error: Optional[str] = None

class ClarifyRequest(BaseModel):
    thread_id: str
    answers: dict


# ── Background pipeline runner ───────────────────────────────────────────────

async def _run_pipeline(thread_id: str, user_input: str) -> None:
    """Runs the graph from initial user input (new thread)."""
    config = {"configurable": {"thread_id": thread_id}}
    _set_status(thread_id, "running")
    try:
        await archie_graph.ainvoke({"user_input": user_input}, config=config)
        snap = await archie_graph.aget_state(config)
        values = (snap.values if snap else None) or {}
        if values.get("error") or values.get("current_agent") == "error":
            _set_status(thread_id, "error")
        elif values.get("current_agent") == "clarifying":
            # Interrupted before clarifying — keep running until POST /clarify
            _set_status(thread_id, "running")
        else:
            _set_status(thread_id, "complete")
    except Exception as exc:
        _set_status(thread_id, "error")
        print(f"[Archie] Pipeline error for {thread_id}: {exc}")


async def _resume_pipeline(thread_id: str) -> None:
    """Resumes a paused graph after clarification answers are submitted."""
    config = {"configurable": {"thread_id": thread_id}}
    _set_status(thread_id, "running")
    try:
        await archie_graph.ainvoke(None, config=config)
        _set_status(thread_id, "complete")
    except Exception as exc:
        _set_status(thread_id, "error")
        print(f"[Archie] Resume error for {thread_id}: {exc}")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _serialize_state(thread_id: str, state: dict[str, Any]) -> RunResponse:
    """Convert raw graph state dict into a RunResponse."""
    constraints = state.get("constraints")
    agent_error = state.get("error")
    agent_status = _get_status(thread_id) or "complete"

    # If the graph itself flagged an error, override the status
    if agent_error:
        agent_status = "error"

    return RunResponse(
        thread_id=thread_id,
        status=agent_status,
        current_agent=state.get("current_agent"),
        constraints=(
            constraints.model_dump()
            if isinstance(constraints, Constraints)
            else constraints
        ),
        architectures=state.get("architectures"),
        tech_decisions=state.get("tech_decisions"),
        error=agent_error,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/run", response_model=RunResponse)
async def start_run(request: RunRequest, background_tasks: BackgroundTasks) -> RunResponse:
    """
    Start a new pipeline run.

    Returns immediately with thread_id + status="pending".
    The pipeline runs in the background — poll GET /run/{thread_id} for results.
    """
    thread_id = request.thread_id or str(uuid.uuid4())

    # Avoid re-running a thread that's already in flight or complete
    existing_status = _get_status(thread_id)
    if existing_status in ("running", "complete"):
        # Just return current state without kicking off another run
        return await get_run(thread_id)

    _set_status(thread_id, "pending")
    background_tasks.add_task(_run_pipeline, thread_id, request.user_input)

    return RunResponse(
        thread_id=thread_id,
        status="pending",
        current_agent="requirements",
    )

@app.post("/clarify", response_model=RunResponse)
async def submit_clarification(
    request: ClarifyRequest,
    background_tasks: BackgroundTasks,
) -> RunResponse:
    thread_id = request.thread_id

    if _get_status(thread_id) is None:
        raise HTTPException(
            status_code=404,
            detail=f"No run found for thread_id: {thread_id}. Start one with POST /run."
        )

    config = {"configurable": {"thread_id": thread_id}}

    await archie_graph.aupdate_state(
        config,
        {
            "clarification_answers": request.answers
        },
        as_node="clarifying",
    )

    background_tasks.add_task(_resume_pipeline, thread_id)

    return RunResponse(
        thread_id=thread_id,
        status="running",
        current_agent="requirements",
    )


@app.get("/run/{thread_id}", response_model=RunResponse)
async def get_run(thread_id: str) -> RunResponse:
    """
    Poll a pipeline run.

    Returns the latest checkpointed state. The frontend should call this
    every 2-3 seconds until status is "complete" or "error".
    """
    # If we have no record of this thread at all, 404 early
    if _get_status(thread_id) is None:
        raise HTTPException(
            status_code=404,
            detail=f"No run found for thread_id: {thread_id}. Start one with POST /run."
        )

    current_status = _get_status(thread_id)

    # If still pending (background task hasn't started yet), return early
    if current_status == "pending":
        return RunResponse(
            thread_id=thread_id,
            status="pending",
            current_agent="requirements",
        )

    config = {"configurable": {"thread_id": thread_id}}
    try:
        snapshot = await archie_graph.aget_state(config)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    if not snapshot or not snapshot.values:
        # Graph started but no checkpoint yet — still spinning up
        return RunResponse(
            thread_id=thread_id,
            status="running",
            current_agent="requirements",
        )

    return _serialize_state(thread_id, snapshot.values)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}