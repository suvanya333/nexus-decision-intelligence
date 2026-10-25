"""
Prescriptive Optimization Engine powered by the FOSS HiGHS Solver via scipy.optimize.milp.
Prescribes mathematically optimal markdown policies under budget and operational bounds.
"""

from typing import Dict, List, Any
import numpy as np
from scipy.optimize import milp, LinearConstraint, Bounds


class PrescriptiveOptimizer:
    """
    Solves:
      Maximize: Sum( profit_coefficient_i * discount_i )
      Subject to:
        Sum( cost_weight_i * discount_i ) <= total_budget
        0.0 <= discount_i <= max_discount_cap
    """

    @staticmethod
    def solve_markdown_allocation(
        categories: List[Dict[str, Any]],
        total_budget: float,
        max_discount_cap: float = 0.25,
    ) -> Dict[str, Any]:
        n = len(categories)
        if n == 0:
            return {"status": "NO_CATEGORIES", "allocations": {}, "projected_profit_gain": 0.0}

        # HiGHS minimizes c^T * x. To maximize, negate profit contributions.
        c = np.array([
            -float(cat['avg_units'] * (cat['base_price'] - cat['unit_cost']) * 0.8)
            for cat in categories
        ])

        # Budget constraint
        budget_weights = np.array([
            float(cat['inventory_skus'] * cat['base_price'] * 0.05)
            for cat in categories
        ])
        constraints = LinearConstraint(A=[budget_weights], lb=[0], ub=[total_budget])

        # Discount bounds per category
        bounds = Bounds(lb=np.zeros(n), ub=np.full(n, max_discount_cap))

        # Solve with open-source HiGHS MIP solver
        res = milp(c=c, constraints=constraints, bounds=bounds)

        if not res.success:
            return {
                "status": "INFEASIBLE",
                "message": res.status_message,
                "allocations": {},
                "projected_profit_gain": 0.0,
            }

        allocations = {
            categories[i]['category']: round(float(res.x[i]), 3)
            for i in range(n)
        }
        budget_allocated = float(np.sum(res.x * budget_weights))

        return {
            "status": "OPTIMAL",
            "solver": "HiGHS (FOSS Mixed-Integer Linear Programming)",
            "total_budget_allocated": round(budget_allocated, 2),
            "projected_profit_gain": round(float(-res.fun), 2),
            "optimal_allocations": allocations,
        }
