from datetime import datetime
import os
from typing import List
import duckdb
from fastapi import APIRouter, HTTPException

from app.schemas.decision_schemas import (
    SimulationRequest,
    SimulationResponse,
    OptimizationRequest,
    OptimizationResponse,
    DecisionAuditRecord,
)
from app.engines.causal_engine import CausalEngine
from app.engines.optimizer_engine import PrescriptiveOptimizer

router = APIRouter(prefix="/api/v1/decisions", tags=["Decision Intelligence"])

# Base data directory lookup
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
PARQUET_FILE = os.path.join(DATA_DIR, "retail_metrics.parquet").replace("\\", "/")

# In-memory governance ledger
DECISION_LEDGER: List[DecisionAuditRecord] = []


def ensure_dataset_exists():
    """Fallback check if dataset is generated; raises helpful hint if missing."""
    if not os.path.exists(PARQUET_FILE):
        raise HTTPException(
            status_code=503,
            detail=(
                "Analytical Parquet dataset not found. Run "
                "'python scripts/generate_synthetic_data.py --rows 100000' inside backend/ first."
            ),
        )


@router.get("/kpis")
def get_executive_kpis():
    """Ultra-fast OLAP summary directly from DuckDB Parquet storage."""
    ensure_dataset_exists()
    query = f"""
        SELECT 
            ROUND(SUM(gross_revenue), 2) as total_revenue,
            ROUND(SUM(net_profit), 2) as total_profit,
            ROUND(AVG(margin_pct), 2) as avg_margin_pct,
            ROUND(AVG(discount_pct) * 100, 2) as avg_discount_pct,
            COUNT(*) as transactions_analyzed
        FROM read_parquet('{PARQUET_FILE}')
    """
    df = duckdb.query(query).to_df()
    return df.to_dict(orient="records")[0]


@router.post("/simulate", response_model=SimulationResponse)
def simulate_counterfactual(req: SimulationRequest):
    """
    Simulates counterfactual revenue & profit using Double Machine Learning principles.
    Controls for competitor pricing and seasonal confounders.
    """
    ensure_dataset_exists()
    query = f"""
        SELECT base_price, unit_cost, discount_pct, competitor_price_ratio, 
               seasonality_index, ad_spend, units_sold
        FROM read_parquet('{PARQUET_FILE}')
        WHERE category = '{req.category}'
        LIMIT 25000
    """
    df = duckdb.query(query).to_df()
    if df.empty:
        raise HTTPException(status_code=404, detail=f"Category '{req.category}' not found")

    base_price = float(df['base_price'].iloc[0])
    unit_cost = float(df['unit_cost'].iloc[0])

    result = CausalEngine.estimate_elasticity_and_counterfactual(
        df=df,
        base_price=base_price,
        unit_cost=unit_cost,
        proposed_discount=req.proposed_discount_pct,
        planned_ad_spend=req.planned_ad_spend,
    )

    return SimulationResponse(
        category=req.category,
        proposed_discount_pct=req.proposed_discount_pct,
        estimated_marginal_elasticity=result["causal_elasticity"],
        expected_sales_units=result["expected_units"],
        projected_revenue=result["projected_revenue"],
        projected_profit=result["projected_profit"],
        confidence_interval_95=result["confidence_interval_95"],
    )


@router.post("/optimize", response_model=OptimizationResponse)
def solve_prescriptive_markdown(req: OptimizationRequest):
    """
    Executes Mixed-Integer Linear Programming via open-source HiGHS solver.
    Prescribes optimal discount policy across all categories under a hard budget cap.
    """
    ensure_dataset_exists()
    query = f"""
        SELECT 
            category,
            AVG(base_price) as base_price,
            AVG(unit_cost) as unit_cost,
            AVG(units_sold) as avg_units,
            COUNT(*) as inventory_skus
        FROM read_parquet('{PARQUET_FILE}')
        GROUP BY category
        ORDER BY category ASC
    """
    cats = duckdb.query(query).to_df().to_dict(orient="records")

    res = PrescriptiveOptimizer.solve_markdown_allocation(
        categories=cats,
        total_budget=req.total_budget,
        max_discount_cap=req.max_discount_cap,
    )

    if res.get("status") == "INFEASIBLE":
        raise HTTPException(status_code=400, detail="Optimization problem infeasible with given parameters")

    return OptimizationResponse(
        status=res["status"],
        solver=res["solver"],
        total_budget_allocated=res["total_budget_allocated"],
        projected_profit_gain=res["projected_profit_gain"],
        optimal_allocations=res["optimal_allocations"],
    )


@router.post("/governance/commit")
def commit_decision_to_ledger(record: DecisionAuditRecord):
    """Governance feedback loop: Audits decisions to evaluate drift against future actuals."""
    DECISION_LEDGER.insert(0, record)
    return {"status": "RECORDED", "decision_id": record.decision_id}


@router.get("/governance/ledger", response_model=List[DecisionAuditRecord])
def get_governance_ledger():
    """Retrieve decision audit trail for drift tracking."""
    return DECISION_LEDGER
