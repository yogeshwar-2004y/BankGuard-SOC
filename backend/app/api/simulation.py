from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select

from app.core.security import Admin, Analyst, DB
from app.models.entities import SimulationRun, SimulationScenario, now
from app.schemas.requests import ScenarioUpdate, SimulationInput
from app.services.common import audit, public
from app.simulation.runner import run_view, start, step
from app.simulation.scenarios import LESSONS

router = APIRouter(prefix="/api", tags=["Safe attack simulation"])


@router.get("/scenarios")
def scenarios(db: DB, user: Analyst) -> list[dict]:
    return [
        dict(public(s), lessons=[LESSONS[k] for k in s.steps])
        for s in db.scalars(select(SimulationScenario))
    ]


@router.patch("/scenarios/{scenario_id}")
def configure(scenario_id: UUID, payload: ScenarioUpdate, db: DB, user: Admin) -> dict:
    item = db.get(SimulationScenario, str(scenario_id))
    if not item:
        raise HTTPException(404, "Scenario not found.")
    item.enabled = payload.enabled
    audit(db, user.email, "SCENARIO_CHANGE", item.id)
    db.commit()
    return public(item)


@router.get("/simulations")
def history(db: DB, user: Analyst) -> list[dict]:
    return [
        run_view(db, r)
        for r in db.scalars(
            select(SimulationRun).order_by(SimulationRun.created_at.desc()).limit(100)
        )
    ]


@router.post("/simulations")
def launch(payload: SimulationInput, db: DB, user: Analyst) -> dict:
    run = start(db, user, payload.scenario, payload.guided)
    db.commit()
    return run_view(db, run)


@router.get("/simulations/{run_id}")
def get_run(run_id: UUID, db: DB, user: Analyst) -> dict:
    run = db.get(SimulationRun, str(run_id))
    if not run:
        raise HTTPException(404, "Simulation not found.")
    return run_view(db, run)


@router.post("/simulations/{run_id}/{action}")
def control(run_id: UUID, action: str, request: Request, db: DB, user: Analyst) -> dict:
    run = db.get(SimulationRun, str(run_id))
    if not run:
        raise HTTPException(404, "Simulation not found.")
    if action == "continue" and run.guided:
        step(db, run, request.app.state.settings)
    elif action == "pause" and run.status == "RUNNING":
        run.status = "PAUSED"
    elif action == "resume" and run.status == "PAUSED":
        run.status = "RUNNING"
    elif action == "stop" and run.status in {"RUNNING", "PAUSED"}:
        run.status, run.finished_at = "STOPPED", now()
    else:
        raise HTTPException(409, "That control is unavailable in the current state.")
    audit(db, user.email, f"SIMULATION_{action.upper()}", run.id)
    db.commit()
    return run_view(db, run)
