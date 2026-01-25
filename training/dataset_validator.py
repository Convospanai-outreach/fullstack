import json
import sys
from pathlib import Path

DATA_DIR = Path("training/data")

REQUIRED_FIELDS = {"task", "input", "output"}
MAX_INPUT_CHARS = 2000
MAX_OUTPUT_CHARS = 600

VALID_TASKS = {
    "TONE_NORMALIZATION",
    "POLICY_REWRITE",
    "POLICY_CLASSIFICATION",
    "REFUSAL_GENERATION",
    "SHORT_SUMMARY",
    "OBJECTION_EXTRACTION",
}

def validate_file(path: Path):
    errors = []
    count = 0

    with path.open("r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, start=1):
            count += 1
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                errors.append(f"{path.name}:{line_no} invalid JSON")
                continue

            missing = REQUIRED_FIELDS - record.keys()
            if missing:
                errors.append(f"{path.name}:{line_no} missing fields {missing}")

            task = record.get("task")
            if task not in VALID_TASKS:
                errors.append(f"{path.name}:{line_no} invalid task '{task}'")

            if len(record.get("input", "")) > MAX_INPUT_CHARS:
                errors.append(f"{path.name}:{line_no} input too long")

            if len(record.get("output", "")) > MAX_OUTPUT_CHARS:
                errors.append(f"{path.name}:{line_no} output too long")

    return count, errors


def main():
    total_records = 0
    all_errors = []

    if not DATA_DIR.exists():
        print(f"Directory {DATA_DIR} does not exist.")
        sys.exit(1)

    for file in DATA_DIR.glob("*.jsonl"):
        count, errors = validate_file(file)
        total_records += count
        all_errors.extend(errors)
        print(f"✓ {file.name}: {count} records")

    if all_errors:
        print("\n❌ VALIDATION FAILED\n")
        for err in all_errors:
            print(err)
        sys.exit(1)

    print(f"\n✅ Dataset validation passed ({total_records} total records)")
    sys.exit(0)


if __name__ == "__main__":
    main()
