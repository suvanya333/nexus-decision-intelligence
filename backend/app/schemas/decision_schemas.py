from datetime import datetime
from typing import Dict, List
from pydantic import BaseModel, Field


class SimulationRequest(BaseModel):
    category: str = Field(..., description="Target product category", example="Apparel_Fashion")
    proposed_discount_pct: float = Field(..., ge=0.0, le=0.35, description="Proposed discount percentage (0 to 0.35)", example=0.15)
    planned_ad_spend: float = Field(default=5000.0, ge=0.0, description="Planned advertising budget", example=5000.0)


class SimulationResponse(BaseModel):
    category: str
    proposed_discount_pct: float
    estimated_marginal_elasticity: float
    expected_sales_units: int
    projected_revenue: float
    projected_profit: float
    confidence_interval_95: List[float]


class OptimizationRequest(BaseModel):
    total_budget: float = Field(..., ge=1000.0, description="Total markdown/promo budget ceiling", example=50000.0)
    max_discount_cap: float = Field(default=0.25, ge=0.05, le=0.40, description="Maximum discount allowable per product line", example=0.25)


class OptimizationResponse(BaseModel):
    status: str
    solver: str
    total_budget_allocated: float
    projected_profit_gain: float
    optimal_allocations: Dict[str, float]


class DecisionAuditRecord(BaseModel):
    decision_id: str
    timestamp: datetime
    category_target: str
    chosen_action: Dict[str, float]
    predicted_lift: float
    confidence_bounds: List[float]
    status: str = "COMMITTED"
