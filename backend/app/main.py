from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.decision_routes import router as decision_router

app = FastAPI(
    title="NexusOptima Decision Intelligence Core",
    description="Enterprise Causal What-If & Prescriptive Optimization Engine (100% Free & Open Source)",
    version="1.0.0"
)

# Enable CORS for Angular frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://127.0.0.1:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(decision_router)

@app.get("/")
def health_check():
    return {
        "status": "online",
        "system": "NexusOptima Decision Intelligence Platform",
        "engines": ["DuckDB OLAP", "Double-ML Causal Estimator", "HiGHS Mixed-Integer Solver"],
        "license": "100% Free & Open-Source (MIT / Apache 2.0 / BSD)"
    }
