"""System Architecture diagram (II.1.1) and Package Diagram (II.1.2).

Both are read off the source tree: src/routes, src/components, src/lib/arena3 (router, handlers, jobs,
notify, payos, gemini), src/lib/auth, src/lib/i18n and src/lib/db.ts. Package dependencies are the
import counts between those folders (scripts-free scan of `from "@/..."` and relative imports).

Layout follows the R7 template (p. 147-148): clients on the left, the server in the middle and the
outside services on the right; the packages sit inside one enclosing package, each named once (a
path is plain text under the name, since guillemets mark a stereotype in UML).
"""

from lib import Diagram, FONT, LINE, INK

BOX = ("rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#475569;strokeWidth=1.2;"
       "fontFamily=Helvetica;fontSize=13;fontColor=#1e293b;")
EXT = ("rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#1e293b;strokeWidth=1.5;"
       "fontFamily=Helvetica;fontSize=14;fontStyle=1;fontColor=#1e293b;")
ZONE = ("rounded=0;whiteSpace=wrap;html=1;fillColor=#f1f5f9;strokeColor=#334155;strokeWidth=1.5;"
        "verticalAlign=top;align=center;spacingTop=6;fontFamily=Helvetica;fontSize=14;fontStyle=1;"
        "fontColor=#1e293b;")
DB = ("shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=14;fillColor=#f1f5f9;"
      "strokeColor=#334155;strokeWidth=1.5;fontFamily=Helvetica;fontSize=13;fontColor=#1e293b;")
FLOW = ("endArrow=block;endFill=1;html=1;rounded=0;edgeStyle=none;strokeColor=" + LINE + ";strokeWidth=1.2;"
        "fontFamily=Helvetica;fontSize=12;fontColor=" + INK + ";labelBackgroundColor=#ffffff;endSize=8;")
BOTH = FLOW + "startArrow=block;startFill=1;startSize=8;"
PKG = ("shape=folder;tabWidth=70;tabHeight=14;tabPosition=left;html=1;whiteSpace=wrap;verticalAlign=top;"
       "align=center;spacingTop=20;fillColor=#ffffff;strokeColor=#475569;strokeWidth=1.2;"
       "fontFamily=Helvetica;fontSize=14;fontColor=#1e293b;")
OUTER = ("shape=folder;tabWidth=230;tabHeight=26;tabPosition=left;html=1;whiteSpace=wrap;verticalAlign=top;"
         "align=left;spacingLeft=10;spacingTop=3;fillColor=none;strokeColor=#334155;strokeWidth=1.5;"
         "fontFamily=Helvetica;fontSize=14;fontStyle=1;fontColor=#1e293b;")
DEP = ("endArrow=open;endFill=0;endSize=10;dashed=1;html=1;rounded=0;edgeStyle=none;strokeColor=" + LINE + ";"
       "strokeWidth=1.2;")

PACKAGES = [
    # id, name, path, x, y, w, h, description
    ("routes", "routes", "src/routes", 290, 70, 200, 70,
     "File-based page routes for the member, desk, coach and manager portals, and the /v1 API entry point"),
    ("components", "components", "src/components", 50, 210, 200, 70,
     "Shared React components: shell, court grid, dialogs, panels and the UI kit"),
    ("auth", "auth", "src/lib/auth", 530, 210, 200, 70,
     "Sign-in gate, session cookie handling and sign-out helpers"),
    ("arena3", "arena3", "src/lib/arena3", 290, 210, 200, 70,
     "Core domain: API router, business rules, pricing, jobs, notifications, payOS and Gemini clients"),
    ("i18n", "i18n", "src/lib/i18n", 50, 370, 200, 70,
     "Vietnamese and English text dictionaries and the language provider"),
    ("handlers", "handlers", "src/lib/arena3/handlers", 290, 370, 200, 70,
     "One request handler module per feature: bookings, classes, desk, plans, reports and more"),
    ("db", "db", "src/lib/db.ts", 530, 370, 200, 70,
     "Database access: Neon PostgreSQL, or embedded PGlite when no DATABASE_URL is set"),
]

# source, target, exit (x, y), entry (x, y), waypoints
DEPS = [
    ("routes", "components", (0, 0.6), (0.5, 0), [(150, 112)]),
    ("routes", "auth", (1, 0.6), (0.5, 0), [(630, 112)]),
    ("routes", "arena3", (0.5, 1), (0.5, 0), ()),
    ("routes", "i18n", (0, 0.3), (0, 0.5), [(30, 91), (30, 405)]),
    ("components", "arena3", (1, 0.5), (0, 0.5), ()),
    ("components", "i18n", (0.5, 1), (0.5, 0), ()),
    ("arena3", "handlers", (0.3, 1), (0.3, 0), ()),
    ("handlers", "arena3", (0.7, 0), (0.7, 1), ()),
    ("arena3", "i18n", (0.1, 1), (0.9, 0), ()),
    ("arena3", "db", (0.9, 1), (0.1, 0), ()),
    ("handlers", "db", (1, 0.5), (0, 0.5), ()),
    ("auth", "db", (0.5, 1), (0.5, 0), ()),
]


def package_rows():
    return [(name, path, desc) for _, name, path, _, _, _, _, desc in PACKAGES]


def package():
    d = Diagram("39-package-diagram", w=780, h=480)
    d.vertex("Arena3 web application (src)", OUTER, 10, 20, 760, 450, id="app", role="container")
    for pid, name, path, x, y, w, h, _ in PACKAGES:
        d.vertex(f'<b>{name}</b><br><font style="font-size:12px" color="#64748b">{path}</font>', PKG,
                 x, y, w, h, id=pid, role="package")
    for k, (a, b, ex, en, pts) in enumerate(DEPS):
        d.edge(a, b, "", DEP, exit=ex, entry=en, points=pts, id=f"dep{k}_{a}_{b}")
    return d


def architecture():
    d = Diagram("38-system-architecture", w=870, h=590)
    d.vertex("Browser (React client)", ZONE, 20, 30, 160, 530, id="browser", role="container")
    ports = [("Public site<br>/, /login, /register", 90), ("Member portal<br>/app", 170),
             ("Front desk<br>/desk", 250), ("Coach portal<br>/coach", 330), ("Manager portal<br>/manager", 410)]
    for i, (t, y) in enumerate(ports):
        d.vertex(t, BOX, 15, y - 30, 130, 60, id=f"portal{i}", parent="browser")
    d.vertex("Web server (TanStack Start on Node.js)", ZONE, 270, 30, 290, 530, id="server", role="container")
    ssr = d.vertex("Page routes (server-side rendering)<br>src/routes", BOX, 20, 50, 250, 60, id="ssr", parent="server")
    api = d.vertex("API router /v1/*<br>router.ts", BOX, 20, 140, 250, 60, id="api", parent="server")
    han = d.vertex("Feature handlers and rules<br>handlers/*.ts, rules.ts, pricing.ts", BOX, 20, 240, 250, 70,
                   id="handlers", parent="server")
    job = d.vertex("Background job loop<br>jobs.ts, runs every 15 seconds", BOX, 20, 350, 250, 60, id="jobs",
                   parent="server")
    nty = d.vertex("Notification sender<br>notify.ts", BOX, 20, 440, 250, 60, id="notify", parent="server")
    d.vertex("payOS", EXT, 690, 40, 160, 60, id="payos")
    d.vertex("Gemini AI", EXT, 690, 140, 160, 60, id="gemini")
    d.vertex("PostgreSQL database<br>(Neon, or PGlite locally)", DB, 690, 250, 160, 120, id="db")
    d.vertex("Mail delivery<br>(SMTP)", EXT, 690, 470, 160, 60, id="smtp")

    d.edge("browser", ssr, "page request", FLOW, exit=(1, 0.15), entry=(0, 0.5), id="f_ssr")
    d.edge("browser", api, "JSON over /v1", FLOW, exit=(1, 0.32), entry=(0, 0.5), id="f_api")
    d.edge(api, han, "dispatch", FLOW, exit=(0.5, 1), entry=(0.5, 0), id="f_dispatch")
    d.edge(han, "payos", "payment link,<br>paid webhook", BOTH, exit=(1, 0.15), entry=(0, 0.5), id="f_payos")
    d.edge(han, "gemini", "question,<br>answer", BOTH, exit=(1, 0.4), entry=(0, 0.5), label_x=0.35, id="f_gemini")
    d.edge(han, "db", "SQL", BOTH, exit=(1, 0.7), entry=(0, 0.46), id="f_sql")
    d.edge(job, "db", "SQL", BOTH, exit=(1, 0.5), entry=(0, 0.85), id="f_jobsql")
    d.edge(job, nty, "queued mail", FLOW, exit=(0.5, 1), entry=(0.5, 0), id="f_queue")
    d.edge(nty, "smtp", "SMTP", FLOW, exit=(1, 0.5), entry=(0, 0.5), id="f_smtp")
    return d


def build():
    return [architecture(), package()]
