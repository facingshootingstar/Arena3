"""Use case diagrams 2.2.1.1-2.2.1.8, one per feature area, laid out like the SJ template (p. 6).

UML 2.0 rules applied (Learning UML 2.0, ch. 2):
- one boundary box named after the system, every use case inside it and every actor outside (Fig. 2-8);
- ovals carry the goal as a verb phrase, in the Title Case used by the 2.2.2 table and the 3.x.y headings;
- communication lines have no arrowheads (p. 27);
- the four roles specialise the abstract Registered User with a hollow-triangle generalization (Fig. 2-4);
- system actors use the <<actor>> box (Fig. 2-2).

Primary actors stand left; secondary actors, and a second primary actor, stand right. An actor is linked to a use case only when it
interacts with Arena3 during that use case (Fig. 2-3, Table 2-1): it triggers it, performs a step
or exchanges data with the system. People who are only served at the counter, told later through a
notice, assigned or paid are stakeholders of that use case and reach the system through their own
use cases. No use case is shared between two diagrams, and there is no <<include>> or <<extend>>:
the specifications keep shared steps as flows (section 2.2 text).
"""

from lib import Diagram

INK = "#1e293b"
EDGE = "#475569"

ACTOR = ("shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;"
         "fillColor=#ffffff;strokeColor=" + INK + ";strokeWidth=1.5;fontFamily=Helvetica;fontSize=16;"
         "fontStyle=1;fontColor=" + INK + ";")
ABSTRACT_ACTOR = ACTOR.replace("fontStyle=1;", "fontStyle=3;")
SYS_ACTOR = ("rounded=0;whiteSpace=wrap;html=1;fillColor=#f1f5f9;strokeColor=#334155;strokeWidth=1.5;"
             "fontFamily=Helvetica;fontSize=13;fontColor=" + INK + ";")
CASE = ("ellipse;whiteSpace=wrap;html=1;spacingLeft=22;spacingRight=22;fillColor=#f8fafc;strokeColor=#334155;"
        "strokeWidth=1.5;"
        "fontFamily=Helvetica;fontSize=17;fontColor=" + INK + ";")
BOUNDARY = ("rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#334155;strokeWidth=1.5;"
            "verticalAlign=top;align=center;spacingTop=10;fontFamily=Helvetica;fontSize=17;fontStyle=1;"
            "fontColor=" + INK + ";")
ASSOC = "endArrow=none;html=1;rounded=0;edgeStyle=none;strokeColor=" + EDGE + ";strokeWidth=1.3;"
GEN = ("endArrow=block;endFill=0;endSize=16;html=1;rounded=0;edgeStyle=none;strokeColor=" + EDGE + ";"
       "strokeWidth=1.3;")

SYSTEM = "Arena3 Sports Centre Management System"

# The use case names, word for word as in table 2.2.2 and the 3.x.y headings.
UC = {
    1: "Browse Courts, Classes and Prices", 2: "Register a Member Account", 3: "Sign In and Sign Out",
    4: "Reset a Forgotten Password", 5: "Manage the Personal Profile", 6: "View Notifications",
    7: "View My Schedule", 8: "Book a Court and Pay", 9: "Reschedule or Cancel a Booking",
    10: "Order a Membership Plan", 11: "View Receipts and Redeem Points", 12: "Check In by Self-Service",
    13: "Enrol in a Class", 14: "Accept a Waitlist Offer", 15: "Leave a Class",
    16: "Follow My Training Progress", 17: "Get Help from the AI Assistant or Staff",
    18: "Open and Close a Cashier Shift", 19: "Manage a Member Record at the Desk",
    20: "Manage a Member Plan at the Desk", 21: "Book a Court at the Desk", 22: "Settle Pending Payments",
    23: "Sell and Redeem a Day Pass", 24: "Raise a Refund", 25: "Check In a Court Booking",
    26: "Check a Member In at the Gate", 27: "Rent Out Gear and Record Its Return",
    28: "Handle Maintenance Work Orders", 29: "Reply to a Support Request",
    30: "View the Teaching Schedule and Rosters", 31: "Take Session Attendance", 32: "Plan a Training Session",
    33: "Record Session Results and Homework", 34: "Assess a Student's Progress", 35: "View Monthly Earnings",
    36: "Manage User Accounts", 37: "Manage Membership Plans and Prices", 38: "Manage Promo Codes",
    39: "Schedule Classes and Sessions", 40: "Configure the Centre", 41: "View Reports and Export Data",
    42: "Approve or Reject a Refund", 43: "Close and Pay Coach Commission", 44: "Review the Audit Log",
}

AW, AH = 46, 90           # stick figure
ARMS = 0.45               # relative height of the arms, where communication lines attach
OW, OH = 330, 66          # use case oval
PITCH, TOP = 96, 130      # oval rows
MARGIN = 60               # boundary padding around the ovals
SYS_W, SYS_H = 200, 64    # <<actor>> box


def oval_text(name):
    """A name too long for one line is split into two lines of even length, never leaving one word alone."""
    if len(name) <= 32:
        return name
    words = name.split(" ")
    best = min(range(1, len(words)), key=lambda k: max(len(" ".join(words[:k])), len(" ".join(words[k:]))))
    return " ".join(words[:best]) + "<br>" + " ".join(words[best:])


def caption_w(label):
    return len(label) * 9.2 + 12


class Layout:
    def __init__(self, d, ox):
        self.d = d
        self.ox = ox

    def row_cy(self, r):
        return TOP + r * PITCH + OH / 2

    def person(self, aid, label, x, cy, style=ACTOR):
        """Stick figure whose arms (where its lines attach) sit at height cy."""
        y = cy - ARMS * AH
        self.d.vertex(label, style, x, y, AW, AH, id=aid, role="actor")
        lw = caption_w(label)
        self.d.keepout(x + AW / 2 - lw / 2, y + AH + 2, lw, 22, aid + " caption")
        return aid


def build_uc(name, cases, left, right=(), children=(), lx=70):
    """cases: UC numbers top to bottom. left/right: (id, label, [row], kind, centre row or None).
    kind is "person", "abstract" or "system". children: (id, label) specialising the abstract actor."""
    d = Diagram(name, w=1100, h=200 + len(cases) * PITCH)
    shift = 170 if children else 0
    ox = 330 + shift
    lay = Layout(d, ox)
    bx, by = ox - MARGIN, TOP - 70
    bh = (len(cases) - 1) * PITCH + OH + 70 + 50
    d.vertex(SYSTEM, BOUNDARY, bx, by, OW + 2 * MARGIN, bh, id="boundary", role="container")
    ovals = [d.vertex(oval_text(UC[n]), CASE, ox, TOP + r * PITCH, OW, OH, id=f"uc{n}", shape="ellipse")
             for r, n in enumerate(cases)]

    def centre(rows, at):
        return lay.row_cy(at if at is not None else sum(rows) / len(rows))

    abstract = None
    for aid, label, rows, kind, at in left:
        style = ABSTRACT_ACTOR if kind == "abstract" else ACTOR
        lay.person(aid, label, lx + shift, centre(rows, at), style)
        if kind == "abstract":
            abstract = aid
        for r in rows:
            d.edge(aid, ovals[r], "", ASSOC, exit=(1, ARMS), entry=(0, 0.5), id=f"a_{aid}_{r}")

    if children:
        # one hollow triangle: the four lines join on a vertical bus and share the last segment
        ax, ay, _, _ = d.abs_of(abstract)
        ru_y = ay + AH * ARMS
        gap = 128
        first = ru_y - gap * (len(children) - 1) / 2
        bus = (lx + AW + ax) / 2
        for i, (cid, label) in enumerate(children):
            sy = first + i * gap
            lay.person(cid, label, lx, sy)
            d.edge(cid, abstract, "", GEN, exit=(1, ARMS), entry=(0, ARMS),
                   points=[(bus, sy), (bus, ru_y)], id=f"g_{cid}")

    rx = ox + OW + MARGIN + 100
    for aid, label, rows, kind, at in right:
        cy = centre(rows, at)
        if kind == "system":
            d.vertex("&laquo;actor&raquo;<br><b><font style=\"font-size:16px\">" + label + "</font></b>", SYS_ACTOR,
                     rx - 20, cy - SYS_H / 2, SYS_W, SYS_H, id=aid)
            entry = (0, 0.5)
        else:
            lay.person(aid, label, rx - 20 + SYS_W / 2 - AW / 2, cy)
            entry = (0, ARMS)
        for r in rows:
            d.edge(ovals[r], aid, "", ASSOC, exit=(1, 0.5), entry=entry, id=f"s_{aid}_{r}")
    return d


def build():
    roles = [("member", "Member"), ("receptionist", "Receptionist"), ("coach", "Coach"), ("manager", "Manager")]
    return [
        build_uc("03-uc-account", [1, 2, 3, 4, 5, 6],
                 left=[("guest", "Guest", [0, 1], "person", None),
                       ("ru", "Registered User", [2, 3, 4, 5], "abstract", None)],
                 right=[("mail", "Mail delivery (SMTP)", [1, 3], "system", None)],
                 children=roles),
        build_uc("04-uc-member-booking", [7, 8, 9, 10, 11, 12],
                 left=[("member", "Member", [0, 1, 2, 3, 4, 5], "person", None)],
                 right=[("payos", "payOS", [1, 3], "system", 2),
                        ("rec", "Receptionist", [3], "person", 3)]),
        build_uc("05-uc-member-classes", [13, 14, 15, 16, 17],
                 left=[("member", "Member", [0, 1, 2, 3, 4], "person", None)],
                 right=[("rec", "Receptionist", [0], "person", -0.7),
                        ("mgr", "Manager", [0], "person", 0.75),
                        ("gemini", "Gemini AI", [4], "system", None)]),
        build_uc("06-uc-desk-sales", [18, 19, 20, 21, 22, 23, 24],
                 left=[("rec", "Receptionist", [0, 1, 2, 3, 4, 5, 6], "person", None)],
                 right=[("coach", "Coach", [1], "person", None),
                        ("payos", "payOS", [2, 4], "system", 3),
                        ("mgr", "Manager", [6], "person", 6)]),
        build_uc("07-uc-desk-operations", [25, 26, 27, 28, 29],
                 left=[("rec", "Receptionist", [0, 1, 2, 3, 4], "person", None)],
                 right=[("member", "Member", [0, 1], "person", None),
                        ("mgr", "Manager", [3], "person", None)]),
        build_uc("08-uc-coach", [30, 31, 32, 33, 34, 35],
                 left=[("coach", "Coach", [0, 1, 2, 3, 4, 5], "person", None)],
                 right=[("mgr", "Manager", [1], "person", None)]),
        build_uc("09-uc-manager-setup", [36, 37, 38, 39, 40],
                 left=[("mgr", "Manager", [0, 1, 2, 3, 4], "person", None)]),
        build_uc("10-uc-manager-oversight", [41, 42, 43, 44],
                 left=[("mgr", "Manager", [0, 1, 2, 3], "person", None)]),
    ]
