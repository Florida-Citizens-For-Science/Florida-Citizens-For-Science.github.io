#!/usr/bin/env python3
"""Build the public benchmark-level October 26 edits table from the full crosswalk."""

import csv
from html import escape
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "oct26-id-text-crosswalk.csv"
OUTPUT = HERE / "oct26-table-of-edits.csv"
PAGE = HERE / "oct26-table-of-edits.html"

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

STATUS_LABELS = {
    "shared_id_wording_changed": "Existing code · wording changed",
    "shared_id_sentence_reindexed": "Existing code · prior text moved",
    "new_id_exact_sentence_reindexed": "New code · carries earlier text",
    "new_id_no_exact_old_sentence": "New code · no exact earlier sentence",
}


def esc(value):
    return escape(value or "", quote=True)


def render_html(rows):
    table_rows = []
    for row in rows:
        code = esc(row["current_code"])
        grade = esc(row["grade_band"])
        status = STATUS_LABELS[row["revision_status"]]
        same_code_text = row["first_round_same_code_text"]
        prior_id = row["exact_matching_first_round_code"]
        prior_page = row["exact_matching_first_round_page"]
        prior_text = row["exact_matching_first_round_text"]

        if same_code_text:
            earlier = f"<p>{esc(same_code_text)}</p>"
        else:
            earlier = "<p><em>No first-round benchmark at this code.</em></p>"
        if prior_id:
            earlier += (
                f'<p class="match-note">The October 26 wording exactly matches '
                f"first-round <code>{esc(prior_id)}</code>"
                f'{f" (PDF p. {esc(prior_page)})" if prior_page else ""}:</p>'
                f"<p>{esc(prior_text)}</p>"
            )

        fdoe_missing = row["fdoe_table_code_or_parent_listed"].startswith("No")
        fdoe_label = "Not identified by code or parent" if fdoe_missing else "Code or parent identified"
        fdoe_class = "missing" if fdoe_missing else "listed"
        page_link = row["current_source_url"]
        table_rows.append(
            f'<tr data-grade="{grade}" data-fdoe="{"no" if fdoe_missing else "yes"}" '
            f'data-search="{esc(" ".join([row["current_code"], grade, row["revision_status"], same_code_text, prior_id, prior_text, row["october_26_benchmark_text"], fdoe_label]))}">'
            f'<th scope="row"><code>{code}</code><br><span class="row-meta">{grade} · '
            f'<a href="{esc(page_link)}" target="_blank" rel="noopener">PDF p. {esc(row["current_pdf_page"])}</a></span><br>'
            f'<span class="change-type">{esc(status)}</span></th>'
            f'<td><strong>First-round text</strong>{earlier}</td>'
            f'<td><strong>October 26 text</strong><p>{esc(row["october_26_benchmark_text"])}</p></td>'
            f'<td><span class="fdoe-badge {fdoe_class}">{esc(fdoe_label)}</span>'
            f'<p>{esc(row["comparison_note"])}</p></td></tr>'
        )

    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="dateModified" content="2026-10-29"><meta name="description" content="Searchable side-by-side table of all identified changes to numbered leaf benchmark text between Florida's first-round and October 26, 2026 science standards drafts.">
<title>October 26 Table of Edits | Florida Science Standards Draft Review</title><link rel="stylesheet" href="/research/florida-science-standards-review/site.css">
<style>
.edits-lede{{max-width:78ch}}.edits-notice{{padding:1rem;border-left:4px solid #a65f17;background:#fff5e9;margin:1rem 0}}
.edit-summary{{display:grid;grid-template-columns:repeat(auto-fit,minmax(10rem,1fr));gap:.6rem;margin:1rem 0}}
.edit-summary article{{padding:.75rem;border:1px solid #cbd5d1;border-radius:.35rem;background:#f8faf9}}.edit-summary strong{{display:block;font-size:1.25rem;color:#174f48}}.edit-summary span{{font-size:.86rem}}
.edit-controls{{display:flex;flex-wrap:wrap;align-items:end;gap:.8rem 1rem;margin:1.2rem 0;padding:1rem;background:#f3f6f5;border:1px solid #cbd5d1;border-radius:.4rem}}
.edit-controls label{{display:grid;gap:.3rem;font-weight:650}}.edit-controls input,.edit-controls select{{min-width:13rem;max-width:100%;padding:.6rem;border:1px solid #66736f;border-radius:.3rem;font:inherit;background:#fff}}
#edit-count{{font-weight:700;margin:.5rem 0}}.edits-scroll{{max-width:100%;overflow:auto;border:1px solid #cbd5d1;border-radius:.35rem}}
#edits-table{{display:table;width:100%;min-width:880px;table-layout:fixed;border-collapse:collapse;font-size:.9rem}}
#edits-table th,#edits-table td{{vertical-align:top;text-align:left;white-space:normal;overflow-wrap:anywhere;word-break:normal;padding:.7rem;border-bottom:1px solid #d8dfdc}}
#edits-table th:nth-child(1){{width:17%}}#edits-table th:nth-child(2){{width:27%}}#edits-table th:nth-child(3){{width:34%}}#edits-table th:nth-child(4){{width:22%}}
#edits-table thead th{{position:sticky;top:0;background:#e8efed;z-index:1}}#edits-table tbody th{{background:#f8faf9}}
.row-meta{{font-size:.82rem;color:#465751}}.change-type{{display:inline-block;margin-top:.35rem;padding:.15rem .4rem;border-radius:.25rem;background:#e8eef7;font-size:.78rem;font-weight:650}}
.fdoe-badge{{display:inline-block;padding:.18rem .45rem;border-radius:999px;font-size:.78rem;font-weight:700}}.fdoe-badge.missing{{background:#fff0df;color:#733800}}.fdoe-badge.listed{{background:#e8f3eb;color:#245b35}}
.match-note{{font-size:.84rem;color:#3f5049}}.no-results{{padding:1rem;border:1px dashed #9ba9a3;background:#f7f9f8}}
@media(max-width:700px){{.edit-controls label,.edit-controls input,.edit-controls select{{width:100%;min-width:0}}#edits-table{{min-width:760px}}}}
</style></head>
<body class="document"><header class="docbar"><a href="../../index.html">← Florida Science Standards Draft Review</a><span>Version comparison · October 29, 2026</span></header>
<main class="prose"><h1 class="doc-title">October 26 Table of Edits</h1>
<p class="lede edits-lede">A searchable side-by-side comparison of the first-round and October 26 wording for all 110 changed or new numbered leaf benchmark codes in the current draft. Each row includes source PDF page links and whether FDOE’s own <a href="https://www.fldoe.org/file/18736/TOE-SciStands.pdf">Table of Edits</a> identifies the code or its parent standard.</p>
<div class="edits-notice"><strong>Scope and finding:</strong> This table covers numbered benchmark sentences only. It is not a line-by-line comparison of every clarification, example, student task, parent description, or supplemental table. Our comparison found 18 changed or new benchmark codes that FDOE’s PDF does not identify by exact code or parent standard. The Department’s PDF remains useful for its feedback categories and stated rationales; it is not an exhaustive benchmark change log. <a href="oct26-complete-change-review.html">Read the methodology and examples.</a></div>
<div class="edit-summary" aria-label="Summary of benchmark edit categories"><article><strong>30</strong><span>Same code, wording changed</span></article><article><strong>19</strong><span>Existing codes carry text from another first-round code</span></article><article><strong>6</strong><span>New codes carry exact earlier text</span></article><article><strong>55</strong><span>New codes have no exact earlier sentence</span></article><article><strong>18</strong><span>Codes not identified in FDOE’s table by code or parent</span></article></div>
<p><a class="button primary" href="oct26-table-of-edits.csv" download>Download the CSV</a> · <a href="oct26-id-text-crosswalk.csv">Full 1,573-code crosswalk</a> · <a href="oct26-reindexed-statement-map.csv">Exact reindex map</a></p>
<h2>Find a changed benchmark</h2><p>Search by code or wording, or filter the list by grade band and FDOE table coverage. “No exact earlier sentence match” is a wording result; it does not prove that the concept is new.</p>
<div class="edit-controls"><label for="edits-search">Search code or text<input id="edits-search" type="search" autocomplete="off" placeholder="e.g. SC.912.PE.7.3 or radiometric dating"></label>
<label for="edits-grade">Grade band<select id="edits-grade"><option value="">All grades</option><option value="K-5">K–5</option><option value="6-8">Grades 6–8</option><option value="9-12">Grades 9–12</option></select></label>
<label for="edits-fdoe">FDOE Table of Edits<select id="edits-fdoe"><option value="">All rows</option><option value="no">Not listed by code or parent</option><option value="yes">Code or parent listed</option></select></label></div>
<noscript><p>JavaScript is off, so the filters are unavailable. All rows are still listed below; use your browser’s Find command to locate text or codes.</p></noscript>
<p id="edit-count" aria-live="polite">{len(rows)} changed or new benchmark rows</p><p id="no-results" class="no-results" hidden>No rows match those filters. Clear the search or choose “All” in the filters.</p>
<div class="edits-scroll"><table id="edits-table"><caption>First-round and October 26 benchmark wording, current code, locator, and FDOE table status</caption>
<thead><tr><th scope="col">October 26 code</th><th scope="col">First-round text / match</th><th scope="col">October 26 text</th><th scope="col">FDOE table check</th></tr></thead><tbody>{''.join(table_rows)}</tbody></table></div>
<h2>How to read the change labels</h2><ul><li><strong>Existing code · wording changed:</strong> the same code has a revised sentence, with no exact sentence match elsewhere.</li><li><strong>Existing code · prior text moved:</strong> this current code carries a sentence that appeared under a different code in the first round.</li><li><strong>New code · carries earlier text:</strong> a new code carries an exact sentence from the first-round draft; it is not treated as a new concept.</li><li><strong>New code · no exact earlier sentence:</strong> no exact first-round sentence match was found. That does not establish conceptual novelty.</li></ul>
<p>The exact-text comparison uses Unicode normalization and whitespace normalization. “FDOE code or parent listed” records whether the Table of Edits names the current code or a standard code covering it; it does not judge the adequacy of FDOE’s rationale. Counts and limitations are described in the <a href="oct26-complete-change-review.html">change review</a>.</p></main>
<footer class="docfooter"><a href="../../index.html">Review hub</a> · Benchmark-level change resource · <a href="oct26-complete-change-review.html">Method and limits</a></footer>
<script>
(()=>{{const search=document.getElementById('edits-search'),grade=document.getElementById('edits-grade'),fdoe=document.getElementById('edits-fdoe'),rows=[...document.querySelectorAll('#edits-table tbody tr')],count=document.getElementById('edit-count'),empty=document.getElementById('no-results');
function filterRows(){{const term=search.value.trim().toLocaleLowerCase(),g=grade.value,f=fdoe.value;let visible=0;for(const row of rows){{const show=(!term||row.dataset.search.toLocaleLowerCase().includes(term))&&(!g||row.dataset.grade===g)&&(!f||row.dataset.fdoe===f);row.hidden=!show;if(show)visible++;}}count.textContent=`${{visible}} of ${{rows.length}} rows shown`;empty.hidden=visible!==0;}}
search.addEventListener('input',filterRows);grade.addEventListener('change',filterRows);fdoe.addEventListener('change',filterRows);}})();
</script></body></html>'''


def main():
    with SOURCE.open(newline="", encoding="utf-8") as source_file:
        source_rows = list(csv.DictReader(source_file))

    changed_rows = [
        row for row in source_rows
        if row["change_class"] != "shared_id_identical_text"
    ]
    if len(changed_rows) != 110 or len({r["current_id"] for r in changed_rows}) != 110:
        raise SystemExit("Unexpected changed-row count; inspect source crosswalk before publishing.")

    public_rows = []
    with OUTPUT.open("w", newline="", encoding="utf-8") as output_file:
        writer = csv.DictWriter(output_file, fieldnames=FIELDS, lineterminator="\n")
        writer.writeheader()
        for row in changed_rows:
            exact_reindex = row["change_class"] in {
                "shared_id_sentence_reindexed",
                "new_id_exact_sentence_reindexed",
            }
            public_row = {
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
            }
            writer.writerow(public_row)
            public_rows.append(public_row)

    PAGE.write_text(render_html(public_rows), encoding="utf-8")

    print(f"Wrote {len(changed_rows)} changed/new benchmark rows to {OUTPUT.name}.")
    print(f"Wrote searchable reader page to {PAGE.name}.")
    print(f"FDOE table does not list {len(UNLISTED_BY_FDOE_CODE_OR_PARENT)} codes or their parent standards.")


if __name__ == "__main__":
    main()
