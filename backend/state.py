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


# ── Clarification models ──────────────────────────────────────────────────────
 
class QuestionOption(BaseModel):
    """A single clickable option for a clarification question."""
    label: str           # display text on the chip
    value: str           # value stored in constraints
    emoji: Optional[str] = None
 
 
class ClarificationQuestion(BaseModel):
    """One targeted question the Requirements Agent wants answered."""
    id: str                          # unique ID, e.g. "scale"
    field: str                       # which Constraints field this maps to
    question: str                    # the question text shown to user
    options: List[QuestionOption]    # clickable chip options
    allow_freetext: bool = True      # whether user can type a custom answer
    hint: Optional[str] = None       # e.g. "This affects queue and caching strategy"
 
 
class FieldConfidence(BaseModel):
    """Confidence score for a single extracted field."""
    field: str
    value: Optional[str]             # what was extracted (stringified)
    confidence: float                # 0.0 - 1.0
    inferred: bool = False           # True if inferred vs explicitly stated
 
 
class ExtractionResult(BaseModel):
    """Full output of the first-pass requirements extraction."""
    constraints: dict                           # raw dict matching Constraints schema
    field_confidence: List[FieldConfidence]
    overall_confidence: float
    questions: List[ClarificationQuestion]      # [] if confidence is high enough
    assumptions: List[str]                      # human-readable list of inferred things

# ─────────────────────────────────────────
# PYDANTIC MODELS — validate agent outputs
# ─────────────────────────────────────────

class Constraints(BaseModel):

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

class TechDecision(BaseModel):

    category: str
    chosen: str
    score: int                                        
    justification: str
    alternatives: List[str] = Field(default_factory=list)
    when_to_switch: str = ""


class TierDecisions(BaseModel):
    
    tier: str
    decisions: List[TechDecision] = Field(default_factory=list)
    overall_recommendation: str = ""
    risk_flags: List[str] = Field(default_factory=list)


class TechDecisionsOutput(BaseModel):
    tech_decisions: List[TierDecisions]
# ─────────────────────────────────────────
# ARCHIESTATE — the LangGraph state object
# ─────────────────────────────────────────

class ArchieState(TypedDict):
    """
    Single object that flows through the entire LangGraph pipeline.
    Each agent receives it, reads what it needs, and returns a partial
    dict — LangGraph merges the update back into this state.
    """



    # Clarification state — populated during interactive requirement gathering
    
    clarification_questions: Optional[List[dict]]   # List[ClarificationQuestion]
    clarification_answers: Optional[dict]           # {question_id: answer_value}
    assumptions: Optional[List[str]]                # inferred assumptions shown to user
    overall_confidence: Optional[float]
    
    # Set by the user before the pipeline starts
    user_input: str

    # Filled by Requirements Agent (Agent 1)
    constraints: Optional[Constraints]

    #Filled by Design agent which gives 3 options
    architectures: Optional[List[dict]]

    #Filled by Tech Decision Agent 
    tech_decisions: Optional[List[dict]]

    # Updated by each agent as it runs — useful for frontend status display
    current_agent: str

    # Set if any agent fails— graph can route to an error handler
    error: Optional[str]