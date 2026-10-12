"""Context diagram (DFD level 0), laid out like the R7 template (FPT Report 7, p. 20).

One circle for the whole system, one rectangle per external entity, and two
one-way data flows per entity, each labelled beside its arrow. Human entities
sit left, top and bottom; external systems sit right. Entity names are the actor
names of section 2.1 and every flow label is copied word for word from the
external-entity table of section 1, so the figure and the table cannot drift.
"""

import math

from lib import CHAR_W, Diagram, INK, LINE

W = 1300
CX, CY, R = 650, 460, 240
ENT_W, ENT_H = 180, 80
LANE = 20       # half the gap between the two arrows of one entity
ROW = 180       # vertical distance between side entities
STEM = 120      # length of the top and bottom flows
SIZE = 15       # flow label font size

ENTITY = ("rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#334155;strokeWidth=1.5;"
          "fontFamily=Helvetica;fontSize=16;fontStyle=1;fontColor=#1e293b;")
PROCESS = ("ellipse;aspect=fixed;whiteSpace=wrap;html=1;fillColor=#f1f5f9;strokeColor=#1e293b;strokeWidth=2;"
           "fontFamily=Helvetica;fontSize=20;fontStyle=1;fontColor=#1e293b;")
FLOW = ("endArrow=block;endFill=1;endSize=8;html=1;rounded=0;edgeStyle=none;strokeColor=" + LINE + ";"
        "strokeWidth=1.5;fontFamily=Helvetica;fontSize=" + str(SIZE) + ";fontColor=" + INK + ";"
        "labelBackgroundColor=#ffffff;")

# name, side, slot (row offset on the left and right), data into Arena3, data out of Arena3
ENTITIES = [
    ("Guest", "left", -1, "Registration details,<br>OTP code", "Public schedule,<br>prices, OTP prompt"),
    ("Member", "left", 0, "Booking, enrolment<br>and plan requests,<br>online payments",
     "Booking confirmations,<br>QR pass, notifications"),
    ("Receptionist", "left", 1, "Walk-ins, check-ins,<br>counter payments,<br>refund requests",
     "Court map, payment<br>queue, receipts"),
    ("Coach", "top", 0, "Attendance, results,<br>training plans", "Teaching schedule,<br>rosters, earnings"),
    ("Manager", "bottom", 0, "Prices, plans, staff,<br>settings, refund approvals", "Reports, audit log,<br>e-invoices"),
    ("payOS", "right", -1, "Signed &quot;paid&quot;<br>webhook", "Payment link<br>request"),
    ("Mail delivery (SMTP)", "right", 0, "Delivery result", "OTP codes, reminders,<br>notices"),
    ("Gemini AI", "right", 1, "Assistant answer", "Member question with<br>centre context only"),
]


def label_size(text):
    lines = text.replace("&quot;", '"').split("<br>")
    w = max(len(l) for l in lines) * CHAR_W * SIZE / 12 + 6
    h = len(lines) * 14 * SIZE / 11 + 2
    return w, h


def on_circle(px, py):
    return ((px - (CX - R)) / (2 * R), (py - (CY - R)) / (2 * R))


def build():
    top_y = CY - R - STEM - ENT_H
    d = Diagram("01-context-diagram", w=W, h=int(CY + R + STEM + ENT_H + top_y))
    proc = d.vertex("Arena3 Sports Centre<br>Management System", PROCESS, CX - R, CY - R, 2 * R, 2 * R,
                    id="process", shape="ellipse")
    for i, (name, side, slot, inflow, outflow) in enumerate(ENTITIES):
        flows = []
        if side in ("left", "right"):
            row = CY + slot * ROW
            x = 20 if side == "left" else W - 20 - ENT_W
            top = row - ENT_H / 2
            ent = d.vertex(name, ENTITY, x, top, ENT_W, ENT_H, id=f"ent{i}")
            sign = -1 if side == "left" else 1
            ent_edge = x + ENT_W if side == "left" else x
            # labels sit in the clear strip between the entity and the circle's bounding square
            centre = (ent_edge + CX + sign * R) / 2
            for k, text in enumerate((inflow, outflow)):
                y = row + (-LANE if k == 0 else LANE)
                px = CX + sign * math.sqrt(R * R - (y - CY) ** 2)
                lh = label_size(text)[1]
                shift = centre - (ent_edge + px) / 2
                off = (shift, -(lh / 2 + 4)) if k == 0 else (shift, lh / 2 + 4)
                flows.append((text, (1 if side == "left" else 0, (y - top) / ENT_H), on_circle(px, y), off))
        else:
            left = CX - ENT_W / 2
            top = top_y if side == "top" else CY + R + STEM
            ent = d.vertex(name, ENTITY, left, top, ENT_W, ENT_H, id=f"ent{i}")
            sign = -1 if side == "top" else 1
            for k, text in enumerate((inflow, outflow)):
                x = CX + (-LANE if k == 0 else LANE)
                py = CY + sign * math.sqrt(R * R - (x - CX) ** 2)
                lw = label_size(text)[0]
                off = (-(lw / 2 + 8), 0) if k == 0 else (lw / 2 + 8, 0)
                flows.append((text, ((x - left) / ENT_W, 1 if side == "top" else 0), on_circle(x, py), off))
        (tin, ein, cin, oin), (tout, eout, cout, oout) = flows
        d.edge(ent, proc, tin, FLOW, exit=ein, entry=cin, label_offset=oin, id=f"f{i}in")
        d.edge(proc, ent, tout, FLOW, exit=cout, entry=eout, label_offset=oout, id=f"f{i}out")
    return d
