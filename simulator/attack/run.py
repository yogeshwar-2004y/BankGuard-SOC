"""Drive only the authenticated BankGuard synthetic scenario API."""

import argparse
import getpass
import os

import httpx
from dotenv import load_dotenv


def main():
    load_dotenv()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://localhost:8080")
    parser.add_argument(
        "--scenario",
        default="ato",
        choices=[
            "ato",
            "brute-force",
            "phishing",
            "suspicious-login",
            "beneficiary-fraud",
            "large-transfer",
            "new-device",
        ],
    )
    parser.add_argument("--guided", action="store_true")
    parser.add_argument("--reset", action="store_true")
    args = parser.parse_args()
    role = "ADMIN" if args.reset else "ANALYST"
    email = os.getenv(f"DEMO_{role}_EMAIL", f"{role.lower()}@bankguard.test")
    password = os.getenv(f"DEMO_{role}_PASSWORD") or getpass.getpass(
        f"Synthetic {role.lower()} password: "
    )
    with httpx.Client(base_url=args.url, timeout=30) as client:
        response = client.post(
            "/api/auth/login", json={"email": email, "password": password}
        )
        response.raise_for_status()
        client.headers["X-CSRF-Token"] = response.json()["csrf_token"]
        if args.reset:
            confirmation = input(
                "Type RESET BANKGUARD to restore the synthetic environment: "
            )
            if confirmation != "RESET BANKGUARD":
                raise SystemExit("Reset cancelled.")
            response = client.post(
                "/api/admin/reset", json={"confirmation": confirmation}
            )
        else:
            response = client.post(
                "/api/simulations",
                json={"scenario": args.scenario, "guided": args.guided},
            )
            response.raise_for_status()
            run = response.json()
            if args.guided:
                for lesson in run["lessons"]:
                    print(
                        f"\n{lesson['title']}\n{lesson['what']}\nSOC decision: {lesson['decision']}"
                    )
                    input("Press Enter to advance this synthetic step.")
                    response = client.post(f"/api/simulations/{run['id']}/continue")
                    response.raise_for_status()
        response.raise_for_status()
        print(response.json())


if __name__ == "__main__":
    main()
