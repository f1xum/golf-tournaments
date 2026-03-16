"""Run cross-source deduplication on tournaments."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.normalization.deduplication import deduplicate_tournaments


def main():
    print("=== Running Deduplication ===\n")
    removed = deduplicate_tournaments()
    print(f"\nTotal duplicates removed: {removed}")


if __name__ == "__main__":
    main()
