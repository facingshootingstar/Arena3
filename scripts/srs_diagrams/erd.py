"""Conceptual ERD in the FPT template's Chen style (R7 p. 37): entities, verb diamonds, 1/N/M cardinality.

The 17 entities are drawn in two figures on one grid of four columns so the names stay readable on an
A4 portrait page: courts, bookings and payments, then members, plans and classes. User, Payment and
Court appear in both figures, where they link the two halves.
"""

from lib import Diagram, LINE

FONT = "fontFamily=Helvetica;fontSize=13;fontColor=#1e293b;"
ENTITY = ("rounded=0;whiteSpace=wrap;html=1;fillColor=#f1f5f9;strokeColor=#334155;strokeWidth=1.5;"
          + FONT + "fontStyle=1;")
REL = ("rhombus;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#334155;strokeWidth=1.2;" + FONT)
CARD = "text;html=1;align=center;verticalAlign=middle;" + FONT + "fontStyle=1;"
JOIN = "html=1;rounded=0;edgeStyle=none;endArrow=none;strokeColor=" + LINE + ";strokeWidth=1.2;"

EW, EH = 124, 40
RW, RH = 96, 52
COL = [90, 360, 630, 900]                 # entity centres, 270 px apart
ROW = [50 + 120 * k for k in range(7)]    # rows of entities (even) and diamonds (odd)
MID = [(a + b) / 2 for a, b in zip(COL, COL[1:])]

TIP = {"l": (0, 0.5), "r": (1, 0.5), "t": (0.5, 0), "b": (0.5, 1)}


def chen(name, entities, relations, joins):
    """entities: id -> (label, cx, cy, w); relations: id -> (verb, cx, cy);
    joins: (entity, relation, cardinality, side of the entity, x or y on that side, diamond tip, bends, flip)."""
    d = Diagram(name, w=1020, h=ROW[-1] + 80)
    for eid, (label, cx, cy, w) in entities.items():
        d.vertex(label, ENTITY, cx - w / 2, cy - EH / 2, w, EH, id=eid)
    for rid, (verb, cx, cy) in relations.items():
        d.vertex(verb, REL, cx - RW / 2, cy - RH / 2, RW, RH, id=rid, shape="rhombus")

    for n, (eid, rid, card, side, at, tip, bends, flip) in enumerate(joins):
        ex, ey, ew, eh = d.abs_of(eid)
        start = {"t": (at, ey), "b": (at, ey + eh), "l": (ex, at), "r": (ex + ew, at)}[side]
        exit = ((start[0] - ex) / ew, (start[1] - ey) / eh)
        d.edge(eid, rid, style=JOIN, points=bends, exit=exit, entry=TIP[tip], id=f"j{n}")
        nxt = bends[0] if bends else d._anchor(rid, TIP[tip])
        dx, dy = nxt[0] - start[0], nxt[1] - start[1]
        if abs(dy) > abs(dx):
            x = start[0] - 21 if flip else start[0] + 5
            y = start[1] + 3 if dy > 0 else start[1] - 19
        else:
            x = start[0] + 4 if dx > 0 else start[0] - 20
            y = start[1] + 3 if flip else start[1] - 19
        d.vertex(card, CARD, x, y, 16, 16, id=f"c{n}", role="label")
    return d


def courts_and_payments():
    A, B, C, D = COL
    r0, r1, r2, r3, r4 = ROW[:5]
    user_w = 330
    entities = {
        "promo": ("Promotion", A, r0, EW), "invoice": ("Invoice", B, r0, EW),
        "item": ("EquipmentItem", C, r0, EW), "rule": ("PriceRule", D, r0, EW),
        "shiftc": ("CashierShift", A, r2, EW), "pay": ("Payment", B, r2, EW),
        "booking": ("CourtBooking", C, r2, EW), "court": ("Court", D, r2, EW),
        "user": ("User", (B + C) / 2, r4, user_w), "wo": ("WorkOrder", D, r4, EW),
    }
    relations = {
        "r_disc": ("discounts", A, r1), "r_bills": ("bills", B, r1), "r_rents": ("rents", C, r1),
        "r_prices": ("prices", D, r1), "r_collects": ("collects", MID[0], r2), "r_settle": ("settles", MID[1], r2),
        "r_hosts": ("hosts", MID[2], r2), "r_pays": ("pays", B, r3), "r_makes": ("makes", C, r3),
        "r_needs": ("needs", D, r3),
    }
    low = r2 - EH / 2 - 26            # the discounts line runs under the r1 diamonds, above the r2 row
    joins = [
        ("promo", "r_disc", "1", "b", A, "t", (), False),
        ("pay", "r_disc", "N", "t", B - 40, "b", [(B - 40, low), (A, low)], True),
        ("invoice", "r_bills", "1", "b", B, "t", (), False),
        ("pay", "r_bills", "1", "t", B, "b", (), False),
        ("item", "r_rents", "N", "b", C, "t", (), False),
        ("booking", "r_rents", "M", "t", C, "b", (), False),
        ("rule", "r_prices", "N", "b", D, "t", (), False),
        ("court", "r_prices", "1", "t", D, "b", (), False),
        ("shiftc", "r_collects", "1", "r", r2, "l", (), False),
        ("pay", "r_collects", "N", "l", r2, "r", (), False),
        ("pay", "r_settle", "N", "r", r2, "l", (), False),
        ("booking", "r_settle", "1", "l", r2, "r", (), False),
        ("booking", "r_hosts", "N", "r", r2, "l", (), False),
        ("court", "r_hosts", "1", "l", r2, "r", (), False),
        ("pay", "r_pays", "N", "b", B, "t", (), False),
        ("user", "r_pays", "1", "t", B, "b", (), False),
        ("booking", "r_makes", "N", "b", C, "t", (), False),
        ("user", "r_makes", "1", "t", C, "b", (), False),
        ("court", "r_needs", "1", "b", D, "t", (), False),
        ("wo", "r_needs", "N", "t", D, "b", (), False),
    ]
    d = chen("19-erd-conceptual", entities, relations, joins)
    d.h = r4 + 60
    return d


def members_and_classes():
    A, B, C, D = COL
    r0, r1, r2, r3, r4, r5, r6 = ROW
    uw = EW
    teach, enrol = C - 50, C + 50
    entities = {
        "pay": ("Payment", B, r0, EW), "review": ("ProgressReview", C, r0, EW),
        "plan": ("MembershipPlan", A, r2, EW), "sub": ("Subscription", B, r2, EW),
        "user": ("User", C, r2, uw), "att": ("Attendance", D, r2, EW),
        "tplan": ("TrainingPlan", B, r4, EW), "tclass": ("TrainingClass", C, r4, uw),
        "csession": ("ClassSession", D, r4, EW), "court": ("Court", D, r6, EW),
    }
    relations = {
        "r_settle": ("settles", B, r1), "r_receives": ("receives", C, r1),
        "r_defines": ("defines", MID[0], r2), "r_holds": ("holds", MID[1], r2), "r_logs": ("logs", MID[2], r2),
        "r_teaches": ("teaches", teach, r3), "r_enrols": ("enrols in", enrol, r3), "r_records": ("records", D, r3),
        "r_follows": ("follows", MID[1], r4), "r_has": ("has", MID[2], r4), "r_hosts": ("hosts", D, r5),
    }
    joins = [
        ("pay", "r_settle", "N", "b", B, "t", (), False),
        ("sub", "r_settle", "1", "t", B, "b", (), False),
        ("review", "r_receives", "N", "b", C, "t", (), False),
        ("user", "r_receives", "1", "t", C, "b", (), False),
        ("plan", "r_defines", "1", "r", r2, "l", (), False),
        ("sub", "r_defines", "N", "l", r2, "r", (), False),
        ("sub", "r_holds", "N", "r", r2, "l", (), False),
        ("user", "r_holds", "1", "l", r2, "r", (), False),
        ("user", "r_logs", "1", "r", r2, "l", (), False),
        ("att", "r_logs", "N", "l", r2, "r", (), False),
        ("user", "r_teaches", "1", "b", teach, "t", (), True),
        ("tclass", "r_teaches", "N", "t", teach, "b", (), True),
        ("user", "r_enrols", "M", "b", enrol, "t", (), False),
        ("tclass", "r_enrols", "N", "t", enrol, "b", (), False),
        ("att", "r_records", "N", "b", D, "t", (), False),
        ("csession", "r_records", "1", "t", D, "b", (), False),
        ("tplan", "r_follows", "N", "r", r4, "l", (), False),
        ("tclass", "r_follows", "1", "l", r4, "r", (), False),
        ("tclass", "r_has", "1", "r", r4, "l", (), False),
        ("csession", "r_has", "N", "l", r4, "r", (), False),
        ("csession", "r_hosts", "N", "b", D, "t", (), False),
        ("court", "r_hosts", "1", "t", D, "b", (), False),
    ]
    return chen("44-erd-conceptual-2", entities, relations, joins)


def build():
    return [courts_and_payments(), members_and_classes()]
