#!/usr/bin/env python3
"""Build the public benchmark-level October 26 edits table from the full crosswalk."""

import csv
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "oct26-id-text-crosswalk.csv"
OUTPUT = HERE / "oct26-table-of-edits.csv"

UNLISTED_BY_FDOE_CODE_OR_PARENT = {
    "SC.2.EN.1.2",
    "SC.912.HB.3.5",
    "SC.912.HB.3.6",
    "SC.912.HB.3.7",
    "SC.912.HB.6.10",
    "SC.912.HB.6.11",
    "SC.912.HB.6.12",
    "SC.912.M.3.4",
    "SC.912.M.3.6",
    "SC.912.M.3.7",
    "SC.912.M.3.8",
    "SC.912.M.3.9",
    "SC.912.M.3.10",
    "SC.912.M.3.11",
    "SC.912.M.3.12",
    "SC.912.M.3.13",
    "SC.912.M.3.14",
    "SC.912.M.3.15",
}

FIELDS = [
    "revision_status",
    "grade_band",
    "current_code",
    "current_pdf_page",
    "current_source_url",
    "october_26_benchmark_text",
    "first_round_same_code_text",
    "exact_matching_first_round_code",
    "exact_matching_first_round_page",
    "exact_matching_first_round_text",
    "fdoe_table_code_or_parent_listed",
    "comparison_note",
]


def main():
    with SOURCE.open(newline="", encoding="utf-8") as source_file:
        source_rows = list(csv.DictReader(source_file))

    changed_rows = [
        row for row in source_rows
        if row["change_class"] != "shared_id_identical_text"
    ]
    if len(changed_rows) != 110 or len({r["current_id"] for r in changed_rows}) != 110:
        raise SystemExit("Unexpected changed-row count; inspect source crosswalk before publishing.")

    with OUTPUT.open("w", newline="", encoding="utf-8") as output_file:
        writer = csv.DictWriter(output_file, fieldnames=FIELDS, lineterminator="\n")
        writer.writeheader()
        for row in changed_rows:
            exact_reindex = row["change_class"] in {
                "shared_id_sentence_reindexed",
                "new_id_exact_sentence_reindexed",
            }
            writer.writerow({
                "revision_status": row["change_class"],
                "grade_band": row["grade_band"],
                "current_code": row["current_id"],
                "current_pdf_page": row["current_pdf_page"],
                "current_source_url": row["current_source_url"],
                "october_26_benchmark_text": row["oct26_benchmark_text"],
                "first_round_same_code_text": row["first_round_text_at_same_id"],
                "exact_matching_first_round_code": row["first_round_id_for_text_match"],
                "exact_matching_first_round_page": row["first_round_pdf_page_for_text_match"],
                "exact_matching_first_round_text": row["first_round_text_for_text_match"],
                "fdoe_table_code_or_parent_listed": (
                    "No—code and parent not listed"
                    if row["current_id"] in UNLISTED_BY_FDOE_CODE_OR_PARENT
                    else "Yes—code or parent listed"
                ),
                "comparison_note": (
                    "Exact ID/text comparison; code movement does not by itself establish a change in intended course scope."
                    if exact_reindex
                    else "Exact ID/text comparison; no inference about conceptual novelty."
                ),
            })

    print(f"Wrote {len(changed_rows)} changed/new benchmark rows to {OUTPUT.name}.")
    print(f"FDOE table does not list {len(UNLISTED_BY_FDOE_CODE_OR_PARENT)} codes or their parent standards.")


if __name__ == "__main__":
    main()
