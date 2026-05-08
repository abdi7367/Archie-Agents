"""State definitions for the Archie pipeline.
 
ArchieState is the single object passed through the LangGraph graph.
Constraints is the validated output of the Requirements Agent.
"""
 
from __future__ import annotations
 
from enum import Enum
from typing import List, Optional
 
from pydantic import BaseModel, Field
from typing_extensions import TypedDict


# ── Enums ────────────────────────────────────────────────────────────────────

class TrafficPattern(str, Enum):
    STEADY    = "steady"      # consistent load all day
    SPIKY     = "spiky"       # unpredictable bursts
    SCHEDULED = "scheduled"   # predictable peaks (e.g. 9-5)
    GROWING   = "growing"     # steady growth curve

class ExperienceLevel(str, Enum):
    JUNIOR = "junior"
    MID    = "mid"
    SENIOR = "senior"
    MIXED  = "mixed"

class CloudProvider(str, Enum):
    AWS = "AWS"
    GCP = "GCP"
    AZURE = "Azure"
    NONE = "none"

class DataSensitivity(str, Enum):
    PUBLIC = "public"
    INTERNAL = "internal"
    PII = "PII"
    FINANCIAL = "financial"
    MEDICAL = "medical"

class GrowthExpectation(str, Enum):
    STABLE = "stable"
    MODERATE = "moderate"
    HYPERGROWTH = "hypergrowth"

class ProductType(str, Enum):
    CONSUMER_APP = "consumer app"
    B2B_SAAS = "B2B SaaS"
    INTERNAL_TOOL = "internal tool"
    DATA_PIPELINE = "data pipeline"
    IOT = "IoT"


# ─────────────────────────────────────────
# PYDANTIC MODELS — validate agent outputs
# ─────────────────────────────────────────

class Constraints(BaseModel):
    """
    Fully validated constraint object produced by the Requirements Agent.
    All downstream agents read from this.
    """
    scale:              Optional[str]              = None   # "100k orders/day"
    traffic_pattern:    Optional[TrafficPattern]   = None
    peak_multiplier:    Optional[float]            = None   # 3.0 = 3x peak vs average
    team_size:          Optional[int]              = None
    experience_level:   Optional[ExperienceLevel]  = None
    budget:             Optional[str]              = None   # "$3k/month"
    latency_sla:        Optional[str]              = None   # "200ms p99"
    stack:              List[str]                  = Field(default_factory=list)
    preferred_cloud:    Optional[CloudProvider]    = None
    data_sensitivity:   Optional[DataSensitivity]  = None
    data_volume:        Optional[str]              = None   # "100GB/day"
    compliance:         List[str]                  = Field(default_factory=list)
    regions:            List[str]                  = Field(default_factory=list)
    product_type:       Optional[ProductType]      = None
    growth_expectation: Optional[GrowthExpectation] = None


class Tradeoffs(BaseModel):
    pros: List[str] = Field(default_factory=list)
    cons: List[str] = Field(default_factory=list)

class Architecture(BaseModel):
    """One architecture tier. Design Agent produces 3 of these."""
    
    tier: str                                        # "MVP" | "Production" | "Future-scale"
    summary: str                                     # one-sentence description
    components: List[str] = Field(default_factory=list)
    data_flow: List[str] = Field(default_factory=list)
    scaling_approach: str = ""
    observability: List[str] = Field(default_factory=list)
    security: List[str] = Field(default_factory=list)
    tradeoffs: Tradeoffs = Field(default_factory=Tradeoffs)
    estimated_monthly_cost: Optional[str] = None
    mermaid_diagram: Optional[str] = None           # raw graph TD string


class DesignOutput(BaseModel):
    architectures: List[Architecture]
# ─────────────────────────────────────────
# ARCHIESTATE — the LangGraph state object
# ─────────────────────────────────────────

class ArchieState(TypedDict):
    """
    Single object that flows through the entire LangGraph pipeline.
    Each agent receives it, reads what it needs, and returns a partial
    dict — LangGraph merges the update back into this state.
    """

    # Set by the user before the pipeline starts
    user_input: str

    # Filled by Requirements Agent (Agent 1)
    constraints: Optional[Constraints]

    #Filled by Design agent which gives 3 options
    architectures: Optional[List[dict]]

    # Updated by each agent as it runs — useful for frontend status display
    current_agent: str

    # Set if any agent fails— graph can route to an error handler
    error: Optional[str]