"""Patch Arena3-SRS-v2.2.pdf into v2.2.1: new context and use case figures, aligned secondary actors,
UC-32 without Gemini, a Record of Changes row and the version stamp. Usage: patch_v221.py <in.pdf> <out.pdf> <png dir>"""

import os
import sys

import pymupdf

SRC, OUT, PNG = sys.argv[1:4]
# Base-14 fonts with the metrics of the document's Arial and Times New Roman: an embedded TrueType
# maps "-" back to a soft hyphen, which breaks copy and search.
FONTS = {"arial": "helv", "times": "tiro", "timesbd": "tibo"}
METRIC = {k: pymupdf.Font(v) for k, v in FONTS.items()}
INK = (0x11 / 255,) * 3
BORDER = (0.3922, 0.4549, 0.5451)
VALUE_X = 178.3                      # left edge of the Detail column text in the UC spec tables

doc = pymupdf.open(SRC)
log = []


def put(page, xy, text, font, size, color=INK):
    page.insert_text(xy, text, fontname=FONTS[font], fontsize=size, color=color)


def width(text, font, size):
    return METRIC[font].text_length(text, fontsize=size)


def spans(page):
    for b in page.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                yield s


def erase(page, bbox):
    r = pymupdf.Rect(bbox)
    page.add_redact_annot(pymupdf.Rect(r.x0 - 0.3, r.y0 + 1.5, r.x1 + 0.3, r.y1 - 1.5), fill=False)


def apply(page):
    page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE, graphics=pymupdf.PDF_REDACT_LINE_ART_NONE)


def wrap(text, font, size, w):
    lines, cur = [], ""
    for word in text.split(" "):
        trial = (cur + " " + word).strip()
        if cur and width(trial, font, size) > w:
            lines.append(cur)
            cur = word
        else:
            cur = trial
    return lines + [cur]


# 1. Figures: the new PNG fills the free band between the text above and the caption, keeping its shape.
FIGS = {8: "01-context-diagram", 19: "03-uc-account", 20: "04-uc-member-booking", 21: "05-uc-member-classes",
        22: "06-uc-desk-sales", 23: "07-uc-desk-operations", 24: "08-uc-coach", 25: "09-uc-manager-setup",
        26: "10-uc-manager-oversight",
        10: "11-ad-register", 12: "12-ad-book-and-pay", 14: "13-ad-enrol-waitlist", 16: "14-ad-refund",
        29: "24-sf-public", 30: "25-sf-member", 31: "26-sf-receptionist", 32: "27-sf-coach", 33: "28-sf-manager",
        48: "15-sd-register", 55: "16-sd-book-and-pay", 69: "18-sd-refund", 72: "17-sd-gate-checkin"}
for pno, name in FIGS.items():
    page = doc[pno - 1]
    (xref, old), = [(im[0], r) for im in page.get_images(full=True) for r in page.get_image_rects(im[0]) if r.width > 120]
    blocks = [pymupdf.Rect(b[:4]) for b in page.get_text("blocks") if b[1] > 45 and b[3] < 790]
    top = max([b.y1 for b in blocks if b.y1 <= old.y0] + [60]) + 14
    bottom = min(b.y0 for b in blocks if b.y0 >= old.y1) - 14
    path = os.path.join(PNG, name + ".png")
    pix = pymupdf.Pixmap(path)
    scale = min(old.width / pix.width, (bottom - top) / pix.height)
    w, h = pix.width * scale, pix.height * scale
    cx, cy = (old.x0 + old.x1) / 2, (top + bottom) / 2
    page.delete_image(xref)
    page.insert_image(pymupdf.Rect(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2), filename=path)
    log.append(f"p{pno}: {name}.png at {w:.0f}x{h:.0f} pt (was {old.width:.0f}x{old.height:.0f})")

# 2. Secondary Actors cells: (page, old value, new value), each checked against its row label.
SECONDARY = [
    (47, "Email service (SMTP)", "Mail delivery (SMTP)"),                                        # UC-02
    (49, "Email service (SMTP)", "Mail delivery (SMTP)"),                                        # UC-04
    (59, "Receptionist or manager, enrolling on the member's behalf",
     "Receptionist or Manager, enrolling on the member's behalf"),                               # UC-13
    (61, "Coach, who writes the plans and feedback", "None"),                                    # UC-16
    (62, "Gemini AI service; Receptionist, who answers support requests", "Gemini AI"),          # UC-17
    (64, "Member", "payOS"),                                                                     # UC-20
    (65, "Member, if known", "None"),                                                            # UC-21
    (66, "Member; payOS", "payOS"),                                                              # UC-22
    (66, "Guest or member", "None"),                                                             # UC-23
    (67, "Manager, who signs off large refunds; Member, who is notified",
     "Manager, who can raise a refund directly (flow 4b)"),                                      # UC-24
    (70, "Member", "Member, who shows the booking QR code (flow 3b)"),                           # UC-25
    (73, "Guest or member", "None"),                                                             # UC-27
    (74, "Member, who receives the reply", "None"),                                              # UC-29
    (76, "Gemini AI service", "None"),                                                           # UC-32
    (77, "Member, who receives homework", "None"),                                               # UC-33
    (78, "Member", "None"),                                                                      # UC-34
    (81, "Coach, who is assigned", "None"),                                                      # UC-39
    (84, "Receptionist, who raised the refund; Member, who is notified", "None"),                # UC-42
    (84, "Coach, who is paid", "None"),                                                          # UC-43
]
pending = {}
for pno, old_v, new_v in SECONDARY:
    page = doc[pno - 1]
    ss = list(spans(page))
    labels = [s["origin"][1] for s in ss if s["text"].strip() == "Secondary actors"]
    hit = [s for s in ss if abs(s["origin"][0] - VALUE_X) < 1 and s["text"].strip() == old_v
           and any(abs(s["origin"][1] - y) < 0.5 for y in labels)]
    assert len(hit) == 1, (pno, old_v, len(hit))
    erase(page, hit[0]["bbox"])
    pending.setdefault(pno, []).append((hit[0]["origin"], new_v, hit[0]["size"]))
    log.append(f"p{pno}: Secondary actors '{old_v}' -> '{new_v}'")
for pno, items in pending.items():
    page = doc[pno - 1]
    apply(page)
    for origin, text, size in items:
        put(page, origin, text, "arial", size)


# 3. Actors table, Gemini AI description (p.18): two lines become one.
page = doc[17]
ss = list(spans(page))
g1 = [s for s in ss if s["text"].startswith("Google's model. Answers member questions and drafts")]
g2 = [s for s in ss if s["text"].strip() == "data only." and abs(s["origin"][0] - g1[0]["origin"][0]) < 1]
assert len(g1) == 1 and len(g2) == 1
for s in g1 + g2:
    erase(page, s["bbox"])

# 4. II.2 text (p.18): a closing paragraph on the actor rule, set like the paragraph above it.
para = [s for s in ss if abs(s["size"] - 11.5) < 0.1 and 540 < s["origin"][1] < 620 and s["origin"][0] < 75]
base = sorted({round(s["origin"][1], 1) for s in para})
lead = base[-1] - base[-2]
apply(page)
put(page, g1[0]["origin"], "Google's model. Answers member questions from centre data only.", "arial", g1[0]["size"])
new_para = ("Primary actors stand left and secondary actors right. An actor is linked only to the use cases in which "
            "it interacts with Arena3; people who are only served at the counter or notified later are not actors of "
            "those use cases. Figure 6 also shows the four roles specialising Registered User.")
x0, x1 = 70.5, 538.2
lines = wrap(new_para, "times", 11.5, x1 - x0)
y = base[-1] + lead + 9
for k, line in enumerate(lines):
    words = line.split(" ")
    if k == len(lines) - 1 or len(words) == 1:
        put(page, (x0, y), line, "times", 11.5)
    else:
        gap = (x1 - x0 - sum(width(w_, "times", 11.5) for w_ in words)) / (len(words) - 1)
        x = x0
        for w_ in words:
            put(page, (x, y), w_, "times", 11.5)
            x += width(w_, "times", 11.5) + gap
    y += lead
log.append("p18: Gemini AI description; II.2 actor-rule paragraph added")

# 5. UC-32 alternative flow 2b (p.77).
page = doc[76]
ss = list(spans(page))
a = [s for s in ss if s["text"].startswith("2b. The coach asks for an AI suggestion")]
b_ = [s for s in ss if s["text"].startswith("and fills the blocks, which the coach reviews.")]
assert len(a) == 1 and len(b_) == 1
for s in a + b_:
    erase(page, s["bbox"])
apply(page)
text = ("2b. The coach asks for a suggestion: the system fills the blocks with suggested drills for the class "
        "sport and level, and the coach reviews them.")
ox, oy = a[0]["origin"]
step = b_[0]["origin"][1] - oy
for k, line in enumerate(wrap(text, "times", a[0]["size"], 524.5 - ox)):
    put(page, (ox, oy + k * step), line, "times", a[0]["size"])
log.append("p77: UC-32 flow 2b")

# 6. Record of Changes (p.6): a new top row; the rows below move down.
page = doc[5]
cols = [70.5, 125.2, 167.2, 201.8, 246.0, 537.8]
LW = 0.75
row_tops = [173.2, 224.2, 276.0, 305.2, 345.8, 374.2, 403.5]
body = [s for s in spans(page) if 173.2 < s["bbox"][1] < 404]
desc = ("Redrew the context, use case, activity, screen flow and sequence diagrams to the FPT templates and "
        "Learning UML 2.0. Aligned the secondary actors of 19 use cases with their flows, and removed Gemini AI "
        "from UC-32 to match the code.")
desc_lines = wrap(desc, "arial", 8.6, cols[5] - cols[4] - 11)
n = max(len(desc_lines), 2)
H = round(6.6 + 11.2 * n, 1)
page.add_redact_annot(pymupdf.Rect(69.5, 173.7, 539.5, 404.5), fill=False)
page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE,
                      graphics=pymupdf.PDF_REDACT_LINE_ART_REMOVE_IF_TOUCHED, text=pymupdf.PDF_REDACT_TEXT_REMOVE)
tops = [row_tops[0], row_tops[0] + H] + [t + H for t in row_tops[1:]]
for t0, t1 in zip(tops, tops[1:]):
    for c in cols:
        page.draw_rect(pymupdf.Rect(c, t0, c + LW, t1), color=None, fill=BORDER, width=0)
    page.draw_rect(pymupdf.Rect(cols[0], t1 - LW, cols[5] + LW, t1), color=None, fill=BORDER, width=0)
for s in body:
    put(page, (s["origin"][0], s["origin"][1] + H), s["text"], "arial", s["size"])
first = row_tops[0] + 11.3
for x, text in ((76.2, "2026-10-12"), (130.9, "2.2.1"), (172.8, "M")):
    put(page, (x, first), text, "arial", 8.6)
put(page, (207.4, first), "Arena3", "arial", 8.6)
put(page, (207.4, first + 11.2), "team", "arial", 8.6)
for k, line in enumerate(desc_lines):
    put(page, (251.8, first + k * 11.2), line, "arial", 8.6)
log.append(f"p6: Record of Changes row 2.2.1 ({len(desc_lines)} lines)")

# 7. Version stamp: running header on every page and the cover.
for page in doc:
    found = [s for s in spans(page) if s["text"].replace(" ", " ").strip() == "Version 2.2"]
    for s in found:
        erase(page, s["bbox"])
    if found:
        apply(page)
    for s in found:
        font = "timesbd" if "Bold" in s["font"] else "times"
        text = "Version 2.2.1"
        if s["size"] > 10:          # cover: centred
            x = (s["bbox"][0] + s["bbox"][2]) / 2 - width(text, font, s["size"]) / 2
        else:                       # running header: right-aligned
            x = s["bbox"][2] - width(text, font, s["size"])
        put(page, (x, s["origin"][1]), text, font, s["size"], color=pymupdf.sRGB_to_pdf(s["color"]))
meta = doc.metadata
meta["subject"] = "SRS version 2.2.1"
meta["modDate"] = pymupdf.get_pdf_now()
doc.set_metadata(meta)
doc.save(OUT, garbage=3, deflate=True)
print("\n".join(log))
print("saved", OUT)
