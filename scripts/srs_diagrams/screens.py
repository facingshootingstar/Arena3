"""Screen flows 3.1.1.1-3.1.1.5, one per portal, after the R7 template (FPT Report 7, p. 26-28).

As in R7, a screen is a box with its name and route, and the dialogs or in-page steps that open
over it sit inside that box; arrows run only between screens, at right angles. The entry screen
and the portal home form the top row; the home's screens hang below it in columns from one shared
bus, so a portal with many screens still fits an A4 portrait page.
"""

from lib import Diagram, LINE

BW = 210            # screen width
TITLE = 44          # name + route band at the top of a screen
IH, IGAP, IPAD = 28, 8, 12
CHAIN_GAP = 16      # vertical gap between two dialogs when one opens the other
COLGAP, ROWGAP = 44, 22
LEFT, TOP = 40, 20
BUS = 18            # column bus distance from the screens it feeds

SCREEN = ("rounded=0;whiteSpace=wrap;html=1;verticalAlign=top;spacingTop=3;fillColor=#ffffff;"
          "strokeColor=#334155;strokeWidth=1.3;fontFamily=Helvetica;fontSize=14;fontColor=#1e293b;")
DIALOG = ("rounded=1;arcSize=20;whiteSpace=wrap;html=1;fillColor=#f1f5f9;strokeColor=#64748b;strokeWidth=1;"
          "fontFamily=Helvetica;fontSize=12;fontColor=#1e293b;")
ARROW = ("html=1;rounded=0;edgeStyle=none;endArrow=block;endFill=1;endSize=6;strokeColor=" + LINE + ";"
         "strokeWidth=1.2;")


class S:
    """A screen. inner: dialogs inside it, each a name or a tuple of names where one opens the next.
    below: screens reached from it, drawn under it; via: the inner dialog that leads there."""

    def __init__(self, name, route, *inner, below=(), via=None):
        self.name, self.route, self.via = name, route, via
        self.inner = [list(c) if isinstance(c, tuple) else [c] for c in inner]
        self.below = list(below)

    def h(self):
        n = sum(len(c) for c in self.inner)
        if not n:
            return TITLE
        chained = sum(len(c) - 1 for c in self.inner)
        return TITLE + n * IH + (n - 1) * IGAP + chained * (CHAIN_GAP - IGAP) + 10

    def stack(self):
        return self.h() + sum(ROWGAP + b.stack() for b in self.below)


def label(s):
    return f'<b>{s.name}</b><br><font style="font-size:12px" color="#64748b">{s.route}</font>'


class Flow:
    def __init__(self, name):
        self.d = Diagram(name)
        self.n = 0

    def nid(self, p):
        self.n += 1
        return f"{p}{self.n}"

    def screen(self, s, x, y, w=BW):
        d = self.d
        s.id = d.vertex(label(s), SCREEN, x, y, w, s.h(), id=self.nid("s"), role="part" if s.inner else "shape")
        s.box = (x, y, w, s.h())
        s.ids = {}
        iy = TITLE
        for chain in s.inner:
            prev = None
            for k, name in enumerate(chain):
                iid = d.vertex(name, DIALOG, IPAD, iy, w - 2 * IPAD, IH, id=self.nid("d"), parent=s.id)
                s.ids[name] = iid
                if prev:
                    d.edge(prev, iid, "", ARROW, exit=(0.5, 1), entry=(0.5, 0), id=self.nid("e"))
                prev = iid
                iy += IH + (CHAIN_GAP if k < len(chain) - 1 else IGAP)
        by = y + s.h()
        for b in s.below:
            by += ROWGAP
            bx, bw = x + 24, w - 24
            self.screen(b, bx, by, bw)
            src = s.ids[s.via] if s.via else s.id
            sx, _, sw, _ = d.abs_of(src)
            d.edge(src, b.id, "", ARROW, exit=((bx + bw / 2 - sx) / sw, 1), entry=(0.5, 0), id=self.nid("e"))
            by += b.stack()
        return s


def columns(items, k):
    """Split items, in order, into k runs with the smallest tallest run."""
    hs = [i.stack() + ROWGAP for i in items]
    best = None

    def go(start, left, acc):
        nonlocal best
        if left == 1:
            parts = acc + [items[start:]]
            worst = max(sum(hs[items.index(i)] for i in p) for p in parts)
            if best is None or worst < best[0]:
                best = (worst, parts)
            return
        for cut in range(start + 1, len(items) - left + 2):
            go(cut, left - 1, acc + [items[start:cut]])

    go(0, k, [])
    return best[1]


def portal(name, chain, children, ncols, first_col=0):
    f = Flow(name)
    d = f.d
    xs = [LEFT + i * (BW + COLGAP) for i in range(max(len(chain), first_col + ncols))]
    for i, s in enumerate(chain):
        f.screen(s, xs[i], TOP)
        if i:
            a = chain[i - 1]
            d.edge(a.id, s.id, "", ARROW, exit=(1, 22 / a.h()), entry=(0, 22 / s.h()), id=f.nid("e"))
    hub = chain[-1]
    hx, hy, hw, hh = hub.box
    bus_y = TOP + max(s.h() for s in chain) + 24
    bottom = max(TOP + s.stack() for s in chain)
    for c, col in enumerate(columns(children, ncols)):
        x = xs[first_col + c]
        y = bus_y + 22
        for s in col:
            f.screen(s, x, y)
            d.edge(hub.id, s.id, "", ARROW, exit=(0.5, 1), entry=(0, 22 / s.h()),
                   points=[(hx + hw / 2, bus_y), (x - BUS, bus_y), (x - BUS, y + 22)], id=f.nid("e"))
            y += s.stack() + ROWGAP
        bottom = max(bottom, y)
    d.w = int(xs[first_col + ncols - 1] + BW + LEFT)
    d.h = int(bottom + 20)
    return d


def build():
    public = portal(
        "24-sf-public",
        [S("Landing page", "/", "Coach profile",
           below=[S("Create an account", "/register", "Verify the emailed code")]),
         S("Sign in", "/login")],
        [S("Forgot password", "/forgot", "Verify reset code"),
         S("Member portal", "/app"),
         S("Receptionist portal", "/desk"),
         S("Coach portal", "/coach"),
         S("Manager portal", "/manager")],
        ncols=2, first_col=1)

    member = portal(
        "25-sf-member",
        [S("Sign in", "/login"), S("My schedule", "/app", "Claim waitlist seat")],
        [S("Book a court", "/app/book", ("Slot hold (5 minutes)", "Scan to pay (payOS)"),
           below=[S("Payment result", "/pay/return")], via="Scan to pay (payOS)"),
         S("Classes", "/app/classes"),
         S("My progress", "/app/train"),
         S("Membership plans", "/app/plans"),
         S("My points", "/app/points"),
         S("Gate pass", "/app/pass"),
         S("AI assistant", "/app/assistant"),
         S("Notifications", "/app/notifications"),
         S("Account settings", "/account")],
        ncols=3)

    reception = portal(
        "26-sf-receptionist",
        [S("Sign in", "/login"), S("Front desk", "/desk", "Close shift")],
        [S("Member profile", "/desk/member/$id", "Edit profile", "Raise a refund",
           ("Reset password", "Hand this over now"), "Scan to pay (payOS)"),
         S("Gate", "/desk/gate"),
         S("Court map", "/desk/courts", "Walk-in payment"),
         S("Classes", "/desk/classes"),
         S("Payments", "/desk/payments", "Scan to pay (payOS)", "Bank transfer QR"),
         S("Day passes", "/desk/day-passes", "Void this pass?"),
         S("Fixed bookings", "/desk/series", "Stop this fixed booking?"),
         S("At risk", "/desk/at-risk"),
         S("Gear", "/desk/gear"),
         S("Maintenance", "/desk/maintenance"),
         S("Alerts", "/alerts")],
        ncols=3)

    coach = portal(
        "27-sf-coach",
        [S("Sign in", "/login"), S("Schedule", "/coach")],
        [S("Attendance", "/coach/attendance", below=[S("Student progress", "/coach/student/$id")]),
         S("Classes", "/coach/classes"),
         S("My earnings", "/coach/earnings"),
         S("Profile", "/account")],
        ncols=2)

    manager = portal(
        "28-sf-manager",
        [S("Sign in", "/login"), S("Reports", "/manager")],
        [S("Classes", "/manager/classes"),
         S("Members", "/manager/members", below=[S("Member profile", "/desk/member/$id")]),
         S("Membership plans", "/manager/plans", "New membership plan", "Plan details"),
         S("Promo codes", "/manager/promos", "New promo code", "Code history"),
         S("Attendance", "/manager/attendance"),
         S("Refund sign-off", "/desk/payments"),
         S("Staff", "/manager/staff", ("Add staff", "Hand this over now"), "Role and access"),
         S("Pricing", "/manager/prices"),
         S("Fixed bookings", "/desk/series"),
         S("Day passes", "/desk/day-passes"),
         S("Coach commission", "/manager/commission"),
         S("E-invoice export", "/manager/invoices"),
         S("Maintenance", "/desk/maintenance"),
         S("Audit log", "/manager/audit"),
         S("Centre settings", "/manager/settings")],
        ncols=3)
    return [public, member, reception, coach, manager]
