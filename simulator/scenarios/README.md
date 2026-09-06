# Scenario definitions

The authoritative finite scenario definitions and educational lessons are in `backend/app/simulation/scenarios.py`. They are seeded into `SimulationScenario` rows; an administrator can enable or disable them through System Health.

`simulator/attack/run.py` drives these same scenario endpoints. `simulator/normal/activity.py` performs a small ordinary simulated transfer through customer APIs. Neither script connects to a bank, sends phishing email, captures credentials or creates network attacks.
