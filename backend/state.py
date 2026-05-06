from pydantic import BaseModel, Field
from typing import Optional, List
from typing_extensions import TypedDict
from enum import Enum

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

# ─────────────────────────────────────────
# PYDANTIC MODELS — validate agent outputs
# ─────────────────────────────────────────

class Constraints(BaseModel):
    """
    Output of Requirements Agent.
    Extracted from the user's plain English description.
    """
    scale: Optional[str] = None        # "100k orders/day"
    budget: Optional[str] = None       # "$3k/month"
    team_size: Optional[int] = None    # 4
    stack: List[str] = []              # ["Node.js", "PostgreSQL"]
    compliance: List[str] = []         # ["GDPR", "SOC2"]
    latency_sla: Optional[str] = None  # "200ms p99"
    traffic_pattern: Optional[TrafficPattern] = None
    experience_level: Optional[ExperienceLevel] = None


"""class Architecture(BaseModel):
    
    #One architecture option. Design Agent produces 3 of these.
    
    name: str                          # "MVP", "Production", "Future Scale"
    components: List[str] = []         # ["API Gateway", "PostgreSQL", "Redis"]
    data_flow: List[str] = []          # ["User → API → DB", "API → Cache"]
    tradeoffs: List[str] = []          # ["Simple to deploy", "Not horizontally scalable"]
    mermaid_diagram_src: Optional[str] = None  # raw Mermaid diagram string


class TechDecision(BaseModel):
    
    #One technology fork decision. Tech Decision Agent produces one per fork.
    
    fork: str                          # "Message Queue: Kafka vs RabbitMQ"
    options: List[str] = []            # ["Kafka", "RabbitMQ"]
    winner: str                        # "RabbitMQ"
    justification: str                 # "Given $3k budget and team of 4, RabbitMQ..."
    scores: Optional[dict] = None      # { "Kafka": 6, "RabbitMQ": 8 }


class CostEstimate(BaseModel):
    
    #Cost breakdown for one architecture option.
    #Cost Estimation Agent produces one per architecture.
    
    name: str                          # "MVP Architecture"
    current_cost: str                  # "$1,240/month"
    scaled_cost: str                   # "$8,700/month"
    breakdown: List[str] = []          # ["EC2: $400", "RDS: $300", "S3: $40"]
    cost_cliff: Optional[str] = None   # "NAT Gateway egress spikes at 10x"""


# ─────────────────────────────────────────
# ARCHIESTATE — the LangGraph state object
# ─────────────────────────────────────────

class ArchieState(TypedDict):
    """
    The single object that flows through the entire LangGraph pipeline.
    Every agent receives this, reads what it needs, and returns
    an updated version with its own output added.
    """

    # Set by the user before the pipeline starts
    user_input: str

    # Filled by Requirements Agent (Agent 1)
    constraints: Optional[Constraints]

    """# Filled by Design Agent (Agent 2)
    architectures: Optional[List[dict]]

    # Filled by Tech Decision Agent (Agent 3)
    tech_decisions: Optional[List[dict]]

    # Filled by Cost Estimation Agent (Agent 4)
    cost_estimates: Optional[List[dict]]

    # Filled by ADR Agent (Agent 5)
    adrs: Optional[List[str]]"""

    # Updated by each agent as it runs — useful for frontend status display
    current_agent: str

    # Set if any agent fails
    error: Optional[str]