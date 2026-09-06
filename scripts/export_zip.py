"""Export an inspected source-only ZIP, excluding secrets and generated artifacts."""

import hashlib
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "BankGuard-SOC.zip"
SOURCE_DIRS = {
    "backend",
    "frontend",
    "database",
    "simulator",
    "infrastructure",
    "docs",
    "scripts",
    ".github",
}
ROOT_FILES = {
    "README.md",
    "BUILD_STATUS.md",
    "LICENSE",
    ".env.example",
    ".gitignore",
    ".dockerignore",
    "docker-compose.yml",
    "Makefile",
}
EXCLUDED = {
    "node_modules",
    ".venv",
    "__pycache__",
    ".pytest_cache",
    ".ruff_cache",
    "dist",
    "test-results",
    "playwright-report",
    "artifacts",
    ".git",
    ".codegraph",
}
SUFFIXES = {".pyc", ".pyo", ".db", ".sqlite", ".log", ".zip", ".tsbuildinfo"}


def allowed(path):
    relative = path.relative_to(ROOT)
    return (
        (relative.parts[0] in SOURCE_DIRS or str(relative) in ROOT_FILES)
        and not any(p in EXCLUDED for p in relative.parts)
        and path.suffix not in SUFFIXES
        and (not path.name.startswith(".env") or path.name == ".env.example")
    )


def main():
    status = ROOT / "BUILD_STATUS.md"
    if not status.exists():
        raise SystemExit("Write the actual verification record before exporting.")
    paths = sorted(p for p in ROOT.rglob("*") if p.is_file() and allowed(p))
    with ZipFile(OUTPUT, "w", ZIP_DEFLATED, compresslevel=9) as archive:
        for path in paths:
            archive.write(path, "BankGuard-SOC/" + path.relative_to(ROOT).as_posix())
    with ZipFile(OUTPUT) as archive:
        assert archive.testzip() is None
        names = archive.namelist()
        assert "BankGuard-SOC/.env.example" in names
        assert "BankGuard-SOC/BUILD_STATUS.md" in names
        assert all(
            not any(part in EXCLUDED for part in Path(name).parts) for name in names
        )
        assert all(not name.endswith("/.env") for name in names)
    digest = hashlib.sha256(OUTPUT.read_bytes()).hexdigest()
    print(
        f"Exported {len(paths)} source files: {OUTPUT}\nSHA256: {digest}\nSize: {OUTPUT.stat().st_size:,} bytes"
    )


if __name__ == "__main__":
    main()
