"""Archie LangGraph pipeline.

Builds and compiles the StateGraph that orchestrates all agents.
Each node is an agent function that receives ArchieState and returns
a partial dict — LangGraph merges it back into the shared state.

Current nodes:
  requirements → (more agents coming)

Error routing:
  Any agent that sets state["error"] is routed to the error_handler node,
  which stops the graph cleanly instead of crashing mid-run.
"""

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from backend.state import ArchieState
from backend.agents.requirements import requirements_agent
from backend.agents.design import design_agent

# ── Error handler node ───────────────────────────────────────────────────────

def error_handler(state: ArchieState) -> dict:
    """Terminal node — reached when any agent sets state['error']."""
    return {"current_agent": "error"}

# ── Routing logic ────────────────────────────────────────────────────────────

def route(state: ArchieState, next_node: str) -> str:
    return "error_handler" if state.get("error") else next_node

# ── Graph builder ────────────────────────────────────────────────────────────

def build_graph():
    """
    Compile and return the Archie StateGraph.

    MemorySaver checkpoints state after every node so that if the server
    restarts mid-run, a client can resume from the last completed agent
    using the same thread_id.
    """
    graph = StateGraph(ArchieState)

    # ── Nodes ──
    graph.add_node("requirements", requirements_agent)
    graph.add_node("design", design_agent)
    graph.add_node("error_handler", error_handler)

    # ── Entry point ──
    graph.set_entry_point("requirements")

    # ── Edges ──
    graph.add_conditional_edges(
        "requirements",
        lambda s: route(s, "design"),
        {"design": "design", "error_handler": "error_handler"},
    )
    graph.add_conditional_edges(
        "design",
        lambda s: route(s, END),
        {END: END, "error_handler": "error_handler"},
    )
    graph.add_edge("error_handler", END)

    return graph.compile(checkpointer=MemorySaver())


# Singleton — imported by api.py
archie_graph = build_graph()