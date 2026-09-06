"""Cross-platform development commands. Run with your virtual environment Python."""

import argparse
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
NPM = "npm.cmd" if os.name == "nt" else "npm"


def run(command, cwd=ROOT):
    subprocess.run(command, cwd=cwd, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "command",
        choices=[
            "install",
            "dev",
            "test",
            "lint",
            "format",
            "seed",
            "reset",
            "build",
            "up",
            "down",
            "zip",
        ],
    )
    args = parser.parse_args()
    if args.command == "install":
        run(
            [
                sys.executable,
                "-m",
                "pip",
                "install",
                "-r",
                "backend/requirements-lock.txt",
            ]
        )
        run([NPM, "ci"], ROOT / "frontend")
        if not (ROOT / ".env").exists():
            shutil.copyfile(ROOT / ".env.example", ROOT / ".env")
        run([sys.executable, "-m", "alembic", "upgrade", "head"], ROOT / "backend")
    elif args.command == "dev":
        processes = []
        try:
            for command, cwd in [
                (
                    [
                        sys.executable,
                        "-m",
                        "uvicorn",
                        "app.main:app",
                        "--host",
                        "127.0.0.1",
                        "--port",
                        "8000",
                    ],
                    ROOT / "backend",
                ),
                ([NPM, "run", "dev"], ROOT / "frontend"),
            ]:
                processes.append(
                    subprocess.Popen(
                        command, cwd=cwd, start_new_session=os.name != "nt"
                    )
                )
            while all(p.poll() is None for p in processes):
                time.sleep(0.5)
        except KeyboardInterrupt:
            print("Stopping BankGuard development processes.")
        finally:
            for process in processes:
                if process.poll() is None:
                    if os.name == "nt":
                        subprocess.run(
                            ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                            check=False,
                            capture_output=True,
                        )
                    else:
                        os.killpg(process.pid, signal.SIGTERM)
    elif args.command == "test":
        run([sys.executable, "-m", "pytest", "-q"], ROOT / "backend")
        run([NPM, "test"], ROOT / "frontend")
    elif args.command == "lint":
        run([sys.executable, "-m", "ruff", "check", "backend", "database"])
        run([NPM, "run", "lint"], ROOT / "frontend")
    elif args.command == "format":
        run([sys.executable, "-m", "ruff", "format", "backend", "database"])
        run([NPM, "run", "format"], ROOT / "frontend")
    elif args.command == "seed":
        run([sys.executable, "-m", "app.cli", "seed"], ROOT / "backend")
    elif args.command == "reset":
        run([sys.executable, "simulator/attack/run.py", "--reset"])
    elif args.command == "build":
        run([NPM, "run", "build"], ROOT / "frontend")
        run(["docker", "compose", "build"])
    elif args.command == "up":
        run(["docker", "compose", "up", "--build", "-d", "--wait"])
    elif args.command == "down":
        run(["docker", "compose", "down"])
    else:
        run([sys.executable, "scripts/export_zip.py"])


if __name__ == "__main__":
    main()
