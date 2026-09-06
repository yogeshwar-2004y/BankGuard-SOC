# Presenter guide

Allow 5–10 minutes. Before presenting, start Compose and reset the environment as admin. Sign out, then sign in as analyst. Explain that the lab is entirely synthetic and that the account, SIEM and SOAR all use the same database-backed state.

## Story beats

1. **Overview**: “We will follow one fictional customer from phishing to containment.” Open guided simulation.
2. **Phishing**: Continue once. Inspect the phishing and credential-submission events. No real email was sent and no credentials were harvested.
3. **Suspicious login**: Continue. Show the unknown device, unusual country and local IP reputation match. Explain why a correct password is not enough context.
4. **New device review**: Compare the unrecognized browser to Rahul's trusted iPhone/laptop inventory.
5. **Password change**: Continue. A HIGH incident opens; the score is not yet critical, so the account remains active.
6. **Beneficiary**: Continue. A fictional destination is created and risk rises to 80.
7. **Transfer**: Continue. The INR 150,000 request is evaluated before settlement. Risk reaches 110 and automatic response contains it.
8. **Correlation and response lessons**: Continue through the final two explanations. The success panel shows actual risk, timing and controls.
9. **Investigation**: Open the incident, inspect timeline events and hashes, view risk factors and verify the response ledger. Add a note and assign yourself.
10. **Resolution/report**: Mark Remediating, then Resolved. Download the latest PDF.

## Alternative demonstrations

- Open Live Events in a second tab and launch with guided mode disabled. The SSE connection updates the explorer without refreshing.
- Pause and resume before the run finishes. Stopping retains already-created evidence.
- After reset, launch the standalone new-device scenario. It creates a MEDIUM alert, LOW aggregate score and no account lock.
- Sign in as customer before launching an attack in another context. Customer sessions will be revoked at containment. The customer can ordinarily add a payee and make a small simulated transfer.

The primary scenario changes the customer's password. A failed customer login afterward is expected, not a defect. Administrators can always reset using their separate identity. Reset removes generated cases and reseeds two prepared examples while preserving the audit trail.
