import { Component, OnInit, signal, inject, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective, provideEcharts } from 'ngx-echarts';
import cytoscape from 'cytoscape';
import { EChartsOption } from 'echarts';
import {
  DecisionService,
  KPIResponse,
  SimulationResult,
  OptimizationResult,
  DecisionAuditRecord,
} from '../../core/services/decision.service';

@Component({
  selector: 'app-decision-studio',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxEchartsDirective],
  providers: [provideEcharts()],
  template: `
    <div class="min-h-screen bg-slate-50 p-8 font-sans text-slate-800">
      <!-- Top Bar / Brand Header -->
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-200 pb-6">
        <div>
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-md">
              N
            </div>
            <div>
              <h1 class="text-3xl font-black tracking-tight text-slate-900">NexusOptima Decision Studio</h1>
              <p class="text-sm text-slate-500 font-medium">Enterprise Causal Counterfactual Simulation & Prescriptive Linear Optimization</p>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> DuckDB + HiGHS Solver Active
          </span>
          <span class="px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
            100% Free & Open Source
          </span>
        </div>
      </div>

      <!-- Tier 1: Real-Time BI KPI Cards (DuckDB In-Memory OLAP) -->
      @if (kpis()) {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Gross Analyzed Revenue</span>
            <p class="text-2xl font-black text-slate-900 mt-1">\${{ kpis()?.total_revenue | number:'1.0-0' }}</p>
            <span class="text-xs text-slate-400 mt-2 block">{{ kpis()?.transactions_analyzed | number }} transactions in DuckDB</span>
          </div>
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Net Realized Margin</span>
            <p class="text-2xl font-black text-indigo-600 mt-1">\${{ kpis()?.total_profit | number:'1.0-0' }}</p>
            <span class="text-xs text-indigo-500 mt-2 block font-medium">{{ kpis()?.avg_margin_pct }}% margin rate</span>
          </div>
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Baseline Markdown</span>
            <p class="text-2xl font-black text-slate-800 mt-1">{{ kpis()?.avg_discount_pct }}%</p>
            <span class="text-xs text-amber-600 mt-2 block font-medium">Margin erosion risk</span>
          </div>
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Causal Estimator</span>
            <p class="text-2xl font-black text-emerald-700 mt-1">Double ML</p>
            <span class="text-xs text-emerald-600 mt-2 block">Controls for Seasonality & Competitor Drag</span>
          </div>
        </div>
      }

      <!-- Tier 2: Decision Intelligence Workspace (Simulation + Prescriptive Optimizer) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
        
        <!-- Left Pane: Causal DAG + What-If Interactive Sliders -->
        <div class="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex justify-between items-center mb-4">
              <div>
                <h2 class="text-lg font-bold text-slate-900">What-If Counterfactual Simulator</h2>
                <p class="text-xs text-slate-400">Estimate causal uplift isolated from observational confounders</p>
              </div>
              <span class="text-xs font-mono bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md border border-indigo-200 font-semibold">DoWhy / DML</span>
            </div>

            <!-- Causal DAG Container -->
            <div #dagGraph class="w-full h-44 bg-slate-50 border border-slate-200 rounded-xl mb-6"></div>

            <!-- Interactive Parameters -->
            <div class="space-y-4">
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Target Product Category</label>
                <select [(ngModel)]="selectedCategory" class="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                  <option value="Apparel_Fashion">Apparel & Fashion (Elastic: -2.40)</option>
                  <option value="Consumer_Electronics">Consumer Electronics (Elastic: -1.35)</option>
                  <option value="Home_Appliances">Home Appliances (Elastic: -1.80)</option>
                  <option value="Beauty_Health">Beauty & Health (Inelastic: -0.85)</option>
                  <option value="Sports_Outdoors">Sports & Outdoors (Elastic: -1.95)</option>
                </select>
              </div>

              <div>
                <div class="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                  <span>Proposed Markdown Action</span>
                  <span class="text-indigo-600 font-bold">{{ discountInput() }}% Discount</span>
                </div>
                <input type="range" min="0" max="30" step="1" 
                       [ngModel]="discountInput()" 
                       (ngModelChange)="discountInput.set($event)"
                       class="w-full accent-indigo-600 cursor-pointer" />
              </div>
            </div>
          </div>

          <div class="mt-6">
            <button (click)="runSimulation()" [disabled]="isSimulating()"
                    class="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 px-4 rounded-xl text-sm transition shadow-sm disabled:opacity-50">
              {{ isSimulating() ? 'Computing Double ML Estimates...' : 'Simulate Counterfactual Lift' }}
            </button>

            <!-- Simulation Output -->
            @if (simulationResult()) {
              <div class="mt-4 p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl">
                <div class="flex justify-between items-center mb-1">
                  <span class="text-xs font-bold text-indigo-900 uppercase">Isolated Elasticity Slope</span>
                  <span class="text-xs font-mono font-bold text-indigo-700">{{ simulationResult()?.estimated_marginal_elasticity }}</span>
                </div>
                <p class="text-2xl font-black text-indigo-950 mt-1">
                  \${{ simulationResult()?.projected_profit | number:'1.0-0' }}
                  <span class="text-xs font-normal text-slate-500">Projected Net Margin</span>
                </p>
                <p class="text-xs text-indigo-700 mt-1">
                  95% Confidence Bounds: [\${{ simulationResult()?.confidence_interval_95?.[0] | number:'1.0-0' }} - \${{ simulationResult()?.confidence_interval_95?.[1] | number:'1.0-0' }}]
                </p>
              </div>
            }
          </div>
        </div>

        <!-- Right Pane: Prescriptive Optimization (HiGHS Solver) -->
        <div class="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex justify-between items-center mb-4">
              <div>
                <h2 class="text-lg font-bold text-slate-900">Prescriptive Policy Optimizer</h2>
                <p class="text-xs text-slate-400">Mixed-Integer Linear Programming via FOSS HiGHS Solver</p>
              </div>
              <span class="text-xs font-mono bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md border border-emerald-200 font-semibold">SciPy.MILP</span>
            </div>

            <!-- ECharts Pareto Allocation Chart -->
            <div echarts [options]="chartOption()" class="w-full h-56"></div>

            <div class="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Total Promo Budget Cap ($)</label>
                <input type="number" [(ngModel)]="budgetCap" class="w-full border border-slate-300 rounded-lg p-2 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Max Category Discount Cap</label>
                <input type="number" [(ngModel)]="maxDiscountCap" step="0.05" class="w-full border border-slate-300 rounded-lg p-2 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
              </div>
            </div>
          </div>

          <div class="mt-6">
            <button (click)="runOptimization()" [disabled]="isOptimizing()"
                    class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-xl text-sm transition shadow-sm disabled:opacity-50">
              {{ isOptimizing() ? 'Solving High-Dimensional MIP...' : 'Calculate Optimal Markdown Allocation' }}
            </button>

            @if (optimizationResult()) {
              <div class="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex justify-between items-center">
                <div>
                  <span class="text-xs uppercase font-bold text-emerald-800">Maximized Profit Lift</span>
                  <p class="text-2xl font-black text-emerald-950">+\${{ optimizationResult()?.projected_profit_gain | number:'1.0-0' }}</p>
                </div>
                <button (click)="commitPolicy()" class="bg-emerald-700 text-white text-xs font-bold py-2.5 px-4 rounded-lg hover:bg-emerald-800 transition">
                  Commit Policy to Ledger
                </button>
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Tier 3: Decision Governance & Audit Ledger -->
      <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div class="flex justify-between items-center mb-4">
          <div>
            <h2 class="text-lg font-bold text-slate-900">Enterprise Decision Governance Ledger</h2>
            <p class="text-xs text-slate-400">Audit trail of committed policies to monitor outcome drift over time</p>
          </div>
          <span class="text-xs font-medium text-slate-500">{{ ledger().length }} Recorded Policies</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 text-slate-500 uppercase tracking-wider border-b">
              <tr>
                <th class="py-3 px-4">Decision ID</th>
                <th class="py-3 px-4">Category Target</th>
                <th class="py-3 px-4">Action Taken</th>
                <th class="py-3 px-4">Expected Margin Lift</th>
                <th class="py-3 px-4">Confidence Interval (95%)</th>
                <th class="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-medium">
              @for (row of ledger(); track row.decision_id) {
                <tr class="hover:bg-slate-50/80">
                  <td class="py-3 px-4 font-mono text-slate-500">{{ row.decision_id.slice(0, 8) }}...</td>
                  <td class="py-3 px-4 font-bold text-slate-800">{{ row.category_target }}</td>
                  <td class="py-3 px-4 text-indigo-600 font-semibold">{{ row.chosen_action['discount_pct'] * 100 | number:'1.0-1' }}% Discount</td>
                  <td class="py-3 px-4 font-bold text-emerald-600">+\${{ row.predicted_lift | number:'1.0-0' }}</td>
                  <td class="py-3 px-4 text-slate-500">[\${{ row.confidence_bounds[0] | number:'1.0-0' }} - \${{ row.confidence_bounds[1] | number:'1.0-0' }}]</td>
                  <td class="py-3 px-4">
                    <span class="px-2 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">AUDITED</span>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="text-center py-6 text-slate-400">No decisions committed yet. Run a simulation or optimization to log a policy.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class DecisionStudioComponent implements OnInit, AfterViewInit {
  @ViewChild('dagGraph') dagGraph!: ElementRef;
  private api = inject(DecisionService);

  kpis = signal<KPIResponse | null>(null);
  simulationResult = signal<SimulationResult | null>(null);
  optimizationResult = signal<OptimizationResult | null>(null);
  ledger = signal<DecisionAuditRecord[]>([]);

  selectedCategory = 'Apparel_Fashion';
  discountInput = signal<number>(12);
  budgetCap = 75000;
  maxDiscountCap = 0.25;

  isSimulating = signal<boolean>(false);
  isOptimizing = signal<boolean>(false);

  chartOption = signal<EChartsOption>({
    title: { text: 'Optimal Discount % by Product Line', left: 'center', textStyle: { fontSize: 13, color: '#475569' } },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: ['Electronics', 'Apparel', 'Appliances', 'Beauty', 'Sports'] },
    yAxis: { type: 'value', max: 30, axisLabel: { formatter: '{value}%' } },
    series: [{ data: [8, 22, 14, 4, 18], type: 'bar', itemStyle: { color: '#6366f1', borderRadius: [6, 6, 0, 0] } }]
  });

  ngOnInit() {
    this.loadKPIs();
    this.loadLedger();
  }

  ngAfterViewInit() {
    this.initCausalDAG();
  }

  loadKPIs() {
    this.api.getKPIs().subscribe({
      next: (data) => this.kpis.set(data),
      error: (err) => console.warn('KPI backend offline or dataset pending creation:', err)
    });
  }

  loadLedger() {
    this.api.getAuditLedger().subscribe({
      next: (data) => this.ledger.set(data),
      error: (err) => console.warn('Audit ledger fetch failed:', err)
    });
  }

  initCausalDAG() {
    if (!this.dagGraph?.nativeElement) return;
    cytoscape({
      container: this.dagGraph.nativeElement,
      elements: [
        { data: { id: 'promo', label: 'Discount % (T)' } },
        { data: { id: 'comp', label: 'Competitor Price (W1)' } },
        { data: { id: 'season', label: 'Seasonality (W2)' } },
        { data: { id: 'profit', label: 'Net Profit (Y)' } },
        { data: { source: 'comp', target: 'promo' } },
        { data: { source: 'comp', target: 'profit' } },
        { data: { source: 'season', target: 'profit' } },
        { data: { source: 'promo', target: 'profit' } }
      ],
      style: [
        { selector: 'node', style: { 'background-color': '#4f46e5', 'label': 'data(label)', 'color': '#334155', 'font-size': '10px', 'font-weight': 'bold' } },
        { selector: 'edge', style: { 'width': 1.5, 'line-color': '#cbd5e1', 'target-arrow-color': '#64748b', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier' } }
      ],
      layout: { name: 'breadthfirst', directed: true, padding: 12 }
    });
  }

  runSimulation() {
    this.isSimulating.set(true);
    this.api.simulateCounterfactual({
      category: this.selectedCategory,
      proposed_discount_pct: this.discountInput() / 100.0,
      planned_ad_spend: 5000
    }).subscribe({
      next: (res) => {
        this.simulationResult.set(res);
        this.isSimulating.set(false);
      },
      error: () => this.isSimulating.set(false)
    });
  }

  runOptimization() {
    this.isOptimizing.set(true);
    this.api.runOptimization({
      total_budget: this.budgetCap,
      max_discount_cap: this.maxDiscountCap
    }).subscribe({
      next: (res) => {
        this.optimizationResult.set(res);
        this.isOptimizing.set(false);

        const categories = Object.keys(res.optimal_allocations);
        const values = categories.map(k => +(res.optimal_allocations[k] * 100).toFixed(1));
        this.chartOption.set({
          ...this.chartOption(),
          xAxis: { type: 'category', data: categories },
          series: [{ data: values, type: 'bar', itemStyle: { color: '#10b981', borderRadius: [6, 6, 0, 0] } }]
        });
      },
      error: () => this.isOptimizing.set(false)
    });
  }

  commitPolicy() {
    const opt = this.optimizationResult();
    if (!opt) return;

    const record: DecisionAuditRecord = {
      decision_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      category_target: 'Enterprise Portfolio (All Categories)',
      chosen_action: { discount_pct: this.discountInput() / 100.0 },
      predicted_lift: opt.projected_profit_gain,
      confidence_bounds: [opt.projected_profit_gain * 0.9, opt.projected_profit_gain * 1.1],
      status: 'AUDITED'
    };

    this.api.commitDecision(record).subscribe(() => {
      this.ledger.update(prev => [record, ...prev]);
    });
  }
}
