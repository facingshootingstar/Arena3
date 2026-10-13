"""Build docs/Arena3-SRS-v2.3.pdf:  python scripts/srs_pipeline/build_v23.py

Two passes: the first print finds the page of every heading and figure, the second fills the Table of Contents
and the List of Figures. The cover is printed on its own and merged in front. Needs node_modules (playwright)
and Chrome; the screen shots come from shoot_screens.mjs. The last step runs the section 9 checklist
(check23.py), which fails the build when an item fails.
"""

import json
import os
import re
import subprocess
import sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
WORK = os.path.join(ROOT, "docs", "srs-v2.3", "build")
OUT = os.path.join(ROOT, "docs", "Arena3-SRS-v2.3.pdf")
os.makedirs(WORK, exist_ok=True)
env = dict(os.environ, PYTHONIOENCODING="utf-8")


def run(*cmd):
    print("$", " ".join(os.path.basename(c) if os.path.isabs(c) else c for c in cmd))
    r = subprocess.run(cmd, cwd=ROOT, env=env, capture_output=True, text=True, encoding="utf-8")
    sys.stdout.write(r.stdout)
    if r.returncode:
        sys.stderr.write(r.stderr)
        sys.exit(r.returncode)


def w(name):
    return os.path.join(WORK, name)


py, node = sys.executable, "node"
run(py, os.path.join(HERE, "gen_srs23.py"), w("pass1.html"))
run(node, os.path.join(HERE, "print23.mjs"), w("pass1.html"), w("pass1.pdf"))
pages = {}
for i, p in enumerate(pymupdf.open(w("pass1.pdf"))):
    for key in re.findall(r"@@((?:h|fig)\d+)@@", p.get_text()):
        pages.setdefault(key, i + 1)
json.dump(pages, open(w("pages.json"), "w"))
run(py, os.path.join(HERE, "gen_srs23.py"), w("final.html"), w("pages.json"))
run(node, os.path.join(HERE, "print23.mjs"), w("final.html"), w("body.pdf"))
# the page count must not move between passes, or the numbers in the contents are wrong
n1, n2 = len(pymupdf.open(w("pass1.pdf"))), len(pymupdf.open(w("body.pdf")))
assert n1 == n2, f"pass 1 has {n1} pages, pass 2 has {n2}"
run(node, os.path.join(HERE, "print23.mjs"), os.path.join(HERE, "cover23.html"), w("cover.pdf"))
run(py, os.path.join(HERE, "merge23.py"), w("cover.pdf"), w("body.pdf"), OUT, w("pages.json"), w("final.html"))
run(py, os.path.join(HERE, "check23.py"))
