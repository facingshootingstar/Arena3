"""Acceptance checklist of docs/SRS-FPT-Template-Rules.md section 9 for SRS v2.3.

Run from the repository root after the build (build_v23.py runs it last):  python scripts/srs_pipeline/check23.py
Exits with 1 when any item fails.
"""

import glob
import html
import re
import sys
import xml.etree.ElementTree as ET

import pymupdf

sys.path.insert(0, "scripts/srs_pipeline")
from srs23_data import SCREENS, UC_SCREENS  # noqa: E402

src = open("docs/srs-v2.3/build/final.html", encoding="utf-8").read()
pdf = pymupdf.open("docs/Arena3-SRS-v2.3.pdf")
res = []


def ok(name, cond, detail=""):
    res.append((name, bool(cond), detail))


def plain(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def section(start, end):
    i = src.index(start)
    j = src.index(end, i)
    return src[i:j]


def tables(chunk):
    return re.findall(r"<table[^>]*>.*?</table>", chunk, flags=re.S)


def heads(t):
    return [plain(h) for h in re.findall(r"<th>(.*?)</th>", t, flags=re.S)]


def rows(t):
    body = t.split("<tbody>")[1]
    return [[plain(c) for c in re.findall(r"<td>(.*?)</td>", r, flags=re.S)]
            for r in re.findall(r"<tr>(.*?)</tr>", body, flags=re.S)]


main = src[src.index("<main>"):]

# 1 cover
cov = open("scripts/srs_pipeline/cover23.html", encoding="utf-8").read()
names = ["Nguyễn Văn Trọng Hiếu", "Đặng Trang Thanh Sử", "Nguyễn Trọng Toàn", "Phạm Duy Tân", "Nguyễn Hoàng Phúc"]
pos = [cov.find(n) for n in names]
ok("1 Cover layout and data", -1 not in pos and pos == sorted(pos) and "Tôn Thất Hoàng Minh" in cov
   and "- HCM, 10/2026 -" in cov and "MINISTRY OF EDUCATION AND TRAINING" in cov
   and "Sport Center Management System" in cov and "fpt-logo.png" in cov
   and not re.search(r"Leader|Ext Supervisor|MSSV|Capstone|SE\d{6}", cov))

# 2 acronyms
skip = {"GET", "POST", "PRE", "II", "III", "IV", "TBD"}
defs = section("Definition and Acronyms</h1>", "</table>")
defined = set(re.findall(r"<tr><td>([A-Z]+)</td>", defs))
used = set(re.findall(r"(?<![\w-])([A-Z]{2,7})(?![\w-])", plain(re.sub(r"<code>.*?</code>", " ", main))))
missing = sorted(used - defined - skip)
ok("2 Every acronym in the body is defined", not missing, ", ".join(missing))
need = {"API", "BR", "ERD", "NFR", "OTP", "QR", "SDD", "SRS", "UC", "UI", "VND", "SMTP", "AI", "JSON", "HTTPS"}
ok("2 Minimum acronym set", need <= defined, ", ".join(sorted(need - defined)))
used_all = set(re.findall(r"(?<![\w])([A-Z]{2,7})(?![\w])", plain(src)))
unused = sorted(defined - used_all - need - {"PK", "FK"})
ok("2 No defined acronym unused", not unused, ", ".join(unused))

# 3 heading tree
hs = [plain(t) for _, t in re.findall(r'<h([1-5]) id="h\d+"[^>]*>(.*?)</h\1>', main, flags=re.S)]
fixed = """I. Software Requirement Specification|1. Product Overview|2. User Requirements|2.1 Actors|2.2 Use Cases|
2.2.1 Diagram(s)|2.2.1.1 Account and Access|2.2.1.2 Member Court Booking and Payment|2.2.1.3 Member Classes and Training|
2.2.1.4 Front Desk Sales|2.2.1.5 Front Desk Operations|2.2.1.6 Coach|2.2.1.7 Manager Setup|2.2.1.8 Manager Oversight|
2.2.2 Descriptions|3. Functional Requirements|3.1 System Functional Overview|3.1.1 Screens Flow|3.1.1.1 Public Site|
3.1.1.2 Member Portal|3.1.1.3 Front Desk Portal|3.1.1.4 Coach Portal|3.1.1.5 Manager Portal|3.1.2 Screen Descriptions|
3.1.2.1 Public Site|3.1.2.2 Member Portal|3.1.2.3 Front Desk Portal|3.1.2.4 Coach Portal|3.1.2.5 Manager Portal|
3.1.3 Screen Authorization|3.1.4 Non-Screen Functions|3.1.5 Entity Relationship Diagram|
3.1.5.1 Conceptual Entity Relationship Diagram|3.1.5.2 Logical Entity Relationship Diagram|Entities Description|
3.2 Account and Access|3.3 Member Court Booking and Payment|3.4 Member Classes and Training|3.5 Front Desk Sales|
3.6 Front Desk Operations|3.7 Coach Teaching and Earnings|3.8 Manager Setup|3.9 Manager Oversight|
4. Non-Functional Requirements|4.1 External Interfaces|4.1.1 User Interface|4.1.2 Communications Interfaces|
4.2 Quality Attributes|4.2.1 Usability|4.2.2 Reliability|4.2.3 Performance|4.2.4 Security|4.2.5 Auditability|
4.2.6 Maintainability|5. Requirement Appendix|5.1 Business Rules|5.2 Common Requirements|Error Responses|
Configurable Settings|5.3 Application Messages List|II. Software Design Description|1. System Design|
1.1 System Architecture|1.2 Package Diagram|Package Descriptions|2. Database Design|Table Descriptions|
3. Detailed Design|3.1 Booking and Payment|3.1.1 Class Diagram|3.1.2 Sequence Diagram|3.2 Membership and Classes|
3.2.1 Class Diagram|3.2.2 Sequence Diagram|3.3 Coaching and Training|3.3.1 Class Diagram|3.3.2 Sequence Diagram|
3.4 Centre Operations|3.4.1 Class Diagram|3.4.2 Sequence Diagram""".replace("\n", "").split("|")
ii = hs.index("II. Software Design Description")
uc_heads = [t for t in hs[:ii] if re.match(r"3\.[2-9]\.\d+ ", t)]
nonuc = [t for t in hs if t not in uc_heads]
diff = [(a, b) for a, b in zip(nonuc, fixed) if a != b]
ok("3 Heading tree matches rules section 2", nonuc == fixed, f"{diff[:3]} {len(nonuc)} vs {len(fixed)}")
groups = {2: (1, 6), 3: (7, 12), 4: (13, 17), 5: (18, 24), 6: (25, 29), 7: (30, 35), 8: (36, 40), 9: (41, 44)}
exp = [f"3.{g}.{k}" for g, (a, b) in groups.items() for k in range(1, b - a + 2)]
ok("3 Use case headings 3.2.1 to 3.9.4", [t.split()[0] for t in uc_heads] == exp, str(len(uc_heads)))
old = ["overall requirements", "main workflows", "use case list", "use case specifications", "centre settings"]
ok("3 No old headings", not [t for t in hs if any(t.lower().endswith(o) for o in old)])
ok("3 Headings are Title Case", not [t for t in hs if re.search(r" (?!and |of |or |the |a |in |to |for )[a-z]", t)
                                    and not t.startswith(("3.2.", "3.3.", "3.4.", "3.5.", "3.6.", "3.7.", "3.8.", "3.9."))],
   str([t for t in hs if re.search(r" (?!and |of |or |the |a |in |to |for )[a-z]", t)][:5]))

# 4 counts
actors = rows(tables(section("2.1 Actors</h3>", "2.2 Use Cases</h3>"))[0])
desc = rows(tables(section("2.2.2 Descriptions</h4>", "3. Functional Requirements</h2>"))[0])
brs = rows(tables(section("5.1 Business Rules</h3>", "5.2 Common Requirements</h3>"))[0])
nfr_ids = re.findall(r"<tr><td>(NFR-\d\d)</td>", section("4. Non-Functional Requirements</h2>", "5. Requirement Appendix</h2>"))
msgs = rows(tables(section("5.3 Application Messages List</h3>", "II. Software Design Description</h1>"))[0])
scr = sum(len(rows(t)) for t in tables(section("3.1.2 Screen Descriptions</h4>", "3.1.3 Screen Authorization</h4>")))
ns = rows(tables(section("3.1.4 Non-Screen Functions</h4>", "3.1.5 Entity Relationship Diagram</h4>"))[0])
ent = rows(tables(section(">Entities Description</h5>", "3.2 Account and Access</h3>"))[0])
tds = rows(tables(section(">Table Descriptions</h", "3. Detailed Design</h2>"))[0])
figs = [int(n) for n in re.findall(r"<figcaption><b>Figure (\d+)\.</b>", src)]
c = dict(actors=len(actors), uc=len(desc), br=len(brs), nfr=len(set(nfr_ids)), msg=len(msgs), screens=scr,
         nonscreen=len(ns), entities=len(ent), tables=len(tds), figures=len(figs))
ok("4 Counts", (c["actors"], c["uc"], c["br"], c["nfr"], c["msg"], c["screens"], c["nonscreen"]) ==
   (9, 44, 53, 26, 21, 44, 11) and c["entities"] >= 17 and c["figures"] == 41, str(c))
ok("4 Actor order", [r[1] for r in actors] == ["Guest", "Registered User", "Member", "Receptionist", "Coach", "Manager",
                                              "payOS", "Mail delivery (SMTP)", "Gemini AI"], str([r[1] for r in actors]))
ok("4 IDs BR-01..53, UC-01..44", [r[0] for r in brs] == [f"BR-{i:02d}" for i in range(1, 54)]
   and [r[0] for r in desc] == [f"UC-{i:02d}" for i in range(1, 45)])

# 5 use case names in three places
ovals = set()
for f in sorted(glob.glob("docs/diagrams/srs/0[3-9]-*.drawio") + glob.glob("docs/diagrams/srs/10-*.drawio")):
    for cell in ET.parse(f).getroot().iter("mxCell"):
        if "ellipse" in (cell.get("style") or "") and cell.get("value"):
            v = re.sub(r"<br\s*/?>", " ", html.unescape(cell.get("value")))
            ovals.add(plain(v).lower())
tbl = [r[1].lower() for r in desc]
hd = [t.split(" ", 1)[1].lower() for t in uc_heads]
bad = [i + 1 for i in range(44) if not (tbl[i] == hd[i] and tbl[i] in ovals)]
ok("5 Use case names match in oval, 2.2.2 and 3.x.y", not bad and len(ovals) == 44, f"bad={bad} ovals={len(ovals)}")

# 6 five blocks
uc_part = section("3.2 Account and Access</h3>", "4. Non-Functional Requirements</h2>")
ucs = re.split(r'<h4 id="h\d+">(?:<span class="mk">[^<]*</span>)?(?=3\.[2-9]\.\d+ )', uc_part)[1:]
labels = ["Function Trigger:", "Function Description:", "Use Case ID:", "Actors:", "Purpose:", "Interface:",
          "Data Processing:", "Data Collect:", "Data Computation:", "Screen Layout:", "Function Details:", "Normal Flow"]
scr_labels = {n: f"{name} ({route})" for n, _, _, name, route, _ in SCREENS}
badb = []
for i, u in enumerate(ucs, 1):
    t = plain(u)
    idx = [t.find(lab) for lab in labels]
    if -1 in idx or idx != sorted(idx) or not re.search(r"Data (Storage|Binding):", t) or f"UC-{i:02d}" not in t:
        badb.append(i)
        continue
    iface = html.unescape(re.search(r"Interface:</b>\s*(.*?)</li>", u).group(1))
    if iface != "; ".join(scr_labels[s] for s in UC_SCREENS[i]):
        badb.append(i)
ok("6 Five blocks in order, Interface matches 3.1.2", not badb and len(ucs) == 44, f"bad={badb} n={len(ucs)}")
shots = re.findall(r'<div class="shot"><img[^>]*alt="([^"]*)"', uc_part)
ok("6 Screen layout image per use case, alt not 'Figure'", len(shots) == 44 and not [a for a in shots if a.startswith("Figure")],
   str(len(shots)))

# 7 table columns
checks = [
    ("2.1 Actors</h3>", "2.2 Use Cases</h3>", ["#", "Actor", "Description"]),
    ("2.2.2 Descriptions</h4>", "3. Functional Requirements</h2>", ["ID", "Use Case", "Actors", "Use Case Description"]),
    ("3.1.2 Screen Descriptions</h4>", "3.1.3 Screen Authorization</h4>", ["#", "Feature", "Screen", "Description"]),
    ("3.1.3 Screen Authorization</h4>", "3.1.4 Non-Screen Functions</h4>",
     ["Screen", "Guest", "Member", "Receptionist", "Coach", "Manager"]),
    ("3.1.4 Non-Screen Functions</h4>", "3.1.5 Entity Relationship Diagram</h4>",
     ["#", "Feature", "System Function", "Description"]),
    (">Entities Description</h5>", "3.2 Account and Access</h3>", ["#", "Entity", "Description"]),
    (">Table Descriptions</h", "3. Detailed Design</h2>", ["#", "Entity", "Description"]),
    ("5.1 Business Rules</h3>", "5.2 Common Requirements</h3>", ["ID", "Rule Definition"]),
    ("5.3 Application Messages List</h3>", "II. Software Design Description</h1>",
     ["Message ID", "Message Text", "Message Type", "Context/Trigger"]),
    ("4.2 Quality Attributes</h3>", "5. Requirement Appendix</h2>", ["ID", "Requirement"]),
    (">Package Descriptions</h", "2. Database Design</h2>", ["No", "Package Name", "Description"]),
    ("Record of Changes</h1>", "</section>", ["Date", "Version", "A/M/D", "In charge", "Description"]),
]
badc = []
for a, b, expc in checks:
    ts = tables(section(a, b))
    if not ts:
        badc.append((a, "no table"))
    for t in ts:
        if heads(t) != expc or any(len(r) != len(expc) for r in rows(t)):
            badc.append((a, heads(t)))
ok("7 Table columns as in rules section 4", not badc, str(badc[:3]))
spec_tables = re.findall(r'<table class="t spec">.*?</table>', src, flags=re.S)
fields = ["ID and Name", "Created By", "Date Created", "Primary Actor", "Secondary Actors", "Trigger", "Description",
          "Preconditions", "Postconditions", "Priority", "Frequency of Use", "Business Rules"]
ok("7 Field/Detail rows use the SJ labels", len(spec_tables) == 44 and all([r[0] for r in rows(t)] == fields
                                                                          for t in spec_tables))
pre = all(re.search(r"PRE-1\.", t) and re.search(r"POST-1\.", t) or "None." in t for t in spec_tables)
ok("7 PRE-n / POST-n", pre)
auth = section("3.1.3 Screen Authorization</h4>", "3.1.4 Non-Screen Functions</h4>")
empty = src.replace(auth, "").count("<td></td>")
ok("7 No empty cells outside 3.1.3", empty == 0, str(empty))
ok("7 Authorization has 44 screen rows", auth.count("&lt;&lt;") == 44, str(auth.count("&lt;&lt;")))
ent_ok = all(r[2].startswith("Store ") and "Primary Key:" in r[2] and "Foreign Key:" in r[2] for r in ent + tds)
ok("7 Entity descriptions: Store ..., Primary Key, Foreign Key", ent_ok)
mid_ok = all(re.fullmatch(r"(MSG|ERR|INFO|WARN)_(AUTH|PROF|BOOK|PAY|PLAN|CLASS|CHECKIN|GEAR|MAINT|SUPPORT|COACH|ADMIN|REPORT)_\d\d",
                          r[0]) and r[2] in ("Success", "Error", "Validation", "Information", "Warning")
             and re.search(r"\(was MSG\d\d[^)]*\)$", r[3]) for r in msgs)
ok("7 Message ID, Type and (was ...) format", mid_ok)

# 8 traceability
cited = set()
for t in spec_tables:
    cited |= set(re.findall(r"BR-\d\d", rows(t)[-1][1]))
ok("8 Every BR cited in a Business Rules row", cited >= {f"BR-{i:02d}" for i in range(1, 54)},
   ", ".join(sorted({f"BR-{i:02d}" for i in range(1, 54)} - cited)))
flows = "".join(re.findall(r'<div class="flow">.*?</div>', uc_part, flags=re.S))
unc = [r[0] for r in msgs if r[0] not in flows]
ok("8 Every Message ID cited by a flow", not unc, ", ".join(unc))
flow_br = set(re.findall(r"BR-\d\d", flows))
in_rows_not_flows = 0
see_fmt = not re.search(r"\(see [^)]*\) \(see ", flows)
ok("8 '(see n.0.Ek)' markers merged", see_fmt)
alt_end = all(re.search(r"(Return to step \d+ of the Normal Flow\.|The use case ends\.)", b)
              for b in re.split(r'<p class="fn">', flows)[1:] if "<ol>" in b and ".0 " not in b[:12])
ok("8 Each alternative/exception ends with return or end", alt_end)

# 9 old message codes
msg_sec = section("5.3 Application Messages List</h3>", "II. Software Design Description</h1>")
rest = plain(src.replace(msg_sec, ""))
olds = re.findall(r"\bMSG\d\d\b", rest)
ok("9 No old MSGnn outside the (was ...) notes", not olds, str(olds[:5]))

# 10 figures
ok("10 Figures numbered 1..41 in order", figs == list(range(1, 42)))
first = {}
for m in re.finditer(r"Figure (\d+)", main):
    first.setdefault(int(m.group(1)), m.start())
cap = {int(m.group(1)): m.start() for m in re.finditer(r"<figcaption><b>Figure (\d+)\.</b>", main)}
late = [n for n in figs if first.get(n, 10 ** 9) >= cap[n]]
ok("10 Every figure is mentioned before it appears", not late, str(late))
ok("10 Caption below each figure", len(re.findall(r"<img[^>]*>\s*<figcaption>", src)) == 41)
lof = section("List of Figures</h1>", "</section>")
lof_items = re.findall(r'Figure (\d+)\. (.*?)</span><span class="dots"></span><span class="pn">(\d+)</span>', lof)
caps = re.findall(r"<figcaption><b>Figure (\d+)\.</b> (.*?)</figcaption>", src)
ok("10 List of Figures matches captions", [(a, plain(b)) for a, b, _ in lof_items] == [(a, plain(b)) for a, b in caps],
   str(len(lof_items)))
cpage = {}
for i, pg in enumerate(pdf):
    if i >= 7:
        for m in re.finditer(r"Figure (\d+)\. ", pg.get_text()):
            cpage.setdefault(int(m.group(1)), i + 1)
wrongp = [(a, p, cpage.get(int(a))) for a, _, p in lof_items if int(p) != cpage.get(int(a))]
ok("10 List of Figures page numbers", not wrongp, str(wrongp[:4]))
tocsec = section("Table of Contents</h1>", "</section>")
tl = re.findall(r'<span class="tx">(.*?)</span><span class="dots"></span><span class="pn">(\d+)</span>', tocsec)
missp = [(html.unescape(t), p) for t, p in tl
         if html.unescape(t) not in re.sub(r"\s+", " ", pdf[int(p) - 1].get_text())]
ok("10 TOC headings are on the pages listed", not missp and len(tl) == 124, f"{missp[:3]} n={len(tl)}")
bm = {t: p for _, t, p in pdf.get_toc()}
wrongt = [(html.unescape(t), p) for t, p in tl if bm.get(html.unescape(t)) != int(p)]
ok("10 TOC agrees with PDF bookmarks", not wrongt, str(wrongt[:3]))

# 11 draw.io structure
badx = []
files = sorted(glob.glob("docs/diagrams/srs/*.drawio"))
for f in files:
    raw = open(f, encoding="utf-8").read()
    if "<!--" in raw or "mermaid" in raw.lower():
        badx.append((f, "comment/mermaid"))
    root = ET.fromstring(raw)
    cells = list(root.iter("mxCell"))
    ids = [c.get("id") for c in cells]
    if len(ids) != len(set(ids)):
        badx.append((f, "dup id"))
    verts = {c.get("id") for c in cells if c.get("vertex") == "1"}
    for c in cells:
        if c.get("id") in ("0", "1"):
            continue
        if c.get("vertex") != "1" and c.get("edge") != "1":
            badx.append((f, "neither", c.get("id")))
        if c.find("mxGeometry") is None:
            badx.append((f, "no geometry", c.get("id")))
        if c.get("edge") == "1" and (c.get("source") not in verts or c.get("target") not in verts):
            badx.append((f, "edge end", c.get("id")))
ok("11 draw.io XML rules (41 files)", len(files) == 41 and not badx, str(badx[:3]) + f" files={len(files)}")
ok("11 No Mermaid in the document", "mermaid" not in src.lower())

# 12 pages
sizes = {(round(p.rect.width), round(p.rect.height)) for p in pdf}
ok("12 All pages A4 portrait 595x842", sizes == {(595, 842)}, str(sizes))
M = len(pdf)
foot = [i + 1 for i, p in enumerate(pdf) if i > 0 and f"Page {i + 1} of {M}" not in p.get_text().replace("\xa0", " ")]
ok("12 Footer 'Page N of M'", not foot, str(foot[:5]))
ok("12 No rotated page", not [p for p in pdf if p.rotation])
imgs_rot = []
for i, p in enumerate(pdf):
    for info in p.get_image_info():
        tr = info.get("transform")
        if tr and (abs(tr[1]) > 1e-3 or abs(tr[2]) > 1e-3):
            imgs_rot.append(i + 1)
ok("12 No rotated image", not imgs_rot, str(imgs_rot[:5]))

# 13 record of changes
roc = section("Record of Changes</h1>", "</table>")
ok("13 Record of Changes has the 2.3 row and footnote", "<td>2.3</td>" in roc
   and "*A – Added, M – Modified, D – Deleted" in src)

# style rule 7: no should / may / etc. in requirements
req = plain(main)
sm = re.findall(r"[^.]*\b(should|etc\.)[^.]*\.", req)
ok("Style: no 'should' or 'etc.'", not sm, str(sm[:3]))
rules = plain(section("4. Non-Functional Requirements</h2>", "5.2 Common Requirements</h3>"))
may_req = re.findall(r"[^.]{0,60}\bmay\b[^.]{0,60}", rules)
ok("Style: no 'may' in the NFR and BR tables", not may_req, str(may_req[:3]))
may = re.findall(r"[^.]{0,60}\bmay\b[^.]{0,60}", req)
print(f"info: {len(may)} other uses of 'may' (an option open to an actor):")
for m in may:
    print("   ", m.strip())

for n, g, d in res:
    print("PASS" if g else "FAIL", n, "" if g else "-> " + d)
print(sum(g for _, g, _ in res), "/", len(res), "passed")
sys.exit(0 if all(g for _, g, _ in res) else 1)
