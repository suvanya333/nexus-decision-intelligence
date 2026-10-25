"""
Enterprise Retail Data Generating Process (DGP) for Decision Intelligence.
Simulates observational retail transaction data with known structural causal ground truths.
Stack: 100% Open-Source (Polars, NumPy, PyArrow) - Zero Paid Dependencies.
"""

import argparse
import os
import numpy as np
import polars as pl

# Category archetypes: Base Price, Unit Cost, True Causal Price Elasticity
CATEGORY_CONFIG = {
    "Consumer_Electronics": {"base_price": 450.0, "unit_cost": 310.0, "true_elasticity": -1.35},
    "Apparel_Fashion":     {"base_price": 65.0,  "unit_cost": 22.0,  "true_elasticity": -2.40},
    "Home_Appliances":     {"base_price": 220.0, "unit_cost": 140.0, "true_elasticity": -1.80},
    "Beauty_Health":       {"base_price": 38.0,  "unit_cost": 12.0,  "true_elasticity": -0.85},
    "Sports_Outdoors":     {"base_price": 110.0, "unit_cost": 68.0,  "true_elasticity": -1.95},
}

STORE_TIERS = ["Flagship_Urban", "Suburban_Mall", "Regional_Outlet"]


def generate_causal_retail_data(n_records: int = 500_000, seed: int = 42) -> pl.DataFrame:
    rng = np.random.default_rng(seed)
    print(f"[*] Generating {n_records:,} records with Structural Causal Mechanisms...")

    # 1. Exogenous Features & Confounders
    categories = rng.choice(list(CATEGORY_CONFIG.keys()), size=n_records)
    store_tiers = rng.choice(STORE_TIERS, size=n_records, p=[0.3, 0.5, 0.2])
    
    # Seasonality index: 0.7 (low season) to 1.5 (peak holiday shopping)
    seasonality = rng.beta(a=2, b=2, size=n_records) * 0.8 + 0.7
    
    # Competitor price ratio: 0.85 (competitor discounted hard) to 1.15 (competitor expensive)
    competitor_price_ratio = rng.normal(loc=1.0, scale=0.08, size=n_records)
    competitor_price_ratio = np.clip(competitor_price_ratio, 0.80, 1.20)

    # Historical inventory pressure: higher inventory forces store managers to markdown
    inventory_aging_days = rng.integers(low=5, high=120, size=n_records)

    # 2. Endogenous Treatment: Discount % (0% to 30%)
    # In real retail, markdowns are NOT randomly assigned:
    # Managers discount when competitor price drops OR inventory is aging OR off-season.
    prob_discount_pressure = (
        (1.0 - competitor_price_ratio) * 0.4 +
        (inventory_aging_days / 120.0) * 0.3 +
        (1.5 - seasonality) * 0.2
    )
    raw_discount = prob_discount_pressure + rng.normal(0, 0.05, size=n_records)
    discount_pct = np.clip(raw_discount, 0.0, 0.30)
    # 25% of the time, zero discount is offered (realistic zero-inflation)
    discount_pct = np.where(rng.random(size=n_records) < 0.25, 0.0, discount_pct)

    # 3. Covariates: Marketing / Ad Spend per SKU
    ad_spend = rng.gamma(shape=2.0, scale=15.0, size=n_records) * seasonality

    # 4. Map Category Parameters & True Causal Ground Truth
    base_prices = np.array([CATEGORY_CONFIG[c]["base_price"] for c in categories])
    unit_costs = np.array([CATEGORY_CONFIG[c]["unit_cost"] for c in categories])
    true_elasticities = np.array([CATEGORY_CONFIG[c]["true_elasticity"] for c in categories])

    # 5. Structural Equation for Sales Demand (Units Sold)
    effective_price = base_prices * (1.0 - discount_pct)
    
    base_demand = np.where(
        store_tiers == "Flagship_Urban", 150,
        np.where(store_tiers == "Suburban_Mall", 100, 60)
    )

    # True Causal Effect of Price: (effective_price / base_price) ** true_elasticity
    price_effect = (effective_price / base_prices) ** true_elasticities
    
    # Confounder effects on demand
    competitor_drag = competitor_price_ratio ** 1.2
    season_boost = seasonality ** 1.5
    ad_boost = 1.0 + (np.log1p(ad_spend) * 0.08)

    # Add idiosyncratic random noise
    noise = rng.lognormal(mean=0, sigma=0.15, size=n_records)

    units_sold = base_demand * price_effect * competitor_drag * season_boost * ad_boost * noise
    units_sold = np.maximum(1, np.round(units_sold)).astype(np.int64)

    # 6. Financial Ledger Calculations
    gross_revenue = np.round(units_sold * effective_price, 2)
    cogs = np.round(units_sold * unit_costs, 2)
    net_profit = np.round(gross_revenue - cogs - ad_spend, 2)
    margin_pct = np.round((net_profit / gross_revenue) * 100, 2)

    # Assemble into Polars DataFrame
    df = pl.DataFrame({
        "sku_id": [f"SKU_{i%5000:05d}" for i in range(n_records)],
        "category": categories,
        "store_tier": store_tiers,
        "base_price": base_prices,
        "unit_cost": unit_costs,
        "discount_pct": np.round(discount_pct, 4),
        "effective_price": np.round(effective_price, 2),
        "ad_spend": np.round(ad_spend, 2),
        "seasonality_index": np.round(seasonality, 3),
        "competitor_price_ratio": np.round(competitor_price_ratio, 3),
        "inventory_aging_days": inventory_aging_days,
        "units_sold": units_sold,
        "gross_revenue": gross_revenue,
        "net_profit": net_profit,
        "margin_pct": margin_pct,
        "ground_truth_elasticity": true_elasticities
    })

    return df


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate Realistic Causal Retail Dataset")
    parser.add_argument("--rows", type=int, default=500_000, help="Number of rows (default: 500,000)")
    parser.add_argument("--out", type=str, default="data/retail_metrics.parquet", help="Output Parquet path")
    args = parser.parse_args()

    out_dir = os.path.dirname(args.out)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    
    df = generate_causal_retail_data(n_records=args.rows)
    df.write_parquet(args.out, compression="snappy")
    
    file_size_mb = os.path.getsize(args.out) / (1024 * 1024)
    print(f"[+] Successfully wrote {args.rows:,} rows to '{args.out}' ({file_size_mb:.2f} MB)")
    print("\n[Preview First 3 Records]:")
    print(df.head(3))
