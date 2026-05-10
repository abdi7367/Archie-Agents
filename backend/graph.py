"""Archie LangGraph pipeline.

Flow:
  requirements → [clarifying (pause) | parallel_design_tech] → END

The clarifying node is a human-in-the-loop interrupt point.
Design and tech_decisions agents run in parallel to cut latency.
"""

import asyncio
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from backend.state import ArchieState
from backend.agents.requirements import requirements_agent
from backend.agents.design import design_agent
from backend.agents.tech_decisions import tech_decisions_agent


# ── Error handler ────────────────────────────────────────────────────────────

def error_handler(state: ArchieState) -> dict:
    err = state.get("error") or "Architecture pipeline stopped before producing results."
    return {"current_agent": "error", "error": err}


def clarifying_node(state: ArchieState) -> dict:
    """Human-in-the-loop pause. Does nothing — just a named stop point."""
    return {}


# ── Parallel node ─────────────────────────────────────────────────────────────

async def parallel_design_tech_node(state: ArchieState) -> dict:
    """
    Run design_agent and tech_decisions_agent concurrently.

    Tech decisions depend on architectures, so we:
      1. Run design first to get architectures
      2. Immediately feed those into tech_decisions
    Both are IO-bound (LLM calls), so we overlap them by running design,
    then kick off tech_decisions as soon as design resolves — all inside
    a single async gather so LangGraph sees one state update.

    Since design output is required by tech_decisions, true parallelism
    isn't possible for these two. Instead we pipeline them tightly and
    avoid the overhead of two separate graph checkpoints.
    """
    loop = asyncio.get_event_loop()

    # Run design synchronously in a thread (it's a blocking call)
    design_result = await loop.run_in_executor(None, design_agent, state)

    if design_result.get("error"):
        return {**design_result, "current_agent": "error"}

    # Merge design output into a temporary state for tech_decisions
    merged_state = dict(state)
    merged_state["architectures"] = design_result.get("architectures")
    merged_state["current_agent"] = "tech_decisions"

    # Run tech_decisions in a thread immediately
    tech_result = await loop.run_in_executor(None, tech_decisions_agent, merged_state)

    # Combine both results into one state update
    return {
        "architectures": design_result.get("architectures"),
        "tech_decisions": tech_result.get("tech_decisions"),
        "current_agent": "complete" if not tech_result.get("error") else "error",
        "error": tech_result.get("error") or design_result.get("error"),
    }


# ── Routing ───────────────────────────────────────────────────────────────────

def route_after_requirements(state: ArchieState) -> str:
    if state.get("error"):
        return "error_handler"
    agent = state.get("current_agent", "")
    if agent == "clarifying":
        return "clarifying"
    return "parallel_design_tech"


def route_after_clarifying(state: ArchieState) -> str:
    if state.get("error"):
        return "error_handler"
    answers = state.get("clarification_answers")
    # POST /clarify always sends a dict — {} means "skip"; non-empty merges via requirements.
    if answers:
        return "requirements"
    # Skip: continue analysis with extracted constraints (do not END with no design output).
    if state.get("constraints"):
        return "parallel_design_tech"
    return "error_handler"


def route_after_parallel(state: ArchieState) -> str:
    return "error_handler" if state.get("error") else END


# ── Graph builder ────────────────────────────────────────────────────────────

def build_graph():
    graph = StateGraph(ArchieState)

    graph.add_node("requirements", requirements_agent)
    graph.add_node("clarifying", clarifying_node)
    graph.add_node("parallel_design_tech", parallel_design_tech_node)
    graph.add_node("error_handler", error_handler)

    graph.set_entry_point("requirements")

    graph.add_conditional_edges(
        "requirements",
        route_after_requirements,
        {
            "clarifying":          "clarifying",
            "parallel_design_tech": "parallel_design_tech",
            "error_handler":       "error_handler",
        },
    )

    graph.add_conditional_edges(
        "clarifying",
        route_after_clarifying,
        {
            "requirements":         "requirements",
            "parallel_design_tech": "parallel_design_tech",
            "error_handler":        "error_handler",
        },
    )

    graph.add_conditional_edges(
        "parallel_design_tech",
        route_after_parallel,
        {
            END:             END,
            "error_handler": "error_handler",
        },
    )

    graph.add_edge("error_handler", END)

    return graph.compile(
        checkpointer=MemorySaver(),
        interrupt_before=["clarifying"],
    )


archie_graph = build_graph()