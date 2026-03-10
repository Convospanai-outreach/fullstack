from enum import Enum, auto
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field, constr
import uuid
from datetime import datetime

# ==============================================================================
# 1. ORCHESTRATION STATE MACHINE
# Strict deterministic state flow logic for the ConvoSpan Engine
# ==============================================================================

class OrchestratorState(Enum):
    INIT = auto()
    LOAD_BASELINE = auto()
    GENERATE_PLAYBOOK = auto()
    VALIDATE = auto()
    DEPLOY = auto()
    MONITOR = auto()
    EVALUATE = auto()
    DRIFT_DETECTED = auto()
    CRITIQUE = auto()
    REFINE = auto()
    REVALIDATE = auto()
    REDEPLOY = auto()

class StateMachine:
    """
    Deterministic State Machine for Playbook Lifecycle.
    Agents never trigger each other directly; the Orchestrator manages transitions
    and dispatches tasks to the Redis queue based on the current state.
    """
    
    # Define valid transitions to enforce strict flow
    TRANSITIONS = {
        OrchestratorState.INIT: [OrchestratorState.LOAD_BASELINE],
        OrchestratorState.LOAD_BASELINE: [OrchestratorState.GENERATE_PLAYBOOK],
        OrchestratorState.GENERATE_PLAYBOOK: [OrchestratorState.VALIDATE],
        
        # Validation branches
        OrchestratorState.VALIDATE: [OrchestratorState.DEPLOY, OrchestratorState.CRITIQUE],
        
        OrchestratorState.DEPLOY: [OrchestratorState.MONITOR],
        OrchestratorState.MONITOR: [OrchestratorState.EVALUATE],
        
        # Evaluation branches
        OrchestratorState.EVALUATE: [OrchestratorState.MONITOR, OrchestratorState.DRIFT_DETECTED],
        
        # Drift handling loop
        OrchestratorState.DRIFT_DETECTED: [OrchestratorState.CRITIQUE],
        OrchestratorState.CRITIQUE: [OrchestratorState.REFINE],
        OrchestratorState.REFINE: [OrchestratorState.REVALIDATE],
        
        # Revalidation branches
        OrchestratorState.REVALIDATE: [OrchestratorState.REDEPLOY, OrchestratorState.CRITIQUE],
        
        OrchestratorState.REDEPLOY: [OrchestratorState.MONITOR],
    }

    def __init__(self, tenant_id: str, campaign_id: str):
        self.tenant_id = tenant_id
        self.campaign_id = campaign_id
        self.current_state = OrchestratorState.INIT
        self.history: List[Dict[str, Any]] = []

    def transition_to(self, new_state: OrchestratorState, context: Dict[str, Any]) -> bool:
        """
        Attempt a state transition. Returns True if successful, raises ValueError if invalid.
        """
        valid_next_states = self.TRANSITIONS.get(self.current_state, [])
        
        if new_state not in valid_next_states:
            raise ValueError(
                f"Invalid transition from {self.current_state.name} to {new_state.name}. "
                f"Allowed states: {[s.name for s in valid_next_states]}"
            )
            
        # Record transition
        self.history.append({
            "from": self.current_state.name,
            "to": new_state.name,
            "timestamp": datetime.utcnow().isoformat(),
            "context_summary": {k: type(v).__name__ for k, v in context.items()}
        })
        
        self.current_state = new_state
        return True

    def get_required_agent_capability(self) -> Optional[str]:
        """Maps current state to the required agent capability for the task queue."""
        capability_map = {
            OrchestratorState.GENERATE_PLAYBOOK: "playbook_generation",
            OrchestratorState.VALIDATE: "principle_guard",
            OrchestratorState.REVALIDATE: "principle_guard",
            OrchestratorState.EVALUATE: "drift_detection",
            OrchestratorState.CRITIQUE: "self_critique",
            OrchestratorState.REFINE: "playbook_refinement"
        }
        return capability_map.get(self.current_state)


# ==============================================================================
# 2. AGENT JSON CONTRACTS (Pydantic Models)
# Strict I/O schemas ensuring agents never return prose, only valid JSON.
# ==============================================================================

class BaseContract:
    """All models enforce strict assignment."""
    class Config:
        validate_assignment = True
        extra = "forbid"


# --- Playbook Generator Agent ---

class PlaybookStep(BaseModel, BaseContract):
    step_id: str = Field(pattern=r'^step_[a-zA-Z0-9]+$')
    action_type: str = Field(pattern=r'^(email|linkedin_message|call_script|wait)$')
    content_template: str = Field(..., description="Template string with variables like {{first_name}}")
    wait_duration_hours: Optional[int] = Field(None, ge=0)
    expected_outcome: str

class PlaybookGeneratorInput(BaseModel, BaseContract):
    tenant_id: uuid.UUID
    vertical: str
    target_audience_summary: str
    campaign_goal: str
    historical_top_performers_ids: List[str] = []

class PlaybookGeneratorOutput(BaseModel, BaseContract):
    playbook_id: uuid.UUID
    name: str
    steps: List[PlaybookStep] = Field(..., min_items=1)
    estimated_conversion_rate: float = Field(..., ge=0.0, le=1.0)
    reasoning_hash: str = Field(..., description="Hash of internal CoT reasoning")


# --- Principle Guardian Agent (Validation) ---

class Violation(BaseModel, BaseContract):
    rule_id: str
    severity: str = Field(pattern=r'^(low|medium|high|critical)$')
    step_id: Optional[str] = None
    description: str

class PrincipleGuardianInput(BaseModel, BaseContract):
    tenant_id: uuid.UUID
    playbook: PlaybookGeneratorOutput
    vertical_compliance_policy_id: str

class PrincipleGuardianOutput(BaseModel, BaseContract):
    is_approved: bool
    violations: List[Violation]
    risk_score: int = Field(..., ge=0, le=100)
    approved_at: Optional[datetime] = None


# --- Drift Detector Agent ---

class MetricSnapshot(BaseModel, BaseContract):
    metric_name: str
    expected_value: float
    actual_value: float
    variance_percentage: float

class DriftDetectorInput(BaseModel, BaseContract):
    tenant_id: uuid.UUID
    campaign_id: uuid.UUID
    lookback_window_hours: int
    performance_snapshots: List[MetricSnapshot]

class DriftDetectorOutput(BaseModel, BaseContract):
    drift_detected: bool
    severity: Optional[str] = Field(None, pattern=r'^(low|medium|high|critical)$')
    drifted_metrics: List[str]
    root_cause_hypothesis_hash: Optional[str] = None


# --- Self-Critic Agent ---

class CritiquePoint(BaseModel, BaseContract):
    target_step_id: str
    issue_type: str = Field(pattern=r'^(tone|compliance|engagement_drop|hallucination)$')
    suggested_fix: str

class SelfCriticInput(BaseModel, BaseContract):
    tenant_id: uuid.UUID
    failed_playbook: PlaybookGeneratorOutput
    drift_report: Optional[DriftDetectorOutput] = None
    validation_failures: Optional[PrincipleGuardianOutput] = None

class SelfCriticOutput(BaseModel, BaseContract):
    critique_id: uuid.UUID
    actionable_critiques: List[CritiquePoint]
    architecture_flaw_detected: bool = Field(False, description="True if the playbook structure itself is flawed, not just step content")
