"""Build the SRS v2.3 print HTML from the v2.2 text (doc-nb.txt) in the FPT template's structure.

python gen_srs23.py <out.html> [pages.json]

Without pages.json every heading and figure carries a hidden @@marker@@ so a first print can find its page;
with it, the Table of Contents and the List of Figures get page numbers. The content is the v2.2 text, moved
and reformatted to docs/SRS-FPT-Template-Rules.md; srs23_data.py holds the template blocks v2.2 lacked.
"""

import html
import json
import os
import re
import sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "scripts", "srs_diagrams"))
sys.path.insert(0, HERE)

import architecture  # noqa: E402
import dbschema  # noqa: E402
import srs23_data as D  # noqa: E402
from usecase import UC as UC_NAME  # noqa: E402

PNG = os.path.join(ROOT, "docs", "diagrams", "srs")
SHOTS = os.path.join(ROOT, "docs", "srs-v2.3", "screens")
out_path = sys.argv[1]
pages = json.load(open(sys.argv[2], encoding="utf-8")) if len(sys.argv) > 2 else None
LINES = open(os.path.join(HERE, "doc-nb.txt"), encoding="utf-8").read().split("\n")

# ---------------------------------------------------------------- reading the v2.2 text


def find(prefix, start=0):
    for i in range(start, len(LINES)):
        if LINES[i].startswith(prefix):
            return i
    raise KeyError(prefix)


def block(start_prefix, end_prefix, after=0):
    a = find(start_prefix, after)
    b = find(end_prefix, a + 1)
    return LINES[a + 1:b]


def rows(lines):
    out = []
    for ln in lines:
        if ln.startswith("| "):
            cells = [c.strip() for c in ln.strip()[1:-1].split(" | ")]
            out.append(cells)
    return out


def table_after(prefix, after=0):
    i = find(prefix, after)
    j = i
    while j < len(LINES) and LINES[j].startswith("| "):
        j += 1
    return rows(LINES[i:j])


def unmd(s):
    return s.replace("\\_", "_").replace("&#91;", "[").replace("\\]", "]")


# ---------------------------------------------------------------- wording fixes (rule 7: requirements say "must")

REWORD = {
    "No two bookings may own the same court time, under any concurrency.":
        "Two bookings must never own the same court time, under any concurrency.",
    "No coach may be scheduled into two overlapping sessions.":
        "A coach must never be scheduled into two overlapping sessions.",
    "A member account may be created only after the person accepts the terms of use and the data-privacy notice.":
        "A member account must be created only after the person accepts the terms of use and the data-privacy "
        "notice.",
    "A member may book a court at most 7 days ahead and may hold at most 2 court slots on the same day.":
        "A member must not book a court more than 7 days ahead or hold more than 2 court slots on the same day.",
    "A slot that overlaps one of the member's classes may be held only after the member confirms the clash.":
        "A slot that overlaps one of the member's classes must be held only after the member confirms the clash.",
    "A plan may be frozen for no more than the yearly freeze allowance (30 days by default).":
        "A plan must not be frozen for longer than the yearly freeze allowance (30 days by default).",
    "A member may enrol only in a class whose status is open.":
        "A member must enrol only in a class whose status is open.",
    "A member may leave a class only up to 4 hours before its next session.":
        "A member must leave a class no later than 4 hours before its next session.",
    "A session register locks 2 hours after the session; afterwards only a manager may correct it, and must give a "
    "reason.":
        "A session register locks 2 hours after the session; after that, a correction must come from a manager and "
        "must give a reason.",
    "Money may be taken at the desk only within the receptionist's open cashier shift.":
        "Money taken at the desk must belong to the receptionist's open cashier shift.",
    "A coach may act only on classes that the coach leads or assists.":
        "A coach must act only on classes that the coach leads or assists.",
    "Gear may not be rented out beyond the stock on hand.":
        "Gear must not be rented out beyond the stock on hand.",
    # rule 7: one name per actor (UC-28)
    "Staff notice a fault and open Maintenance (/desk/maintenance).":
        "A receptionist or a manager notices a fault and opens Maintenance (/desk/maintenance).",
    "The user is signed in as a receptionist or a manager.": "The receptionist or the manager is signed in.",
    "Staff give back all or part of a posted payment, and large refunds wait for a second person.":
        "The receptionist gives back all or part of a posted payment, and a large refund waits for a manager's "
        "approval.",
    # actor description corrected to the code (v2.2.1)
    "Google's model. Answers member questions and drafts training plans from centre data only.":
        "Google's model. Answers member questions from centre data only.",
}


def reword(s):
    for old, new in REWORD.items():
        s = s.replace(old, new)
    return s


# ---------------------------------------------------------------- HTML helpers

def esc(s):
    return html.escape(s, quote=False)


def inline(s):
    """Markdown inline (code, bold) to HTML, after escaping."""
    s = esc(unmd(s))
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", s)
    return s


OUT = []
HEADS = []
FIGS = []
mark_n = [0]
head_n = [0]


def emit(s):
    OUT.append(s)


def mark(key):
    return "" if pages else f'<span class="mk">@@{key}@@</span>'


def heading(level, text, numbered=True, toc=True, cls=""):
    hid = f"h{head_n[0]}"
    head_n[0] += 1
    if toc:
        HEADS.append((hid, level, text))
    c = f' class="{cls}"' if cls else ""
    emit(f'<h{level} id="{hid}"{c}>{mark(hid)}{esc(text)}</h{level}>')


def para(text, raw=False):
    emit(f"<p>{text if raw else inline(text)}</p>")


def table(head, body, cls="t", widths=None, raw=False):
    out = [f'<table class="{cls}">']
    if widths:
        out.append("<colgroup>" + "".join(f'<col style="width:{w}">' for w in widths) + "</colgroup>")
    out.append("<thead><tr>" + "".join(f"<th>{esc(h)}</th>" for h in head) + "</tr></thead><tbody>")
    for r in body:
        out.append("<tr>" + "".join(f"<td>{c if raw else inline(c)}</td>" for c in r) + "</tr>")
    out.append("</tbody></table>")
    emit("".join(out))


def bullets(items, raw=False):
    emit("<ul>" + "".join(f"<li>{i if raw else inline(i)}</li>" for i in items) + "</ul>")


# figures in reading order; each is mentioned in the text before it appears
FIG_ORDER = [
    ("01-context-diagram", "Context diagram of the Arena3 Sports Centre Management System"),
    ("03-uc-account", "Use case diagram: Account and Access"),
    ("04-uc-member-booking", "Use case diagram: Member Court Booking and Payment"),
    ("05-uc-member-classes", "Use case diagram: Member Classes and Training"),
    ("06-uc-desk-sales", "Use case diagram: Front Desk Sales"),
    ("07-uc-desk-operations", "Use case diagram: Front Desk Operations"),
    ("08-uc-coach", "Use case diagram: Coach"),
    ("09-uc-manager-setup", "Use case diagram: Manager Setup"),
    ("10-uc-manager-oversight", "Use case diagram: Manager Oversight"),
    ("24-sf-public", "Screens flow: Public Site"),
    ("25-sf-member", "Screens flow: Member Portal"),
    ("26-sf-receptionist", "Screens flow: Front Desk Portal"),
    ("27-sf-coach", "Screens flow: Coach Portal"),
    ("28-sf-manager", "Screens flow: Manager Portal"),
    ("19-erd-conceptual", "Conceptual ERD: courts, bookings and payments"),
    ("44-erd-conceptual-2", "Conceptual ERD: members, plans and classes"),
    ("31-erd-logical-1-accounts", "Logical ERD, part 1: accounts and platform"),
    ("32-erd-logical-2-courts", "Logical ERD, part 2: courts and bookings"),
    ("33-erd-logical-3-payments", "Logical ERD, part 3: payments, plans and promotions"),
    ("34-erd-logical-4-classes", "Logical ERD, part 4: classes, attendance and training"),
    ("35-erd-logical-5-coaching", "Logical ERD, part 5: coaching records and pay"),
    ("11-ad-register", "Activity diagram: Register a Member Account"),
    ("12-ad-book-and-pay", "Activity diagram: Book a Court and Pay"),
    ("13-ad-enrol-waitlist", "Activity diagram: Enrol in a Class or Join the Waitlist"),
    ("14-ad-refund", "Activity diagram: Raise and Approve a Refund"),
    ("38-system-architecture", "System architecture"),
    ("39-package-diagram", "Package diagram"),
    ("20-cd-booking-payment", "Class diagram: courts and bookings"),
    ("40-cd-booking-payment-2", "Class diagram: payments"),
    ("16-sd-book-and-pay", "Sequence diagram: book a court and pay by payOS QR"),
    ("18-sd-refund", "Sequence diagram: raise and approve a refund"),
    ("21-cd-membership-classes", "Class diagram: membership plans"),
    ("41-cd-membership-classes-2", "Class diagram: classes and attendance"),
    ("36-sd-enrol-class", "Sequence diagram: enrol in a class"),
    ("22-cd-coaching", "Class diagram: coach and member roles"),
    ("42-cd-coaching-2", "Class diagram: coach pay, plans and homework"),
    ("37-sd-take-attendance", "Sequence diagram: take session attendance"),
    ("23-cd-operations", "Class diagram: accounts and member care"),
    ("43-cd-operations-2", "Class diagram: centre and equipment"),
    ("15-sd-register", "Sequence diagram: register a member account"),
    ("17-sd-gate-checkin", "Sequence diagram: check a member in at the gate"),
]
FNUM = {key: i + 1 for i, (key, _) in enumerate(FIG_ORDER)}


def F(key):
    return f"Figure {FNUM[key]}"


def file_url(path):
    return "file:///" + path.replace("\\", "/").replace(" ", "%20")


def figure(key):
    n = FNUM[key]
    title = dict(FIG_ORDER)[key]
    assert len(FIGS) == n - 1, (key, n, len(FIGS))
    path = os.path.join(PNG, key + ".png")
    pix = pymupdf.Pixmap(path)
    ratio = pix.height / pix.width
    fid = f"fig{n}"
    FIGS.append((fid, n, title))
    cls = "tall" if ratio > 1.25 else ("mid" if ratio > 0.8 else "wide")
    emit(f'<figure class="fig {cls}" id="{fid}">{mark(fid)}<img src="{file_url(path)}" alt="">'
         f"<figcaption><b>Figure {n}.</b> {esc(title)}</figcaption></figure>")


def shot(screen_n, label):
    png = os.path.join(SHOTS, f"s{screen_n:02d}.png")
    # screen shots go in as JPEG: lossless PNG photos would make the PDF several times larger
    path = os.path.join(os.path.dirname(os.path.abspath(out_path)), "shots", f"s{screen_n:02d}.jpg")
    if not os.path.exists(path) or os.path.getmtime(path) < os.path.getmtime(png):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        pymupdf.Pixmap(png).save(path, jpg_quality=88)
    emit(f'<div class="shot"><img src="{file_url(path)}" alt="Screen layout: {esc(label)}"></div>')


# ---------------------------------------------------------------- use case specifications from v2.2

def parse_ucs():
    ucs = {}
    i = find("#### 2.1 UC-01")
    end = find("## IV.")
    cur = None
    section = None
    while i < end:
        ln = LINES[i]
        m = re.match(r"#### 2\.\d+ UC-(\d\d) (.+)", ln)
        if m:
            cur = dict(n=int(m.group(1)), fields={}, normal=[], alt=[], exc=[], after=[])
            ucs[cur["n"]] = cur
            section = None
        elif ln.startswith("| ") and section is None:
            cells = [c.strip() for c in ln.strip()[1:-1].split(" | ")]
            if cells[0] != "Field":
                cur["fields"][cells[0]] = cells[1]
        elif ln == "**Normal flow**":
            section = "normal"
        elif ln == "**Alternative flows**":
            section = "alt"
        elif ln == "**Exceptions**":
            section = "exc"
        elif section == "normal" and re.match(r"\d+\. ", ln):
            cur["normal"].append(ln.split(". ", 1)[1])
        elif section in ("alt", "exc") and re.match(r"- \d+[a-z]\. ", ln):
            label, text = re.match(r"- (\d+[a-z])\. (.*)", ln).groups()
            cur[section].append((label, text))
        elif ln.strip():
            cur["after"].append(ln)
        i += 1
    return ucs


UCS = parse_ucs()
assert len(UCS) == 44


def registered(s):
    """Rule 7: one name per actor, so "the user" of a Registered User use case is "the registered user"."""
    s = re.sub(r"\b(the|The|a|A) signed-in user\b", r"\1 registered user", s)
    return re.sub(r"\b(the|The|a|A) user\b", r"\1 registered user", s)


for _uc in UCS.values():
    _uc["fields"] = {k: reword(v) for k, v in _uc["fields"].items()}
    if _uc["fields"]["Primary actor"] == "Registered User":
        _uc["fields"] = {k: registered(v) for k, v in _uc["fields"].items()}
        _uc["normal"] = [registered(s) for s in _uc["normal"]]
        _uc["alt"] = [(lab, registered(s)) for lab, s in _uc["alt"]]
        _uc["exc"] = [(lab, registered(s)) for lab, s in _uc["exc"]]
        _uc["after"] = [registered(s) for s in _uc["after"]]

# ---------------------------------------------------------------- error codes in flows (rule 5.4)

ERR5 = "(5.2 Error Responses)"


def cite(text, n, label=""):
    """Point every refusal at a Message ID (5.3) or a BR code; bare API codes name the 5.2 table."""
    t = unmd(text)
    rate = {2: "ERR_AUTH_03", 4: "ERR_AUTH_03", 3: "ERR_AUTH_04"}.get(n, "ERR_AUTH_06")
    t = t.replace("(RATE_LIMITED)", f"(RATE_LIMITED, {rate})")
    t = re.sub(r"RATE_LIMITED(?!,)", f"RATE_LIMITED ({rate})", t)
    t = t.replace("CONFLICT_SLOT", "CONFLICT_SLOT (ERR_BOOK_02)").replace("HOLD_EXPIRED", "HOLD_EXPIRED (ERR_BOOK_03)")
    if (n, label) == (42, "3b"):
        t = t.replace("FORBIDDEN", "FORBIDDEN (ERR_PAY_04)")
    elif (n, label) == (42, "3c"):
        t = t.replace("CONFLICT_STATE", "CONFLICT_STATE (ERR_PAY_05)")
    elif (n, label) == (24, "3a"):
        t = t.replace("VALIDATION", "VALIDATION (ERR_PAY_03)")
    t = t.replace("FORBIDDEN (BR-", "FORBIDDEN (ERR_AUTH_05, BR-")
    t = re.sub(r"FORBIDDEN(?! \()", "FORBIDDEN (ERR_AUTH_05)", t)
    for code in ("VALIDATION", "CONFLICT_STATE", "UNAUTHENTICATED"):
        t = re.sub(code + r"(?! \()", f"{code} {ERR5}", t)
    t = t.replace("C-08 or C-09", f"C-08 or C-09 {ERR5}")

    def paren(m):
        mid = D.BR_MESSAGE.get(m.group(1))
        return f"({m.group(1)}, {mid})" if mid else m.group(0)

    def bare(m):
        mid = D.BR_MESSAGE.get(m.group(1))
        return f"{m.group(1)} ({mid})" if mid else m.group(0)

    t = re.sub(r"\((BR-\d\d)\)", paren, t)
    t = re.sub(r"(?<![(\w-])(BR-\d\d)(?![\d)]|, (?:ERR|WARN))", bare, t)
    return t


def split_branch(text):
    """'Condition: action' -> (condition, action)."""
    if ": " in text:
        cond, act = text.split(": ", 1)
        return cond.strip().rstrip("."), act.strip()
    return text.strip().rstrip("."), ""


def cap(s):
    return s[:1].upper() + s[1:] if s else s


def title_of(n, label, cond):
    t = D.TITLES.get((n, label)) or re.sub(r"\s*\((?:BR-\d\d(?:, )?)+\)", "", cond)
    return cap(t)


def flows(n):
    uc = UCS[n]
    name = UC_NAME[n]
    steps = list(uc["normal"])
    m = len(steps)
    # exceptions first, so the normal steps can point at them
    exc = []
    for k, (label, text) in enumerate(uc["exc"], 1):
        step = int(re.match(r"\d+", label).group())
        exc.append((label, step, f"{n}.0.E{k}", text))
    marks = {}
    for label, step, code, _ in exc:
        if step <= m:
            marks.setdefault(step, []).append(code)
    out = ['<div class="flow">', f'<p class="fh"><b>Normal Flow</b></p>', f'<p class="fn"><b>{n}.0 {esc(name)}</b></p><ol>']
    for i, s in enumerate(steps, 1):
        see = f" (see {', '.join(marks[i])})" if i in marks else ""
        out.append(f"<li>{inline(cite(s, n))}{see}</li>")
    out.append("</ol>")
    # alternatives
    merged = {lab for v in D.ALT_MERGE.values() for lab in v}
    alts = [(lab, txt) for lab, txt in uc["alt"] if lab not in merged]
    if alts:
        out.append('<p class="fh"><b>Alternative Flows</b></p>')
    for k, (label, text) in enumerate(alts, 1):
        cond, act = split_branch(text)
        title = title_of(n, label, cond)
        items = [cap(act) if act else cap(text)]
        for extra in D.ALT_MERGE.get((n, label), []):
            more = dict(uc["alt"])[extra]
            items.append(cap(more))
        step = int(re.match(r"\d+", label).group())
        ret = D.ALT_RETURN.get((n, label))
        if ret is None:
            ret = step + 1 if step + 1 <= m else "end"
        end = "The use case ends." if ret == "end" else f"Return to step {ret} of the Normal Flow."
        out.append(f'<p class="fn"><b>{n}.{k} {esc(title)}</b></p><ol>')
        out.extend(f"<li>{inline(cite(it, n, label))}</li>" for it in items)
        out.append(f'</ol><p class="ret">{end}</p>')
    if exc:
        out.append('<p class="fh"><b>Exceptions</b></p>')
    for label, step, code, text in exc:
        cond, act = split_branch(text)
        title = title_of(n, label, cond)
        if act:
            starts_code = re.match(r"(BR-\d\d|VALIDATION|RATE_LIMITED|RATE\\_LIMITED|CONFLICT|HOLD|FORBIDDEN|"
                                   r"UNAUTHENTICATED|C-08)", act)
            first = ("The system refuses the request with " + act) if starts_code else cap(act)
        else:
            codes = re.findall(r"BR-\d\d", text)
            first = "The system refuses the request: " + ", ".join(codes) + "." if codes else cap(text)
        ret = D.EXC_RETURN.get((n, label), "end")
        end = "The use case ends." if ret == "end" else f"Return to step {ret} of the Normal Flow."
        out.append(f'<p class="fn"><b>{code} {esc(title)}</b></p><ol>')
        out.append(f"<li>{inline(cite(first, n, label))}</li>")
        out.append(f'</ol><p class="ret">{end}</p>')
    out.append("</div>")
    emit("".join(out))


def split_conditions(text, tag):
    parts = [p.strip() for p in re.split(r"(?<=\.)\s+(?=[A-Z])", text) if p.strip()]
    if len(parts) == 1 and parts[0] in ("None.",):
        return "None."
    return "<br>".join(f"{tag}-{i}. {inline(p)}" for i, p in enumerate(parts, 1))


def screen(n):
    return next(s for s in D.SCREENS if s[0] == n)


def screen_label(n):
    _, _, _, name, route, _ = screen(n)
    return f"{name} ({route})"


ACTIVITY = {2: "11-ad-register", 8: "12-ad-book-and-pay", 13: "13-ad-enrol-waitlist", 24: "14-ad-refund"}
ACTIVITY_TEXT = {}


def uc_section(n, num):
    uc = UCS[n]
    f = uc["fields"]
    name = UC_NAME[n]
    heading(4, f"{num} {name}")
    prim = f["Primary actor"]
    sec = D.SECONDARY.get(n, "None")
    emit('<ul class="blocks">')
    emit(f"<li><b>Function Trigger:</b> {inline(f['Trigger'])}</li>")
    iface = "; ".join(screen_label(s) for s in D.UC_SCREENS[n])
    emit("<li><b>Function Description:</b><ul class=\"plus\">"
         f"<li><b>Use Case ID:</b> UC-{n:02d}</li>"
         f"<li><b>Actors:</b> {esc(prim)}; Secondary: {esc(sec)}</li>"
         f"<li><b>Purpose:</b> {inline(f['Description'])}</li>"
         f"<li><b>Interface:</b> {esc(iface)}</li></ul></li>")
    col, comp, kind, store = D.DP[n]
    emit("<li><b>Data Processing:</b><ul class=\"plus\">"
         f"<li><b>Data Collect:</b> {inline(col)}</li>"
         f"<li><b>Data Computation:</b> {inline(comp)}</li>"
         f"<li><b>Data {kind}:</b> {inline(store)}</li></ul></li>")
    emit("</ul>")
    emit('<div class="layout"><ul class="blocks"><li><b>Screen Layout:</b></li></ul>')
    shot(D.UC_SCREENS[n][0], screen_label(D.UC_SCREENS[n][0]))
    emit("</div>")
    emit('<ul class="blocks keep"><li><b>Function Details:</b></li></ul>')
    created, date = [x.strip() for x in f["Created by / date"].split("/")]
    detail = [
        ("ID and Name", esc(f"UC-{n:02d} {name}")),
        ("Created By", esc(created)),
        ("Date Created", esc(date)),
        ("Primary Actor", esc(prim)),
        ("Secondary Actors", esc(sec)),
        ("Trigger", inline(f["Trigger"])),
        ("Description", inline(f["Description"])),
        ("Preconditions", split_conditions(f["Preconditions"], "PRE")),
        ("Postconditions", split_conditions(f["Postconditions"], "POST")),
        ("Priority", esc(f["Priority"])),
        ("Frequency of Use", esc(f["Frequency of use"])),
        ("Business Rules", esc(BR_ROWS[n])),
    ]
    emit('<table class="t spec"><colgroup><col style="width:3.6cm"><col></colgroup><thead><tr><th>Field</th>'
         '<th>Detail</th></tr></thead><tbody>'
         + "".join(f"<tr><td>{k}</td><td>{v}</td></tr>" for k, v in detail) + "</tbody></table>")
    flows(n)
    if "Other information" in f:
        para(f"<b>Other information:</b> {inline(f['Other information'])}", raw=True)
    if n in ACTIVITY:
        key = ACTIVITY[n]
        lead, notes = ACTIVITY_TEXT[n]
        para(f"{lead} {F(key)} shows this use case as an activity diagram.", raw=False)
        figure(key)
        for ln in notes:
            if ln.startswith("- "):
                bullets([ln[2:]])
            else:
                para(ln)


# Business Rules rows, with every BR cited by at least one use case (rule 4.6)
BR_ROWS = {n: UCS[n]["fields"]["Business rules"] for n in UCS}


def br_list():
    out = []
    for ln in block("| ID | Category | Rule statement | Type | Applies to |", "Version 2.1 renumbered"):
        if ln.startswith("| BR-"):
            c = [x.strip() for x in ln.strip()[1:-1].split(" | ")]
            out.append((c[0], reword(c[2]), c[4]))
    return out


BRS = br_list()
assert len(BRS) == 53
for code, _, applies in BRS:
    cited = [n for n in UCS if code in BR_ROWS[n]]
    if not cited:
        for uc in re.findall(r"UC-(\d\d)", applies):
            row = BR_ROWS[int(uc)]
            BR_ROWS[int(uc)] = code if row == "None" else ", ".join(sorted(set(row.split(", ") + [code])))
uncited = [c for c, _, _ in BRS if not any(c in BR_ROWS[n] for n in UCS)]
assert not uncited, uncited

# activity diagram notes from v2.2 I.3 Main workflows
_aw = block("### 3. Main workflows", "## II. User requirements")
_cur = None
for ln in _aw:
    m = re.match(r"#### 3\.(\d) ", ln)
    if m:
        _cur = {1: 2, 2: 8, 3: 13, 4: 24}[int(m.group(1))]
        ACTIVITY_TEXT[_cur] = ["", []]
    elif _cur and ln.startswith("&#91;image"):
        continue
    elif _cur and not ACTIVITY_TEXT[_cur][0]:
        ACTIVITY_TEXT[_cur][0] = ln
    elif _cur:
        ACTIVITY_TEXT[_cur][1].append(ln)

# ---------------------------------------------------------------- document

GROUPS = [
    ("3.2", "Account and Access", range(1, 7)),
    ("3.3", "Member Court Booking and Payment", range(7, 13)),
    ("3.4", "Member Classes and Training", range(13, 18)),
    ("3.5", "Front Desk Sales", range(18, 25)),
    ("3.6", "Front Desk Operations", range(25, 30)),
    ("3.7", "Coach Teaching and Earnings", range(30, 36)),
    ("3.8", "Manager Setup", range(36, 41)),
    ("3.9", "Manager Oversight", range(41, 45)),
]
UC_DIAGRAMS = [
    ("2.2.1.1", "Account and Access", "03-uc-account", "the guest and registered-user goals, with the four roles "
     "that specialise Registered User"),
    ("2.2.1.2", "Member Court Booking and Payment", "04-uc-member-booking", "the member's court booking, plan and "
     "payment goals"),
    ("2.2.1.3", "Member Classes and Training", "05-uc-member-classes", "the member's class, training and help goals"),
    ("2.2.1.4", "Front Desk Sales", "06-uc-desk-sales", "the receptionist's selling and till goals"),
    ("2.2.1.5", "Front Desk Operations", "07-uc-desk-operations", "the receptionist's daily operations, with the "
     "manager on maintenance work orders"),
    ("2.2.1.6", "Coach", "08-uc-coach", "the coach's teaching and earnings goals"),
    ("2.2.1.7", "Manager Setup", "09-uc-manager-setup", "the manager's set-up goals"),
    ("2.2.1.8", "Manager Oversight", "10-uc-manager-oversight", "the manager's oversight goals"),
]


def product_overview():
    heading(1, "I. Software Requirement Specification", cls="part")
    heading(2, "1. Product Overview")
    ov = block("### 1. Product overview", "### 2. Context diagram")
    para(ov[0])
    ctx = block("### 2. Context diagram", "### 3. Main workflows")
    para(ctx[0].replace("The context diagram shows", f"The context diagram in {F('01-context-diagram')} shows"))
    figure("01-context-diagram")
    t = rows(ctx)
    table(t[0], t[1:])
    t = rows(ov)
    para("Each portal of the application serves one group of users.")
    table(t[0], t[1:])
    for ln in ov:
        if not ln.startswith("| ") and ln != ov[0]:
            para(ln)


def user_requirements():
    heading(2, "2. User Requirements")
    heading(3, "2.1 Actors")
    act = block("### 1. Actors", "### 2. Use case diagrams")
    para(act[0])
    t = rows(act)
    body = [[r[0], r[1], f"{r[2]} actor. {reword(r[3])}"] for r in t[1:]]
    table(["#", "Actor", "Description"], body, widths=["1cm", "3.6cm", None])
    para(act[-1])
    heading(3, "2.2 Use Cases")
    heading(4, "2.2.1 Diagram(s)")
    intro = block("### 2. Use case diagrams", "#### 2.1 Account and access")[0]
    intro += (" Primary actors stand left and secondary actors right. An actor is linked only to the use cases in "
              "which it interacts with Arena3; people who are only served at the counter or notified later are not "
              "actors of those use cases.")
    para(intro.replace("the use case list (II.3)", "table 2.2.2").replace(" (III.2)", " (3.2 to 3.9)"))
    for num, name, key, what in UC_DIAGRAMS:
        heading(5, f"{num} {name}")
        para(f"{F(key)} shows {what}.")
        figure(key)
    heading(4, "2.2.2 Descriptions")
    lst = block("### 3. Use case list", "## III. Functional requirements")
    para(lst[0].replace("in figure order", "in the order of the diagrams").replace(" (III.2)", " (3.2 to 3.9)")
         .replace("in III.2.", "in 3.2 to 3.9."))
    body = []
    for n in range(1, 45):
        actors = [a.strip() for a in UCS[n]["fields"]["Primary actor"].split(",")] + D.SECONDARY_NAMES.get(n, [])
        body.append([f"UC-{n:02d}", UC_NAME[n], ", ".join(actors), UCS[n]["fields"]["Description"]])
    table(["ID", "Use Case", "Actors", "Use Case Description"], body, widths=["1.5cm", "4.2cm", "3.4cm", None])


def functional_overview():
    heading(2, "3. Functional Requirements")
    heading(3, "3.1 System Functional Overview")
    heading(4, "3.1.1 Screens Flow")
    para("Each portal has one screen flow that starts at its entry screen. A box is a routed screen with its route; "
         "the dialogs and in-page steps that open over a screen sit inside its box, and arrows lead from one screen "
         "to the next.")
    keys = ["24-sf-public", "25-sf-member", "26-sf-receptionist", "27-sf-coach", "28-sf-manager"]
    for i, ((portal, pname), key) in enumerate(zip(D.PORTALS, keys), 1):
        heading(5, f"3.1.1.{i} {pname}")
        para(f"{F(key)} shows the screens of the {pname.lower().replace('front desk portal', 'front desk')}.")
        figure(key)
    heading(4, "3.1.2 Screen Descriptions")
    para("The application has 44 routed screens. Each screen name carries the route exactly as the application "
         "serves it.")
    for i, (portal, pname) in enumerate(D.PORTALS, 1):
        heading(5, f"3.1.2.{i} {pname}")
        body = [[str(k), feat, f"{name} ({route})", desc]
                for k, (n, p, feat, name, route, desc) in enumerate([s for s in D.SCREENS if s[1] == portal], 1)]
        table(["#", "Feature", "Screen", "Description"], body, widths=["0.9cm", "2.6cm", "5.2cm", None])
    heading(4, "3.1.3 Screen Authorization")
    auth = block("#### 1.3 Screen authorization", "#### 1.4 Non-screen functions")
    para(auth[0] + " A row in angle brackets is a screen; the rows under it are the functions on that screen.")
    roles = list(D.ALL)
    body = []
    for portal, _ in D.PORTALS:
        for n, p, feat, name, route, desc in [s for s in D.SCREENS if s[1] == portal]:
            allowed = D.SCREEN_ROLES[n]
            body.append([f"<b>&lt;&lt;{esc(name)}&gt;&gt;</b>"] + ["x" if r in allowed else "" for r in roles])
            for u in [u for u in range(1, 45) if n in D.UC_SCREENS[u]]:
                ur = [r for r in D.UC_ROLES[u] if r in allowed]
                body.append([f'<span class="ind">{esc(UC_NAME[u])}</span>'] + ["x" if r in ur else "" for r in roles])
    table(["Screen"] + roles, body, cls="t auth", raw=True, widths=[None, "1.6cm", "1.7cm", "2.6cm", "1.5cm", "1.8cm"])
    heading(4, "3.1.4 Non-Screen Functions")
    ns = block("#### 1.4 Non-screen functions", "#### 1.5 Entity relationship diagram")
    para(ns[0].replace("Ten background jobs keep", "Ten background jobs and the payOS webhook keep"))
    feature = {1: "Booking", 2: "Booking", 3: "Booking", 4: "Notifications", 5: "Payment", 6: "Classes",
               7: "Attendance", 8: "Plans", 9: "Plans", 10: "Classes", 11: "Payment"}
    body = []
    for r in rows(ns)[1:]:
        k = int(r[0])
        trig = r[2]
        lead = {"Every 15 s, when due": "Runs every 15 seconds when due.", "Every 10 minutes": "Runs every 10 "
                "minutes.", "Called by payOS": "Runs when payOS calls the webhook."}[trig]
        body.append([r[0], feature[k], r[1], f"{lead} {r[3]}"])
    table(["#", "Feature", "System Function", "Description"], body, widths=["0.9cm", "2.6cm", "4.2cm", None])
    para(ns[-1])
    heading(4, "3.1.5 Entity Relationship Diagram")
    erd = block("#### 1.5 Entity relationship diagram", "#### 1.6 Class diagrams")
    heading(5, "3.1.5.1 Conceptual Entity Relationship Diagram")
    para(erd[0] + f" {F('19-erd-conceptual')} covers courts, bookings and payments, and "
         f"{F('44-erd-conceptual-2')} covers members, plans and classes; User, Payment and Court appear in both.")
    figure("19-erd-conceptual")
    figure("44-erd-conceptual-2")
    heading(5, "3.1.5.2 Logical Entity Relationship Diagram")
    para(f"The logical ERD shows every one of the 49 tables in migrations/*.sql with its primary key and foreign "
         f"keys, in crow's foot notation. It is drawn in five parts so each stays readable on the page: "
         f"{F('31-erd-logical-1-accounts')} shows accounts and the platform, {F('32-erd-logical-2-courts')} courts "
         f"and bookings, {F('33-erd-logical-3-payments')} payments, plans and promotions, "
         f"{F('34-erd-logical-4-classes')} classes, attendance and training, and {F('35-erd-logical-5-coaching')} "
         f"coaching records and pay. Users, courts, occupancies and promotions repeat where a part needs them, and a "
         f"foreign key to a table in another part stays in the box.")
    for key in ["31-erd-logical-1-accounts", "32-erd-logical-2-courts", "33-erd-logical-3-payments",
                "34-erd-logical-4-classes", "35-erd-logical-5-coaching"]:
        figure(key)
    heading(5, "Entities Description", toc=True, cls="un")
    tabs = dbschema.load()
    body = []
    for r in rows(erd)[1:]:
        tab = r[2].strip("`")
        body.append([r[0], r[1], entity_desc(tab, r[3], tabs[tab])])
    table(["#", "Entity", "Description"], body, raw=True, widths=["0.9cm", "3.6cm", None])


def entity_desc(tab, sentence, t):
    s = sentence.rstrip(".")
    s = "Store " + s[0].lower() + s[1:] + f" (table <code>{tab}</code>)."
    pk = ", ".join(t["pk"])
    fk = ", ".join(f"{c} → {f['ref']}" for c, f in t["fk"].items())
    return f"{s}<ul class=\"keys\"><li>Primary Key: {pk}</li><li>Foreign Key: {fk if fk else 'None'}</li></ul>"


def use_case_specs():
    para_done = False
    for num, name, rng in GROUPS:
        heading(3, f"{num} {name}")
        if not para_done:
            spec = block("### 2. Use case specifications", "#### 2.1 UC-01")
            para("Each use case below follows the template: Function Trigger, Function Description, Data Processing, "
                 "Screen Layout and Function Details. The Function Details table is followed by the normal flow, the "
                 "alternative flows and the exceptions; each refusal names its Message ID (5.3), its business rule "
                 "(5.1) or its error response (5.2).")
            para(spec[1].replace("V.3", "5.2").replace("V.1", "5.1"))
            para_done = True
        for k, n in enumerate(rng, 1):
            uc_section(n, f"{num}.{k}")


def nfr():
    heading(2, "4. Non-Functional Requirements")
    para(LINES[find("## IV.") + 1])
    heading(3, "4.1 External Interfaces")
    heading(4, "4.1.1 User Interface")
    ui = block("#### 1.1 User interfaces", "#### 1.2 Software interfaces")
    para(ui[0])
    bullets([ln[2:] for ln in ui[1:] if ln.startswith("- ")])
    heading(4, "4.1.2 Communications Interfaces")
    sw = block("#### 1.2 Software interfaces", "#### 1.3 API error codes")
    para(sw[0])
    t = rows(sw)
    table(t[0], t[1:])
    para(sw[-1])
    heading(3, "4.2 Quality Attributes")
    q = {
        "usability": block("#### 2.3 Usability", "#### 2.4 Auditability"),
        "reliability": block("#### 2.1 Correctness and reliability", "#### 2.2 Performance"),
        "performance": block("#### 2.2 Performance", "#### 2.3 Usability"),
        "security": block("#### 2.5 Security and privacy", "#### 2.6 Maintainability"),
        "auditability": block("#### 2.4 Auditability", "#### 2.5 Security and privacy"),
        "maintainability": block("#### 2.6 Maintainability", "## V."),
    }
    for i, (key, title) in enumerate([("usability", "Usability"), ("reliability", "Reliability"),
                                      ("performance", "Performance"), ("security", "Security"),
                                      ("auditability", "Auditability"), ("maintainability", "Maintainability")], 1):
        heading(4, f"4.2.{i} {title}")
        lines = q[key]
        first = lines[0] if not lines[0].startswith("| ") else D.PURPOSE[key]
        para(first)
        t = rows(lines)
        if t:
            table(["ID", "Requirement"], [[r[0], reword(r[1])] for r in t[1:]], widths=["1.8cm", None])
        items = [ln[2:] for ln in lines if ln.startswith("- ")]
        if items:
            bullets(items)


def appendix():
    heading(2, "5. Requirement Appendix")
    para(LINES[find("## V.") + 1])
    heading(3, "5.1 Business Rules")
    para("A refused request returns 422 BR_VIOLATION with the rule code in br, so any refusal on screen traces to "
         "one row below. Every rule is cited in the Business Rules row of at least one use case.")
    table(["ID", "Rule Definition"], [[c, s] for c, s, _ in BRS], widths=["1.8cm", None])
    para(LINES[find("Version 2.1 renumbered")])
    heading(3, "5.2 Common Requirements")
    bullets([
        "<b>User Login:</b> every user signs in with a phone number or email and a password (3.2.3). Member sessions "
        "last seven days and staff sessions twelve hours, and five wrong passwords lock sign-in for 15 minutes.",
        "<b>User Authorization:</b> each portal checks the signed-in role before it renders (3.1.3), and the API "
        "checks every request again on the server. The actions below are narrower than the screens that show them.",
    ], raw=True)
    auth = block("#### 1.3 Screen authorization", "#### 1.4 Non-screen functions")
    act = [r for r in rows(auth) if r[0] == "Action" or r[0][0].isupper() and len(r) == 3]
    table(act[0], act[1:])
    common = block("### 3. Common requirements", "### 4. Application messages")
    para(common[0])
    t = rows(common)
    table(t[0], [[a, b.replace("III.1.4", "3.1.4")] for a, b in t[1:]], widths=["3cm", None])
    heading(5, "Error Responses", cls="un")
    errs = block("#### 1.3 API error codes", "### 2. Quality attributes")
    para(errs[0])
    t = rows(errs)
    table(t[0], t[1:], widths=["1.6cm", "4cm", None])
    heading(5, "Configurable Settings", cls="un")
    st = block("### 2. Centre settings", "### 3. Common requirements")
    para(st[0])
    t = rows(st)
    table(t[0], t[1:])
    heading(3, "5.3 Application Messages List")
    para("Each message below is the text the application shows today. The Context/Trigger column names the screen "
         "and the action, then the v2.2 code and the business rule it reports.")
    body = []
    for mid, old, text, typ, ctx, br in D.MESSAGES:
        tail = f"(was {old}; {br})" if br else f"(was {old})"
        body.append([mid, text, typ, f"{ctx} {tail}"])
    table(["Message ID", "Message Text", "Message Type", "Context/Trigger"], body,
          widths=["3.4cm", None, "2.1cm", "4.6cm"])


def sdd():
    heading(1, "II. Software Design Description", cls="part")
    heading(2, "1. System Design")
    heading(3, "1.1 System Architecture")
    para(f"{F('38-system-architecture')} shows how Arena3 is deployed. The browser runs the five portals as one "
         "React client. One TanStack Start server renders the pages and serves the JSON API under /v1; the API "
         "router dispatches each request to a feature handler that applies the business rules. The handlers and the "
         "background job loop read and write PostgreSQL (Neon in production, embedded PGLite locally). The server "
         "calls payOS for payment links and receives its webhook, asks Gemini AI for assistant answers, and sends "
         "mail through Mail delivery (SMTP).")
    figure("38-system-architecture")
    heading(3, "1.2 Package Diagram")
    para(f"{F('39-package-diagram')} shows the packages of the source tree and the dependencies between them.")
    figure("39-package-diagram")
    heading(5, "Package Descriptions", cls="un")
    table(["No", "Package Name", "Description"],
          [[str(i), f"{name} ({path})", desc] for i, (name, path, desc) in enumerate(architecture.package_rows(), 1)],
          widths=["1cm", "5cm", None])
    heading(2, "2. Database Design")
    para("The database has 49 tables, created by the numbered migrations in migrations/*.sql. The logical ERD in "
         "3.1.5.2 draws them; the table below describes each one with its keys.")
    heading(5, "Table Descriptions", cls="un")
    tabs = dbschema.load()
    core = {r[2].strip("`"): r[3] for r in rows(block("#### 1.5 Entity relationship diagram",
                                                       "#### 1.6 Class diagrams"))[1:]}
    body = []
    for i, tab in enumerate(sorted(tabs), 1):
        sentence = core.get(tab) or cap(D.TABLE_STORES[tab]) + "."
        body.append([str(i), D.ENTITY_NAMES[tab], entity_desc(tab, sentence, tabs[tab])])
    table(["#", "Entity", "Description"], body, raw=True, widths=["0.9cm", "3.8cm", None])
    heading(2, "3. Detailed Design")
    cd = block("#### 1.6 Class diagrams", "### 2. Use case specifications")
    covers = {k: ln for k, ln in zip(["bp", "mc", "co", "op"], [l for l in cd if l.startswith("Figure ")])}
    parts = [
        ("3.1 Booking and Payment", "bp", ["20-cd-booking-payment", "40-cd-booking-payment-2"],
         "courts, price rules, occupancies, bookings, series and day passes", "payments, shifts, promotions, "
         "redemptions and invoices",
         [("16-sd-book-and-pay", "how a member books a court and pays by payOS QR, with the webhook and the polling "
           "check running side by side"),
          ("18-sd-refund", "how a refund is raised at the desk and, above the limit, approved by another manager")]),
        ("3.2 Membership and Classes", "mc", ["21-cd-membership-classes", "41-cd-membership-classes-2"],
         "membership plans and subscriptions", "classes, sessions, enrolments, waitlist offers and attendance",
         [("36-sd-enrol-class", "how a member enrols in a class, including the waitlist branch when the class is full")]),
        ("3.3 Coaching and Training", "co", ["22-cd-coaching", "42-cd-coaching-2"],
         "the coach and member roles with notes, reviews, levels and results",
         "coach pay, training plans and homework",
         [("37-sd-take-attendance", "how a coach takes a session register and what happens once it is locked")]),
        ("3.4 Centre Operations", "op", ["23-cd-operations", "43-cd-operations-2"],
         "accounts, gate tokens, notifications, support, loyalty and the audit log",
         "settings, feature flags, courts, work orders and gear",
         [("15-sd-register", "how a guest registers and proves the email address with a one-time code"),
          ("17-sd-gate-checkin", "how a member is checked in at the gate, with the override path")]),
    ]
    for i, (title, key, figs, first, second, seqs) in enumerate(parts, 1):
        heading(3, title)
        heading(4, f"3.{i}.1 Class Diagram")
        text = re.sub(r"^Figure \d+ ", "", covers[key])
        text = re.sub(r"^covers ", "cover ", text).replace("specialises", "specialise", 1).replace(" It covers ",
                                                                                                       " They cover ")
        para(f"{F(figs[0])} and {F(figs[1])} refine the ERD for this subsystem, with attributes, operations, "
             f"enumerations and multiplicities: {F(figs[0])} draws {first}, and {F(figs[1])} draws {second}. "
             f"Together they {text}")
        figure(figs[0])
        figure(figs[1])
        heading(4, f"3.{i}.2 Sequence Diagram")
        for fk, what in seqs:
            para(f"{F(fk)} shows {what}.")
            figure(fk)


def front_matter():
    emit('<section class="front">')
    heading(1, "Record of Changes", toc=False, cls="fronth")
    roc = rows(block("## Record of changes", "## I. Overall requirements"))
    new = [
        ["2026-10-12", "2.3", "A, M", "Arena3 team",
         "Restructured to the FPT SRS/SDD template: front matter, heading tree, table formats, the five-block function "
         "specification, Message IDs and the software design part. Added Definition and Acronyms, screen layouts, "
         "the logical ERD, the system architecture, the package diagram and two sequence diagrams; split the class "
         "diagrams and the conceptual ERD in two. Restated requirements with \"must\" and gave each actor one name."],
        ["2026-10-12", "2.2.1", "M", "Arena3 team",
         "Redrew the context, use case, activity, screen flow and sequence diagrams to the FPT templates and Learning "
         "UML 2.0. Aligned the secondary actors of 19 use cases with their flows, and removed Gemini AI from UC-32 to "
         "match the code."],
    ]
    table(roc[0], new + roc[1:], widths=["2.3cm", "1.8cm", "1.6cm", "2.3cm", None])
    emit('<p class="foot">*A – Added, M – Modified, D – Deleted</p></section>')


def acronyms(text):
    found = sorted(set(re.findall(r"\b([A-Z]{2,5})\b", text)))
    return found


# ---------------------------------------------------------------- assemble

front_matter()
SPLIT = len(OUT)
product_overview()
user_requirements()
functional_overview()
use_case_specs()
nfr()
appendix()
sdd()
BODY = "".join(OUT)
assert len(FIGS) == 41, len(FIGS)

plain = re.sub(r"<[^>]+>", " ", html.unescape(BODY))
used = set(re.findall(r"\b([A-Z]{2,5})\b", plain))
skip = {"MSG", "ERR", "WARN", "INFO", "AUTH", "BOOK", "PAY", "CLASS", "COACH", "GEAR", "CHECKIN", "PLAN", "PROF",
        "FORBIDDEN", "PAID", "POST", "GET", "PRE", "BR_", "NOT", "TBD", "VIP", "FK", "PK", "NFR"}
acr = {k: v for k, v in D.ACRONYMS.items() if k in used or k in ("API", "BR", "ERD", "NFR", "OTP", "QR", "SDD",
                                                                 "SRS", "UC", "UI", "VND", "SMTP", "AI", "JSON",
                                                                 "HTTPS", "PK", "FK")}


def pg(key):
    return str(pages[key] + 1) if pages else "00"


toc = [f'<section class="front"><h1 id="h900" class="fronth">{mark("h900")}Table of Contents</h1><div class="toc">']
for hid, level, text in HEADS:
    toc.append(f'<a class="l{level}" href="#{hid}"><span class="tx">{esc(text)}</span>'
               f'<span class="dots"></span><span class="pn">{pg(hid)}</span></a>')
toc.append("</div></section>")
lof = [f'<section class="front"><h1 id="h901" class="fronth">{mark("h901")}List of Figures</h1><div class="toc">']
for fid, n, title in FIGS:
    lof.append(f'<a class="l5" href="#{fid}"><span class="tx">Figure {n}. {esc(title)}</span>'
               f'<span class="dots"></span><span class="pn">{pg(fid)}</span></a>')
lof.append("</div></section>")
defs = [f'<section class="front"><h1 id="h902" class="fronth">{mark("h902")}Definition and Acronyms</h1>']
defs.append('<table class="t"><colgroup><col style="width:3cm"><col></colgroup><thead><tr><th>Acronym</th>'
            '<th>Definition</th></tr></thead><tbody>')
for k in sorted(acr):
    defs.append(f"<tr><td>{k}</td><td>{esc(acr[k])}</td></tr>")
defs.append("</tbody></table></section>")

CSS = open(os.path.join(HERE, "srs23.css"), encoding="utf-8").read()
doc = (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Sport Center Management System - '
       f'Software Requirement Specification v2.3</title><style>{CSS}</style></head><body>'
       f'{"".join(OUT[:SPLIT])}{"".join(toc)}{"".join(lof)}{"".join(defs)}<main>{"".join(OUT[SPLIT:])}</main>'
       f'</body></html>')
open(out_path, "w", encoding="utf-8").write(doc)
json.dump({"acronyms_used": sorted(used), "defined": sorted(acr), "figures": len(FIGS), "headings": len(HEADS)},
          open(out_path + ".meta.json", "w", encoding="utf-8"), indent=1)
print(f"{len(HEADS)} headings, {len(FIGS)} figures, {len(acr)} acronyms -> {out_path}")
