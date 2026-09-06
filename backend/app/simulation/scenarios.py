"""Safe, finite scenarios. No email delivery, credential capture or network attacks."""

LESSONS = {
    "phishing": {
        "title": "Phishing interaction",
        "what": "A fictional message is delivered, clicked and followed by a synthetic credential-submission event.",
        "why": "Phishing tricks people into disclosing credentials. BankGuard never collects a real password in the simulation.",
        "decision": "Record initial-access evidence; a single signal does not justify locking an account.",
    },
    "login": {
        "title": "Suspicious login",
        "what": "A synthetic session opens from an unfamiliar device and a reserved test IP in another country.",
        "why": "Stolen credentials can pass authentication. Device and location context help identify misuse.",
        "decision": "Correlate the login with phishing evidence and local IP reputation.",
    },
    "device": {
        "title": "New device review",
        "what": "The SIEM compares the login device with the customer's trusted-device history.",
        "why": "A new device alone may simply be a legitimate new phone.",
        "decision": "Retain evidence and increase risk without automatically locking the account.",
    },
    "password": {
        "title": "Password change",
        "what": "The scenario changes the fictional customer's password to a random synthetic value.",
        "why": "Changing a password after a suspicious login can help an attacker retain access.",
        "decision": "Link the credential change to the same user's recent authentication signals.",
    },
    "beneficiary": {
        "title": "New beneficiary",
        "what": "A fictional recipient is added to the account.",
        "why": "Attackers may create a destination for stolen funds.",
        "decision": "Watch subsequent transfers and retain the payee record.",
    },
    "transfer": {
        "title": "Large transfer attempt",
        "what": "A simulated INR 150,000 transfer enters the banking service.",
        "why": "A high-value transfer to a new beneficiary after authentication anomalies is a strong fraud signal.",
        "decision": "The detection engine evaluates before settlement; critical risk invokes SOAR.",
    },
    "detection": {
        "title": "SIEM correlation",
        "what": "Stored alerts are grouped by customer, account and time window.",
        "why": "Several independent signals are stronger evidence than one anomaly.",
        "decision": "Open the incident and inspect the risk factors and captured evidence.",
    },
    "response": {
        "title": "Automated containment",
        "what": "SOAR locks the account, revokes sessions, freezes pending funds and blocks the simulated source IP.",
        "why": "Containment stops additional activity while an analyst investigates.",
        "decision": "Verify each action's result, document findings, remediate and generate the report.",
    },
    "new_device_only": {
        "title": "A legitimate new phone",
        "what": "The customer signs in from a new device in their normal location using a neutral test IP.",
        "why": "Novelty is a useful signal, but is not proof of compromise.",
        "decision": "A MEDIUM new-device alert contributes 15 risk points. The account remains active.",
    },
    "brute_force": {
        "title": "Repeated failed logins",
        "what": "Six synthetic authentication failures are recorded.",
        "why": "Repeated failures can indicate credential guessing, but may also be user error.",
        "decision": "Trigger the bounded brute-force rule; inspect context before escalating.",
    },
}

SCENARIOS = [
    (
        "ato",
        "Phishing → Account Takeover → Fraud",
        "Follow a complete attack, from initial access to verified containment.",
        [
            "phishing",
            "login",
            "device",
            "password",
            "beneficiary",
            "transfer",
            "detection",
            "response",
        ],
    ),
    (
        "brute-force",
        "Brute Force",
        "Observe repeated failures and a threshold-based detection.",
        ["brute_force"],
    ),
    (
        "suspicious-login",
        "Suspicious Login",
        "Investigate device, location and local reputation signals.",
        ["login", "device"],
    ),
    (
        "phishing",
        "Credential Phishing",
        "Learn how a safe synthetic phishing interaction becomes telemetry.",
        ["phishing"],
    ),
    (
        "beneficiary-fraud",
        "Beneficiary Fraud",
        "Correlate suspicious access, a payee and a transfer.",
        ["login", "beneficiary", "transfer", "response"],
    ),
    (
        "large-transfer",
        "Large Transfer Fraud",
        "See why a large transfer alone requires context.",
        ["beneficiary", "transfer"],
    ),
    (
        "new-device",
        "False positive · New device",
        "A legitimate device change raises an alert without containment.",
        ["new_device_only"],
    ),
]
