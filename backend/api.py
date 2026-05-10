"""Archie FastAPI server.

Endpoints:
  POST /run          — start a new pipeline run, returns thread_id + result
  GET  /run/{id}     — get the state of a previous run (via checkpointer)
  GET  /health       — liveness check

Run locally:
  uvicorn backend.api:app --reload --port 8000
"""

import uuid
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.graph import archie_graph
from backend.state import Constraints


# ── App setup ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Archie API",
    description="Multi-agent architecture intelligence pipeline",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten this before deploying publicly
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / response schemas ───────────────────────────────────────────────

class RunRequest(BaseModel):
    user_input: str
    thread_id: Optional[str] = None   # pass an existing id to resume a run


class RunResponse(BaseModel):
    thread_id: str
    current_agent: str
    constraints: Optional[dict] = None
    architectures: Optional[list] = None      
    tech_decisions: Optional[list] = None
    error: Optional[str] = None
    status: str   # "complete" | "error"


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.post("/run", response_model=RunResponse)
async def run_pipeline(request: RunRequest) -> RunResponse:
    """
    Start (or resume) an Archie pipeline run.

    - A new thread_id is generated if one isn't supplied.
    - The graph runs synchronously through all completed agents and returns.
    - State is checkpointed after every node, so the thread_id can be used
      to inspect or resume the run later.
    """
    thread_id = request.thread_id or str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    initial_state = {
        "user_input": request.user_input,
        "constraints": None,
        "current_agent": "requirements",
        "error": None,
    }

    try:
        final_state: dict[str, Any] = await archie_graph.ainvoke(
            initial_state, config=config
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    constraints = final_state.get("constraints")

    return RunResponse(
        thread_id=thread_id,
        current_agent=final_state.get("current_agent", "unknown"),
        constraints=constraints.model_dump() if isinstance(constraints, Constraints) else constraints,
        architectures=final_state.get("architectures"),      
        tech_decisions=final_state.get("tech_decisions"),
        error=final_state.get("error"),
        status="error" if final_state.get("error") else "complete",
    )


@app.get("/run/{thread_id}", response_model=RunResponse)
async def get_run(thread_id: str) -> RunResponse:
    """
    Retrieve the checkpointed state of a previous run by thread_id.
    Useful for polling or debugging without re-running the pipeline.
    """
    config = {"configurable": {"thread_id": thread_id}}

    try:
        state_snapshot = await archie_graph.aget_state(config)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    if not state_snapshot or not state_snapshot.values:
        raise HTTPException(status_code=404, detail=f"No run found for thread_id: {thread_id}")

    state = state_snapshot.values
    constraints = state.get("constraints")

    return RunResponse(
        thread_id=thread_id,
        current_agent=state.get("current_agent", "unknown"),
        constraints=constraints.model_dump() if isinstance(constraints, Constraints) else constraints,
        architectures=state.get("architectures"),
        tech_decisions=state.get("tech_decisions"),
        error=state.get("error"),
        status="error" if state.get("error") else "complete",
    )


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}