import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface KPIResponse {
  total_revenue: number;
  total_profit: number;
  avg_margin_pct: number;
  avg_discount_pct: number;
  transactions_analyzed: number;
}

export interface SimulationResult {
  category: string;
  proposed_discount_pct: number;
  estimated_marginal_elasticity: number;
  expected_sales_units: number;
  projected_revenue: number;
  projected_profit: number;
  confidence_interval_95: [number, number];
}

export interface OptimizationResult {
  status: string;
  solver: string;
  total_budget_allocated: number;
  projected_profit_gain: number;
  optimal_allocations: Record<string, number>;
}

export interface DecisionAuditRecord {
  decision_id: string;
  timestamp: string;
  category_target: string;
  chosen_action: Record<string, any>;
  predicted_lift: number;
  confidence_bounds: [number, number];
  status: string;
}

@Injectable({ providedIn: 'root' })
export class DecisionService {
  private http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:8000/api/v1/decisions';

  getKPIs(): Observable<KPIResponse> {
    return this.http.get<KPIResponse>(`${this.baseUrl}/kpis`);
  }

  simulateCounterfactual(payload: {
    category: string;
    proposed_discount_pct: number;
    planned_ad_spend: number;
  }): Observable<SimulationResult> {
    return this.http.post<SimulationResult>(`${this.baseUrl}/simulate`, payload);
  }

  runOptimization(payload: {
    total_budget: number;
    max_discount_cap: number;
  }): Observable<OptimizationResult> {
    return this.http.post<OptimizationResult>(`${this.baseUrl}/optimize`, payload);
  }

  commitDecision(record: DecisionAuditRecord): Observable<{ status: string; decision_id: string }> {
    return this.http.post<{ status: string; decision_id: string }>(`${this.baseUrl}/governance/commit`, record);
  }

  getAuditLedger(): Observable<DecisionAuditRecord[]> {
    return this.http.get<DecisionAuditRecord[]>(`${this.baseUrl}/governance/ledger`);
  }
}
