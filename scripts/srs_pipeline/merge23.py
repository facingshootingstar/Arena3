"""python merge23.py <cover.pdf> <body.pdf> <out.pdf> <pages.json> <final.html>

Stamps the running header and "Page N of M" on every body page, puts the cover first (page 1, unstamped)
and adds PDF bookmarks for the headings and figures.
"""

import html
import json
import re
import sys

import pymupdf

cover, body, out, pages_json, final_html = sys.argv[1:6]
FONT = r"C:/Windows/Fonts/times.ttf"
GREY = (0.28, 0.33, 0.41)
CM = 72 / 2.54
TITLE = "Arena 3 — Software Requirement Specification"
VER = "Version 2.3"

doc = pymupdf.open(body)
total = len(doc) + 1
font = pymupdf.Font(fontfile=FONT)
for i, page in enumerate(doc):
    w, h = page.rect.width, page.rect.height
    assert w < h, f"page {i + 2} is not portrait"
    left, right, top = 2.5 * CM, w - 2 * CM, 1.35 * CM
    page.insert_font(fontname="tnr", fontfile=FONT)
    page.insert_text((left, top), TITLE, fontname="tnr", fontsize=8.5, color=GREY)
    page.insert_text((right - font.text_length(VER, 8.5), top), VER, fontname="tnr", fontsize=8.5, color=GREY)
    page.draw_line((left, top + 4), (right, top + 4), color=(0.8, 0.84, 0.88), width=0.5)
    num = f"Page {i + 2} of {total}"
    page.insert_text(((w - font.text_length(num, 9)) / 2, h - 1.2 * CM), num, fontname="tnr", fontsize=9,
                     color=GREY)

final = pymupdf.open(cover)
final.insert_pdf(doc)
pages = json.load(open(pages_json, encoding="utf-8"))
src = open(final_html, encoding="utf-8").read()


def plain(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()


outline = [[1, "Cover", 1]]
for level, hid, inner in re.findall(r'<h([1-5]) id="(h\d+)"[^>]*>(.*?)</h\1>', src, flags=re.S):
    outline.append([int(level), plain(inner), pages[hid] + 1])
fixed = []
last = 0
for lvl, title, pg in outline:
    lvl = min(lvl, last + 1)
    fixed.append([lvl, title, pg])
    last = lvl
final.set_toc(fixed)
final.set_metadata({"title": "Sport Center Management System — Software Requirement Specification",
                    "author": "Arena3 team", "subject": "SRS version 2.3", "creator": "Arena3 team"})
final.save(out, garbage=3, deflate=True)
print(f"{len(final)} pages, {len(fixed)} bookmarks -> {out}")
