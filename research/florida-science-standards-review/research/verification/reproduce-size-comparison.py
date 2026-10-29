#!/usr/bin/env python3
"""Reproduce matched K–12 standards-body text counts from local source extracts.

The source corpus remains private. This script exposes page boundaries,
normalization, excluded boilerplate, and the resulting aggregate counts without
redistributing source text. It reads the pdftotext extracts preserved under
~/Documents/Florida-Science-Standards-Provenance-2026-10-21/sources.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import re
from pathlib import Path


CORPUS = Path.home() / "Documents/Florida-Science-Standards-Provenance-2026-10-21"
OUT = Path(__file__).with_name("matched-size-comparison.csv")

# Page ranges use zero-based inclusive indexes in the retained pdftotext
# extraction. The matching PDF page locator is stated in the CSV record.
SOURCES = [
    {
        "label": "Florida 2026 proposed science standards (October 26)",
        "url": "https://www.fldoe.org/standardsreview/",
        "files": [
            ("2026-10-26/K-5-SciStands26.txt", None, None),
            ("2026-10-26/6-8-SciStands26.txt", None, None),
            ("2026-10-26/9-12-SciStands26.txt", None, None),
        ],
        "locator": "Three complete grade-band PDFs; all benchmark text, parent descriptions, clarifications, examples, tasks, and instructional notes; foreword and tables excluded.",
        "limit": "FDOE says benchmarks, clarifications, and examples together define expected outcomes and carry the full weight of the proposed standards. This is text volume, not item count, instructional time, or workload.",
        "pdfs": ["2026-10-26/K-5-SciStands26.pdf", "2026-10-26/6-8-SciStands26.pdf", "2026-10-26/9-12-SciStands26.pdf"],
    },
    {
        "label": "Florida 2008 Next Generation Sunshine State Standards: Science",
        "url": "https://www.fldoe.org/academics/standards/subject-areas/math-science/science/",
        "files": [("2008/florida-2008-science-standards.txt", 19, 73)],
        "locator": "Printed pp. 19–73: K–8 standards and grades 9–12 Bodies of Knowledge; cover, contents, history, process notes, and Access Points discussion excluded.",
        "limit": "The 2008 publication has no parallel student-task/example/clarification layer. Cognitive-complexity ratings are metadata and excluded. Both counts use the full K–12 science body, not identical document architectures.",
        "pdfs": ["2008/florida-2008-science-standards.pdf"],
    },
    {
        "label": "Next Generation Science Standards DCI Arrangements",
        "url": "https://www.nextgenscience.org/overview-dci",
        "files": [("alt-jurisdiction/ngss-dci.txt", 4, 102)],
        "locator": "PDF body pages 5–103: K–12 DCI arrangements and associated performance-expectation material; front matter and contents excluded.",
        "limit": "Includes DCI foundation text and standard-page explanatory material. Repeated copyright and ‘students who demonstrate understanding can’ boilerplate is excluded. This is an arrangement document, not the complete NGSS publication.",
        "pdfs": ["alt-jurisdiction/ngss-dci.pdf"],
    },
    {
        "label": "Massachusetts 2016 Science and Technology/Engineering Framework",
        "url": "https://www.doe.mass.edu/frameworks/scitech/2016-04.pdf",
        "files": [("alt-ngss/massachusetts-2016-ste-framework.txt", 26, 98)],
        "locator": "PDF body pp. 18–96 (zero-based extraction indexes 26–98): standards overview and PreK–12 standards with clarification statements and assessment boundaries; front matter and standards-related appendices excluded.",
        "limit": "Includes PreK as well as K–12 and integrated technology/engineering content. Standard-page clarifications and boundaries are retained.",
        "pdfs": ["alt-ngss/massachusetts-2016-ste-framework.pdf"],
    },
    {
        "label": "South Carolina 2014 Academic Standards and Performance Indicators for Science",
        "url": "https://www.ed.sc.gov/instruction/standards/science/",
        "files": [("alt-jurisdiction/south-carolina-2014.txt", 6, 113)],
        "locator": "PDF body pp. 5–110: K–12 standards, conceptual understandings, and performance indicators; front matter, introduction, and separately promised support document excluded.",
        "limit": "Includes performance indicators and content explanations printed within the standards body. High-school courses are subject-specific, unlike Florida’s integrated grades 9–12 organization. The 2014 edition is a historical comparator; SCDE now identifies 2021 standards as adopted/current.",
        "pdfs": ["alt-jurisdiction/south-carolina-2014.pdf"],
    },
]

PAGE_ONLY = re.compile(r"^\d+(?:\s+of\s+\d+)?$")
RATING = re.compile(r"^Cognitive Complexity/Depth of Knowledge Rating:\s*(?:Low|Moderate|High)$", re.I)
CODE_PATTERNS = [
    # Florida 2008 and 2026 codes. The final segment is optional for parent IDs;
    # no required word boundary follows the code, to handle SC.8.NT.1.5Evaluate.
    re.compile(r"(?<![A-Za-z0-9])SC\.(?:K|[1-9]|1[0-2])\.[A-Z]{1,4}\.\d+(?:\.\d+)?"),
    # NGSS/MA course-grade codes, including K-2 engineering codes.
    re.compile(r"(?<![A-Za-z0-9])(?:K-2|K|[1-9]|1[0-2]|MS|HS)-[A-Z]{2,4}\d?(?:-\d+)?(?:\(MA\))?"),
    re.compile(r"(?<![A-Za-z0-9])\d+\.(?:MS|HS)-[A-Z]{2,4}\d?(?:-\d+)?(?:\(MA\))?"),
    # South Carolina course/grade codes.
    re.compile(r"(?<![A-Za-z0-9])(?:K|[1-9]|1[0-2]|H)\.[A-Z]{1,3}\.\d+[A-Z]?(?:\.\d+[A-Z]?)?"),
]
WORD = re.compile(r"\b\w+\b", re.UNICODE)


def extract_text(source: dict) -> str:
    chunks = []
    for relative, first, last in source["files"]:
        path = CORPUS / "sources" / relative
        if not path.exists():
            raise FileNotFoundError(path)
        pages = path.read_text(encoding="utf-8", errors="replace").split("\f")
        selected = pages if first is None else pages[first : last + 1]
        for page in selected:
            for raw_line in page.splitlines():
                line = " ".join(raw_line.split())
                if not line or PAGE_ONLY.fullmatch(line) or RATING.fullmatch(line):
                    continue
                if line.casefold() in {
                    "proposed draft standards",
                    "students who demonstrate understanding can:",
                    "benchmark code benchmark",
                    "benchmark",
                    "code",
                }:
                    continue
                if line.startswith("The section entitled “Disciplinary Core Ideas” is reproduced verbatim"):
                    continue
                if line == "and reprinted with permission from the National Academy of Sciences.":
                    continue
                if line.startswith("The performance expectations above were developed using the following elements"):
                    continue
                for pattern in CODE_PATTERNS:
                    line = pattern.sub(" ", line)
                chunks.append(line)
    return " ".join(chunks)


def main() -> None:
    global CORPUS
    parser = argparse.ArgumentParser()
    parser.add_argument("--corpus", type=Path, default=CORPUS, help="local private corpus root")
    parser.add_argument("--output", type=Path, default=OUT)
    args = parser.parse_args()
    CORPUS = args.corpus
    rows = []
    for source in SOURCES:
        text = extract_text(source)
        extract_hashes = []
        for relative, _, _ in source["files"]:
            path = CORPUS / "sources" / relative
            extract_hashes.append(f"{relative}:{hashlib.sha256(path.read_bytes()).hexdigest()}")
        pdf_hashes = []
        for relative in source["pdfs"]:
            path = CORPUS / "sources" / relative
            pdf_hashes.append(f"{relative}:{hashlib.sha256(path.read_bytes()).hexdigest()}")
        rows.append(
            {
                "source": source["label"],
                "official_or_source_url": source["url"],
                "unicode_word_tokens": len(WORD.findall(text)),
                "tokenization": r"Python Unicode regex \b\w+\b after source-code and specified boilerplate removal",
                "source_page_boundary": source["locator"],
                "included_material": "Standards-body text only; source-specific support embedded within that body retained as described in the locator/limitation.",
                "limitation": source["limit"],
                "source_extracts": "; ".join(str(Path("sources") / p) for p, _, _ in source["files"]),
                "source_extract_sha256": "; ".join(extract_hashes),
                "preserved_pdf_sha256": "; ".join(pdf_hashes),
            }
        )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", newline="", encoding="utf-8") as output:
        writer = csv.DictWriter(output, fieldnames=rows[0].keys(), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    for row in rows:
        print(f"{row['source']}: {row['unicode_word_tokens']:,} Unicode word tokens")
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
