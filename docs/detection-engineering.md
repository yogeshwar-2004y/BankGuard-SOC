# Detection engineering

Rules live in `DetectionRule` rows, seeded from `app/detection/engine.py`. Browser configuration is restricted to enabled status, bounded weight and recognized numeric parameters. It cannot supply code, SQL or executable expressions.

| Rule | Logic | Points |
|---|---|---:|
| New device | Successful login; no previous successful login from device and device not trusted | 15 |
| Unusual location | Successful login outside the fictional India baseline | 20 |
| Impossible travel | Two successful logins in different countries within 60 minutes | 30 |
| Suspicious password change | Password change follows new-device/location evidence in the window | 10 |
| New beneficiary | New payee stored by the banking service | 15 |
| Large transfer | Attempted amount >= INR 100,000 | 30 |
| Brute force | At least five failed logins in five minutes | 10 |
| Phishing interaction | Synthetic credential submission | 10 |
| Threat intelligence | Login IP has Malicious local reputation | 10 |
| Beneficiary/transfer correlation | Large transfer after a new beneficiary within 15 minutes | 0; HIGH alert |
| ATO correlation | Aggregate distinct enabled rules | 0; incident orchestration |

Only matched **alerts**, not arbitrary event names, contribute risk. Each rule contributes once per window even if several matching events occur. The resulting `RiskScore` stores the score, severity and explanatory factors, linked to its source event. Alert severity and aggregate risk level are intentionally separate.

The default 15-minute ATO window scopes by user and account. Each simulation run forms an isolated learning context; ordinary banking/authentication API events correlate with other ordinary events. A new HIGH incident opens at 60 points and is updated to CRITICAL at 90. Critical containment is immediate in the same transaction. Existing non-resolved incidents are reused for that context.

The full chain contributes phishing 10, new device 15, country 20, reputation 10, password 10, beneficiary 15 and transfer 30 = **110**. These teaching weights differ from some real SOC models and should not be interpreted as a probability. At 65 a HIGH incident is available for investigation; at 110 SOAR contains the transfer. Impossible travel is not forced into the primary scenario because its normal login history is older than the active window.

## Rule replay

Test rule evaluates up to 100 recent stored source events using current configuration inside rollback-only savepoints. Derived alerts and attempted state changes are discarded, and only the test audit entry persists. Results identify matching source event IDs. This is a bounded diagnostic, not a historical full-dataset batch reprocessing engine.

## Tuning exercise

Run the isolated new-device scenario, inspect its MEDIUM alert and LOW aggregate score, then compare it with the full attack. Change one parameter at a time as admin. Lower thresholds may intentionally cause early containment and prevent subsequent simulated attack steps. Reset between exercises. Disabled rules stop emitting their derived signals and stop contributing their weight; existing historical alerts remain visible.
