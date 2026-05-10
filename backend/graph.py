"""Archie LangGraph pipeline.

Flow:
  requirements → [clarifying (pause) | design] → tech_decisions → END
 
The clarifying node is a human-in-the-loop interrupt point.
When requirements_agent returns current_agent="clarifying", the graph
stops there. The /clarify API endpoint updates state with answers
and resumes from requirements (which now merges the answers).
"""

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from backend.state import ArchieState
from backend.agents.requirements import requirements_agent
from backend.agents.design import design_agent
from backend.agents.tech_decisions import tech_decisions_agent

# ── Error handler node ───────────────────────────────────────────────────────

def error_handler(state: ArchieState) -> dict:
    """Terminal node — reached when any agent sets state['error']."""
    return {"current_agent": "error"}

def clarifying_node(state: ArchieState) -> dict:
    """
    Human-in-the-loop pause node.
    Does nothing — just a named stop point in the graph.
    The API layer handles state update + resume via aupdate_state + ainvoke.
    """
    return {}

# ── Routing ───────────────────────────────────────────────────────────────────
 
def route_after_requirements(state: ArchieState) -> str:
    if state.get("error"):
        return "error_handler"
    agent = state.get("current_agent", "")
    if agent == "clarifying":
        return "clarifying"
    return "design"
 
 
def route_after_clarifying(state: ArchieState) -> str:
    """After clarifying, re-run requirements to merge answers, then design."""
    if state.get("error"):
        return "error_handler"
    answers = state.get("clarification_answers") or {}
    if answers:
        return "requirements"  # loop back to merge answers
    return END  # no answers submitted yet — stay paused
 
 
def route_after_design(state: ArchieState) -> str:
    return "error_handler" if state.get("error") else "tech_decisions"
 
 
def route_after_tech(state: ArchieState) -> str:
    return "error_handler" if state.get("error") else END

# ── Graph builder ────────────────────────────────────────────────────────────

def build_graph():
    graph = StateGraph(ArchieState)

    # ── Nodes ──
    graph.add_node("requirements", requirements_agent)
    graph.add_node("clarifying", clarifying_node)
    graph.add_node("design", design_agent)
    graph.add_node("tech_decisions", tech_decisions_agent)
    graph.add_node("error_handler", error_handler)

    # ── Entry point ──
    graph.set_entry_point("requirements")

    # ── Edges ──
    graph.add_conditional_edges(
        "requirements",
        route_after_requirements,
        {
            "clarifying":    "clarifying",
            "design":        "design",
            "error_handler": "error_handler",
        },
    )
    graph.add_conditional_edges(
        "clarifying",
        route_after_clarifying,
        {
            "requirements":  "requirements",
            END:             END,
            "error_handler": "error_handler",
        },
    )
    graph.add_conditional_edges(
        "design",
        route_after_design,
        {
            "tech_decisions": "tech_decisions",
            "error_handler":  "error_handler",
        },
    )
 
    graph.add_conditional_edges(
        "tech_decisions",
        route_after_tech,
        {
            END:             END,
            "error_handler": "error_handler",
        },
    )
 
    graph.add_edge("error_handler", END)
 
    # Interrupt at the clarifying node so the graph pauses for human input
    return graph.compile(
        checkpointer=MemorySaver(),
        interrupt_before=["clarifying"],
    )


# Singleton — imported by api.py
archie_graph = build_graph()