"""Domain class diagrams (UML 2.0 class notation, Learning UML 2.0 ch. 4 and 5).

Each class has three compartments split by <hr>: name, attributes, operations.
Attributes are private (-) and operations public (+). Associations carry a
multiplicity at both ends; a filled diamond marks composition at the whole, and a
dashed line with a hollow triangle marks realization of an interface.
Attribute names follow the PostgreSQL columns in migrations/ in camelCase.

Each module is drawn in two figures of two columns so the text stays readable on an A4 portrait
page (the R7 template draws one small class diagram per feature, p. 153-172). A class drawn in both
figures shows all its compartments once; the other figure shows its name and attributes only.
"""

from lib import Diagram, LINE, INK, CHAR_W

CLASS = ("verticalAlign=top;align=left;overflow=fill;fontSize=12;fontFamily=Helvetica;html=1;whiteSpace=wrap;"
         "fillColor=#f8fafc;strokeColor=#475569;")
IFACE = CLASS.replace("fillColor=#f8fafc", "fillColor=#eef2ff")
ENUM = CLASS.replace("fillColor=#f8fafc", "fillColor=#ffffff")
MULT = "text;html=1;align=center;verticalAlign=middle;fontFamily=Helvetica;fontSize=12;fontColor=" + INK + ";"
_LINE = ("html=1;rounded=0;edgeStyle=none;strokeColor=" + LINE + ";strokeWidth=1.2;fontFamily=Helvetica;"
         "fontSize=11;fontColor=" + INK + ";labelBackgroundColor=#ffffff;")
ASSOC = _LINE + "endArrow=none;"
COMPOSE = _LINE + "startArrow=diamondThin;startFill=1;startSize=16;endArrow=none;"
REALIZE = _LINE + "endArrow=block;endFill=0;endSize=12;dashed=1;"
USES = _LINE + "endArrow=open;endSize=10;dashed=1;"
GENERAL = _LINE + "endArrow=block;endFill=0;endSize=12;"

W = 250
COLS = [40, 365, 690, 1015, 1340]
LINE_PX = 14.4
HR_PX = 14
PAD_PX = 6


def lines_of(attrs, ops):
    return len(attrs) + len(ops)


def cls(d, cid, name, attrs, ops, x, y, w=W, kind="class"):
    """A class box sized to its compartments; returns the id. An empty operation compartment is suppressed."""
    if kind == "interface":
        head, style, head_lines = "&laquo;interface&raquo;<br><b>" + name + "</b>", IFACE, 2
        comps = [ops]
    elif kind == "enum":
        head, style, head_lines = "&laquo;enumeration&raquo;<br><b>" + name + "</b>", ENUM, 2
        comps = [attrs]
    else:
        head, style, head_lines = "<b>" + name + "</b>", CLASS, 1
        comps = [attrs, ops] if ops else [attrs]
    value = '<p style="margin:0px;margin-top:4px;text-align:center;">' + head + "</p>"
    for items in comps:
        value += '<hr><p style="margin:0px;margin-left:6px;">' + "<br>".join(items) + "</p>"
    n = head_lines + sum(len(c) for c in comps)
    h = round(4 + LINE_PX * n + HR_PX * len(comps) + PAD_PX)
    longest = max([len(name) + (14 if kind != "class" else 0)] + [len(s) for s in attrs + ops])
    need = longest * CHAR_W + 16
    assert need <= w, f"{name}: needs width {need:.0f} > {w}"
    return d.vertex(value, style, x, y, w, h, id=cid)


def box(d, cid):
    c = d.by_id[cid]
    return c["x"], c["y"], c["w"], c["h"]


def at(d, cid, side, v):
    """Anchor on a side: L/R take an absolute y, T/B take an absolute x."""
    x, y, w, h = box(d, cid)
    if side == "L":
        return (0, (v - y) / h)
    if side == "R":
        return (1, (v - y) / h)
    if side == "T":
        return ((v - x) / w, 0)
    return ((v - x) / w, 1)


def point(d, cid, rel):
    x, y, w, h = box(d, cid)
    return (x + rel[0] * w, y + rel[1] * h)


def mult_label(d, text, p, q, flip=False):
    """Multiplicity beside the end p of a segment p->q: above a horizontal line (below when flipped),
    right of a vertical one (left when flipped)."""
    w = len(text) * CHAR_W + 14
    h = 16
    if abs(q[1] - p[1]) < 1:
        s = 1 if q[0] > p[0] else -1
        x = p[0] + 3 if s > 0 else p[0] - 3 - w
        y = p[1] + 3 if flip else p[1] - 3 - h
    else:
        s = 1 if q[1] > p[1] else -1
        y = p[1] + 3 if s > 0 else p[1] - 3 - h
        x = p[0] - 3 - w if flip else p[0] + 3
    d.vertex(text, MULT, x, y, w, h, role="label")


def link(d, a, b, ma, mb, ea, eb, style=ASSOC, name="", points=(), flip_a=False, flip_b=None,
         name_x=None, name_off=None):
    """Association a -> b with multiplicities ma (at a) and mb (at b); ea/eb are (side, coord) anchors."""
    ra, rb = at(d, a, *ea), at(d, b, *eb)
    pa, pb = point(d, a, ra), point(d, b, rb)
    path = [pa] + list(points) + [pb]
    if ma:
        mult_label(d, ma, path[0], path[1], flip_a)
    if mb:
        if flip_b is None:
            flip_b = len(path) == 2 and abs(pa[1] - pb[1]) < 1
        mult_label(d, mb, path[-1], path[-2], flip_b)
    return d.edge(a, b, name, style, points=points, exit=ra, entry=rb, label_x=name_x, label_offset=name_off)


def x_mid(col):
    return COLS[col] + W / 2


# ---------------------------------------------------------------- layout helpers

X0, X1 = 40, 400                 # two columns, 110 px apart
XM0, XM1 = X0 + W / 2, X1 + W / 2
LANE = (X0 + W + X1) / 2         # the middle of the gap between the columns
RIGHT = X1 + W + 50              # a lane to the right of the second column
RIGHT2 = RIGHT + 30
LEFT = X0 - 70                   # a lane to the left of the first column


def bottom(d, cid, gap=0):
    x, y, w, h = box(d, cid)
    return y + h + gap


def top(d, cid, dy=0):
    return box(d, cid)[1] + dy


# Full definitions, used where the class belongs; elsewhere a class shows its name and attributes only.
USER_FULL = (["- memberCode: String", "- fullName: String", "- phone: String", "- email: String",
              "- role: UserRole", "- status: UserStatus"],
             ["+ signIn(phone, password): Session", "+ changePassword(old, new): void"])
USER_BRIEF = ["- memberCode: String", "- fullName: String", "- phone: String", "- role: UserRole"]
PAYABLE_OPS = ["+ amountDue(): Integer", "+ settle(payment: Payment): void"]


# ---------------------------------------------------------------- 3.1 booking and payment


def booking_courts():
    d = Diagram("20-cd-booking-payment", w=760, h=1300)
    cls(d, "rule", "PriceRule",
        ["- sport: SportKind", "- dayKind: DayKind", "- startLocal: Time", "- endLocal: Time",
         "- priceVnd: Integer", "- isPeak: Boolean"],
        ["+ priceFor(slot: TimeSlot): Integer"], X1, 40)
    y = bottom(d, "rule", 60)
    cls(d, "court", "Court", ["- courtCode: String", "- sport: SportKind", "- status: CourtStatus"],
        ["+ isFree(start, end): Boolean", "+ setStatus(status): void"], X1, y)
    cls(d, "occ", "Occupancy",
        ["- startAt: DateTime", "- endAt: DateTime", "- kind: OccupancyKind", "- refId: UUID", "- reason: String"],
        ["+ overlaps(start, end): Boolean"], X0, y)
    y = bottom(d, "court", 60)
    cls(d, "booking", "CourtBooking",
        ["- code: String", "- startAt: DateTime", "- endAt: DateTime", "- status: BookingStatus",
         "- channel: String", "- priceVnd: Integer", "- depositVnd: Integer", "- paidVnd: Integer",
         "- holdUntil: DateTime", "- quotaHours: Decimal"],
        ["+ hold(): void", "+ confirm(): void", "+ reschedule(newStart): void", "+ cancel(): RefundQuote",
         "+ checkIn(): void", "+ markNoShow(): void"], X1, y)
    cls(d, "user", "User", *USER_FULL, X0, y)
    cls(d, "series", "BookingSeries",
        ["- code: String", "- weekday: Integer", "- startLocal: Time", "- weeks: Integer", "- startsOn: Date",
         "- discountPct: Integer", "- status: SeriesStatus"],
        ["+ generateBookings(): void", "+ cancel(): void"], X0, bottom(d, "user", 40))
    cls(d, "bstat", "BookingStatus", ["hold", "confirmed", "in_use", "completed", "cancelled", "no_show"], [],
        X0, bottom(d, "series", 50), kind="enum")
    cls(d, "payable", "Payable", [], PAYABLE_OPS, X1, bottom(d, "booking", 70), kind="interface")
    cls(d, "pass", "DayPass",
        ["- code: String", "- guestName: String", "- validOn: Date", "- priceVnd: Integer",
         "- status: DayPassStatus"],
        ["+ markUsed(): void", "+ voidPass(): void"], X1, bottom(d, "payable", 70))

    b_top, b_bot = top(d, "booking"), bottom(d, "booking")
    link(d, "rule", "court", "0..*", "0..1", ("B", XM1), ("T", XM1))
    link(d, "court", "occ", "1", "0..*", ("L", top(d, "court", 30)), ("R", top(d, "court", 30)))
    link(d, "court", "booking", "1", "0..*", ("B", XM1), ("T", XM1))
    link(d, "booking", "occ", "0..1", "0..1", ("L", b_top + 25), ("R", bottom(d, "occ") - 15),
         points=[(LANE, b_top + 25), (LANE, bottom(d, "occ") - 15)], flip_b=True)
    link(d, "user", "booking", "0..1", "0..*", ("R", b_top + 60), ("L", b_top + 60))
    sy = top(d, "series", 30)
    link(d, "series", "booking", "0..1", "1..*", ("R", sy), ("L", sy))
    link(d, "booking", "bstat", "", "", ("L", b_bot - 12), ("R", top(d, "bstat", 30)), style=USES,
         points=[(LANE, b_bot - 12), (LANE, top(d, "bstat", 30))])
    link(d, "booking", "payable", "", "", ("B", XM1), ("T", XM1), style=REALIZE)
    link(d, "pass", "payable", "", "", ("T", XM1), ("B", XM1), style=REALIZE)
    return d


def booking_payments():
    d = Diagram("40-cd-booking-payment-2", w=760, h=1300)
    cls(d, "pstat", "PayStatus", ["pending", "posted", "expired", "failed", "refund_pending", "refund_rejected"],
        [], X0, 40, kind="enum")
    cls(d, "method", "PayMethod", ["cash", "transfer", "card", "gateway", "quota"], [], X0,
        bottom(d, "pstat", 40), kind="enum")
    cls(d, "payable", "Payable", [], PAYABLE_OPS, X1, 40, kind="interface")
    y = bottom(d, "method", 40)
    cls(d, "pay", "Payment",
        ["- code: String", "- method: PayMethod", "- amountVnd: Integer", "- vatRate: Decimal",
         "- status: PayStatus", "- provider: String", "- providerOrderCode: Long", "- paidAt: DateTime"],
        ["+ post(): void", "+ verifyOnline(): PayStatus", "+ refund(amount, reason): Payment",
         "+ approveRefund(by: User): void", "+ rejectRefund(by: User): void"], X1, y)
    cls(d, "user", "User", USER_BRIEF, [], X0, y)
    cls(d, "cshift", "CashierShift", ["- openedAt: DateTime", "- closedAt: DateTime", "- cashDeclaredVnd: Integer"],
        ["+ open(): void", "+ close(cashDeclared): ShiftSummary"], X0, bottom(d, "user", 50))
    cls(d, "redeem", "PromotionRedemption",
        ["- discountVnd: Integer", "- status: RedemptionStatus", "- restoredAt: DateTime"],
        ["+ restore(): void"], X0, bottom(d, "cshift", 50))
    cls(d, "promo", "Promotion",
        ["- code: String", "- kind: PromoKind", "- value: Integer", "- maxDiscountVnd: Integer",
         "- minOrderVnd: Integer", "- startsAt: DateTime", "- endsAt: DateTime", "- maxUses: Integer",
         "- maxPerMember: Integer", "- status: PromoStatus"],
        ["+ quote(amount, member): Integer"], X0, bottom(d, "redeem", 50))
    cls(d, "inv", "Invoice",
        ["- code: String", "- formNo: String", "- serialNo: String", "- buyerName: String",
         "- buyerTaxCode: String", "- subtotalVnd: Integer", "- vatVnd: Integer", "- totalVnd: Integer",
         "- issuedAt: DateTime"],
        ["+ export(): File"], X1, bottom(d, "pay", 60))
    cls(d, "line", "InvoiceLine",
        ["- description: String", "- unit: String", "- qty: Integer", "- unitVnd: Integer", "- amountVnd: Integer"],
        [], X1, bottom(d, "inv", 60))

    p_top, p_bot = top(d, "pay"), bottom(d, "pay")
    link(d, "pay", "payable", "0..*", "1", ("T", XM1), ("B", XM1), name="pays for")
    link(d, "pay", "pstat", "", "", ("L", p_top + 15), ("R", top(d, "pstat", 30)), style=USES,
         points=[(LANE, p_top + 15), (LANE, top(d, "pstat", 30))])
    link(d, "pay", "method", "", "", ("L", p_top + 35), ("R", top(d, "method", 30)), style=USES,
         points=[(LANE - 25, p_top + 35), (LANE - 25, top(d, "method", 30))])
    link(d, "pay", "user", "0..*", "0..1", ("L", p_top + 75), ("R", p_top + 75))
    link(d, "cshift", "user", "0..*", "1", ("T", XM0), ("B", XM0))
    ty = top(d, "cshift", 30)
    link(d, "pay", "cshift", "0..*", "0..1", ("L", ty), ("R", ty), name="is taken in", name_off=(0, 14), flip_b=False)
    link(d, "pay", "redeem", "1", "0..1", ("L", p_bot - 12), ("R", top(d, "redeem", 30)),
         points=[(LANE, p_bot - 12), (LANE, top(d, "redeem", 30))], flip_b=True)
    link(d, "redeem", "promo", "0..*", "1", ("B", XM0), ("T", XM0))
    link(d, "pay", "inv", "1", "0..1", ("B", XM1), ("T", XM1))
    link(d, "inv", "line", "1", "1..*", ("B", XM1), ("T", XM1), style=COMPOSE)
    return d


# ---------------------------------------------------------------- 3.2 membership and classes


def membership_plans():
    d = Diagram("21-cd-membership-classes", w=760, h=800)
    cls(d, "payable", "Payable", [], PAYABLE_OPS, X1, 40, kind="interface")
    y = bottom(d, "payable", 60)
    cls(d, "sub", "Subscription",
        ["- sportScope: SportKind", "- startOn: Date", "- endOn: Date", "- status: SubStatus",
         "- courtHoursLeft: Decimal", "- sessionLeft: Integer", "- frozenDays: Integer",
         "- promoDiscountVnd: Integer"],
        ["+ activate(): void", "+ decline(): void", "+ freeze(days: Integer): void", "+ unfreeze(): void",
         "+ useSession(): void"], X1, y)
    cls(d, "plan", "MembershipPlan",
        ["- name: String", "- sportScope: SportKind", "- durationDays: Integer", "- sessionQuota: Integer",
         "- courtHours: Integer", "- courtDiscountPct: Integer", "- priceVnd: Integer", "- isOnSale: Boolean",
         "- carryOverHours: Boolean"],
        ["+ sell(member: User): Subscription", "+ setOnSale(flag: Boolean): void"], X0, y)
    cls(d, "user", "User", USER_BRIEF, ["+ loyaltyPoints(): Integer"], X1, bottom(d, "sub", 60))
    cls(d, "substat", "SubStatus", ["pending", "active", "expired", "frozen"], [], X0, bottom(d, "plan", 60),
        kind="enum")

    s_bot = bottom(d, "sub")
    link(d, "sub", "payable", "", "", ("T", XM1), ("B", XM1), style=REALIZE)
    link(d, "plan", "sub", "1", "0..*", ("R", y + 30), ("L", y + 30))
    link(d, "sub", "user", "0..*", "1", ("B", XM1), ("T", XM1))
    link(d, "sub", "substat", "", "", ("L", s_bot - 15), ("R", top(d, "substat", 30)), style=USES,
         points=[(LANE, s_bot - 15), (LANE, top(d, "substat", 30))])
    return d


def membership_classes():
    d = Diagram("41-cd-membership-classes-2", w=800, h=1000)
    cls(d, "user", "User", USER_BRIEF, ["+ loyaltyPoints(): Integer"], X0, 40)
    cls(d, "tclass", "TrainingClass",
        ["- sport: SportKind", "- level: String", "- capacity: Integer", "- enrolledCount: Integer",
         "- rrule: String", "- durationMin: Integer", "- startOn: Date", "- endOn: Date",
         "- status: ClassStatus"],
        ["+ publish(): void", "+ generateSessions(): void", "+ enrol(member: User): Enrollment",
         "+ assignCoach(coach: User): void", "+ cancel(reason: String): void"], X1, 40)
    cls(d, "enrol", "Enrollment", ["- status: EnrollStatus", "- waitlistPos: Integer"],
        ["+ cancel(): void", "+ offerSeat(): WaitlistOffer"], X0, bottom(d, "user", 40))
    cls(d, "offer", "WaitlistOffer", ["- expiresAt: DateTime", "- status: OfferStatus"],
        ["+ accept(): void", "+ expire(): void"], X0, bottom(d, "enrol", 40))
    cls(d, "enrstat", "EnrollStatus", ["confirmed", "waitlisted", "cancelled"], [], X0, bottom(d, "offer", 40),
        kind="enum")
    cls(d, "att", "Attendance",
        ["- kind: AttendanceKind", "- result: AttendanceResult", "- at: DateTime", "- method: String",
         "- flagged: Boolean", "- reason: String"],
        ["+ correct(result, reason): void"], X0, bottom(d, "enrstat", 40))
    cls(d, "attres", "AttendanceResult", ["present", "late", "absent", "excused"], [], X0, bottom(d, "att", 50),
        kind="enum")
    cls(d, "csession", "ClassSession",
        ["- startAt: DateTime", "- endAt: DateTime", "- status: SessionStatus", "- originalStartAt: DateTime",
         "- changeReason: String"],
        ["+ cancel(reason: String): void", "+ reschedule(newStart): void"], X1, bottom(d, "tclass", 60))
    cls(d, "court", "Court", ["- courtCode: String", "- sport: SportKind", "- status: CourtStatus"], [], X1,
        bottom(d, "csession", 60))
    cls(d, "clsstat", "ClassStatus", ["draft", "open", "closed", "cancelled"], [], X1, bottom(d, "court", 60),
        kind="enum")

    t_bot = bottom(d, "tclass")
    link(d, "user", "tclass", "1", "0..*", ("R", 70), ("L", 70), name="teaches", name_off=(0, 14), flip_b=False)
    link(d, "user", "enrol", "1", "0..*", ("B", XM0), ("T", XM0))
    ey = top(d, "enrol", 25)
    link(d, "enrol", "tclass", "0..*", "1", ("R", ey), ("L", ey))
    link(d, "enrol", "offer", "1", "0..*", ("B", XM0), ("T", XM0))
    link(d, "enrol", "enrstat", "", "", ("R", bottom(d, "enrol") - 15), ("R", top(d, "enrstat", 30)), style=USES,
         points=[(LANE - 25, bottom(d, "enrol") - 15), (LANE - 25, top(d, "enrstat", 30))])
    link(d, "tclass", "csession", "1", "1..*", ("B", XM1), ("T", XM1), style=COMPOSE)
    link(d, "csession", "court", "0..*", "1", ("B", XM1), ("T", XM1))
    link(d, "tclass", "court", "0..*", "1", ("R", t_bot - 28), ("R", top(d, "court", 30)),
         points=[(RIGHT, t_bot - 28), (RIGHT, top(d, "court", 30))], flip_a=True)
    link(d, "tclass", "clsstat", "", "", ("R", t_bot - 48), ("R", top(d, "clsstat", 30)), style=USES,
         points=[(RIGHT2, t_bot - 48), (RIGHT2, top(d, "clsstat", 30))])
    link(d, "user", "att", "1", "0..*", ("L", 130), ("L", top(d, "att", 30)),
         points=[(LEFT, 130), (LEFT, top(d, "att", 30))], flip_a=True)
    ay, cy = top(d, "att", 20), top(d, "csession", 100)
    link(d, "att", "csession", "0..*", "0..1", ("R", ay), ("L", cy), points=[(LANE + 15, ay), (LANE + 15, cy)],
         name="records", name_x=0, name_off=(-36, 0))
    link(d, "att", "attres", "", "", ("B", XM0), ("T", XM0), style=USES)
    return d


# ---------------------------------------------------------------- 3.3 coaching and training


def coaching_roles():
    """Coach and Member specialise User; the users.role column is the discriminator."""
    d = Diagram("22-cd-coaching", w=760, h=1100)
    cls(d, "user", "User", USER_BRIEF, ["+ signIn(phone, password): Session"], X0, 40)
    cls(d, "coach", "Coach", ["- sports: SportKind[1..*]"],
        ["+ mySchedule(): ClassSession[*]", "+ markAttendance(session): void", "+ recordResult(session): void",
         "+ assignHomework(target): Homework", "+ writeNote(member, body): void", "+ reviewProgress(member): void",
         "+ assessLevel(member, sport): void", "+ draftPlan(scope): TrainingPlan"], X0, bottom(d, "user", 60))
    cls(d, "note", "CoachNote", ["- body: String", "- createdAt: DateTime"], [], X1, top(d, "coach", 10))
    cls(d, "review", "ProgressReview",
        ["- sport: SportKind", "- periodWeeks: Integer", "- technique: Integer", "- fitness: Integer",
         "- attitude: Integer", "- comment: String", "- createdAt: DateTime"],
        ["+ average(): Decimal"], X0, bottom(d, "coach", 60))
    cls(d, "member", "Member",
        ["- dateOfBirth: Date", "- guardianName: String", "- guardianPhone: String", "- healthNotes: String",
         "- goal: TrainingGoal"],
        ["+ isMinor(): Boolean", "+ myPlan(): TrainingPlan", "+ tickHomework(item): void",
         "+ reviews(sport): ProgressReview[*]"], X1, top(d, "review"))
    cls(d, "level", "MemberLevel", ["- sport: SportKind", "- level: SkillLevel", "- updatedAt: DateTime"],
        ["+ assess(level, by: User): void"], X1, bottom(d, "member", 60))
    cls(d, "skill", "SkillLevel", ["beginner", "intermediate", "advanced"], [], X1, bottom(d, "level", 60),
        kind="enum")
    cls(d, "result", "SessionResult",
        ["- planPct: Integer", "- metrics: JSON", "- note: String", "- recordedAt: DateTime"],
        ["+ amend(planPct, note): void"], X0, bottom(d, "review", 60))
    cls(d, "csession", "ClassSession", ["- startAt: DateTime", "- endAt: DateTime", "- status: SessionStatus"], [],
        X0, bottom(d, "result", 60))

    m_top, m_bot = top(d, "member"), bottom(d, "member")
    link(d, "coach", "user", "", "", ("T", XM0), ("B", XM0), style=GENERAL)
    link(d, "member", "user", "", "", ("R", m_top + 30), ("R", 80), style=GENERAL,
         points=[(RIGHT, m_top + 30), (RIGHT, 80)])
    ny = top(d, "note", 25)
    link(d, "coach", "note", "1", "0..*", ("R", ny), ("L", ny))
    link(d, "note", "member", "0..*", "1", ("B", XM1), ("T", XM1))
    link(d, "coach", "review", "1", "0..*", ("B", XM0), ("T", XM0))
    link(d, "review", "member", "0..*", "1", ("R", m_top + 60), ("L", m_top + 60))
    link(d, "member", "level", "1", "0..*", ("B", XM1), ("T", XM1))
    link(d, "level", "skill", "", "", ("B", XM1), ("T", XM1), style=USES)
    link(d, "member", "result", "1", "0..*", ("L", m_bot - 15), ("R", top(d, "result", 30)),
         points=[(LANE, m_bot - 15), (LANE, top(d, "result", 30))], flip_b=True)
    link(d, "result", "csession", "0..*", "1", ("B", XM0), ("T", XM0))
    return d


def coaching_training():
    d = Diagram("42-cd-coaching-2", w=760, h=1000)
    cls(d, "rate", "CoachRate", ["- perSessionVnd: Integer", "- perStudentVnd: Integer", "- updatedAt: DateTime"],
        ["+ payFor(month: String): Integer"], X0, 40)
    cls(d, "payout", "CoachPayout",
        ["- period: String", "- sessions: Integer", "- students: Integer", "- amountVnd: Integer",
         "- status: PayoutStatus", "- closedAt: DateTime", "- paidAt: DateTime"],
        ["+ markPaid(): void"], X1, 40)
    y = max(bottom(d, "rate"), bottom(d, "payout")) + 60
    cls(d, "coach", "Coach", ["- sports: SportKind[1..*]"], [], X0, y)
    cls(d, "hw", "Homework",
        ["- title: String", "- body: String", "- checklist: String[*]", "- dueOn: Date", "- createdAt: DateTime"],
        ["+ assignTo(target): void"], X1, y)
    cls(d, "tplan", "TrainingPlan",
        ["- scope: PlanScope", "- source: PlanSource", "- title: String", "- version: Integer",
         "- published: Boolean", "- isTemplate: Boolean", "- payload: JSON"],
        ["+ publish(): void", "+ saveVersion(by: User): void", "+ copyAsTemplate(): TrainingPlan"], X0,
        bottom(d, "coach", 60))
    cls(d, "tpver", "TrainingPlanVersion",
        ["- version: Integer", "- title: String", "- payload: JSON", "- createdAt: DateTime"],
        ["+ restore(): void"], X0, bottom(d, "tplan", 60))
    cls(d, "tclass", "TrainingClass",
        ["- sport: SportKind", "- level: String", "- capacity: Integer", "- status: ClassStatus"], [], X1,
        bottom(d, "hw", 60))
    cls(d, "hwr", "HomeworkRecipient", ["- doneItems: Integer[*]", "- completedAt: DateTime"],
        ["+ tick(item: Integer): void", "+ isComplete(): Boolean"], X1, bottom(d, "tclass", 60))
    cls(d, "member", "Member",
        ["- dateOfBirth: Date", "- guardianName: String", "- guardianPhone: String", "- healthNotes: String",
         "- goal: TrainingGoal"], [], X1, bottom(d, "hwr", 60))

    c_top = top(d, "coach")
    link(d, "coach", "rate", "1", "0..1", ("T", XM0), ("B", XM0))
    link(d, "coach", "payout", "1", "0..*", ("R", c_top + 10), ("L", bottom(d, "payout") - 38),
         points=[(LANE, c_top + 10), (LANE, bottom(d, "payout") - 38)], flip_b=True)
    link(d, "coach", "hw", "1", "0..*", ("R", c_top + 40), ("L", c_top + 40))
    link(d, "coach", "tplan", "1", "0..*", ("B", XM0), ("T", XM0))
    link(d, "tplan", "tpver", "1", "1..*", ("B", XM0), ("T", XM0), style=COMPOSE)
    link(d, "hw", "tclass", "0..*", "0..1", ("B", XM1), ("T", XM1))
    py = top(d, "tclass", 40)
    link(d, "tplan", "tclass", "0..*", "0..1", ("R", py), ("L", py), name="is planned for", name_off=(0, 14), flip_b=False)
    link(d, "hw", "hwr", "1", "1..*", ("R", top(d, "hw", 40)), ("R", top(d, "hwr", 40)), style=COMPOSE,
         points=[(RIGHT, top(d, "hw", 40)), (RIGHT, top(d, "hwr", 40))], flip_b=True)
    link(d, "hwr", "member", "0..*", "1", ("B", XM1), ("T", XM1))
    return d


# ---------------------------------------------------------------- 3.4 centre operations

W3 = 230
C3 = [30, 330, 630]
XM3 = [x + W3 / 2 for x in C3]


def operations_accounts():
    d = Diagram("23-cd-operations", w=900, h=700)
    cls(d, "otp", "OtpChallenge",
        ["- phone: String", "- purpose: String", "- otpHash: String", "- expiresAt: DateTime", "- attempts: Integer"],
        ["+ verify(code: String): Boolean"], C3[0], 40, w=W3)
    cls(d, "token", "CheckinToken", ["- jti: UUID", "- usedAt: DateTime"], ["+ consume(): void"], C3[1], 40, w=W3)
    cls(d, "notify", "Notification",
        ["- channel: String", "- template: String", "- payload: JSON", "- dedupeKey: String",
         "- attempts: Integer", "- sentAt: DateTime", "- readAt: DateTime"],
        ["+ send(): void", "+ markRead(): void"], C3[2], 40, w=W3)
    cls(d, "user", "User",
        ["- memberCode: String", "- fullName: String", "- phone: String", "- role: UserRole",
         "- status: UserStatus"],
        ["+ loyaltyPoints(): Integer", "+ issueGateToken(): CheckinToken", "+ isAtRisk(): Boolean"],
        C3[1], bottom(d, "token", 60), w=W3)
    u_top, u_bot = top(d, "user"), bottom(d, "user")
    cls(d, "loyal", "LoyaltyAdjustment",
        ["- points: Integer", "- reason: AdjustReason", "- note: String", "- createdAt: DateTime"],
        ["+ apply(): void"], C3[0], u_top + 20, w=W3)
    cls(d, "ticket", "SupportTicket",
        ["- body: String", "- status: TicketStatus", "- reply: String", "- createdAt: DateTime",
         "- repliedAt: DateTime"],
        ["+ answer(text: String): void", "+ close(): void"], C3[2], bottom(d, "notify", 40), w=W3)
    cls(d, "audit", "AuditLog",
        ["- at: DateTime", "- action: String", "- entity: String", "- entityId: UUID", "- before: JSON",
         "- after: JSON"], [], C3[2], bottom(d, "ticket", 40), w=W3)
    cls(d, "contact", "ContactLog",
        ["- reason: ContactReason", "- channel: String", "- outcome: String", "- note: String",
         "- createdAt: DateTime"], [], C3[1], u_bot + 60, w=W3)

    lane = (C3[1] + W3 + C3[2]) / 2
    ny = (u_top + bottom(d, "notify")) / 2
    link(d, "user", "token", "1", "0..*", ("T", XM3[1]), ("B", XM3[1]))
    link(d, "user", "loyal", "1", "0..*", ("L", u_top + 50), ("R", u_top + 50))
    link(d, "user", "contact", "1", "0..*", ("B", XM3[1]), ("T", XM3[1]))
    link(d, "user", "notify", "0..1", "0..*", ("R", ny), ("L", ny), flip_a=False, flip_b=True)
    ty = top(d, "ticket", 40)
    link(d, "user", "ticket", "0..1", "0..*", ("R", ty), ("L", ty))
    link(d, "user", "audit", "0..1", "0..*", ("R", u_bot - 20), ("L", top(d, "audit", 40)),
         points=[(lane, u_bot - 20), (lane, top(d, "audit", 40))], flip_b=True, name="acts in",
         name_x=-0.18, name_off=(-30, 0))
    return d


def operations_centre():
    d = Diagram("43-cd-operations-2", w=760, h=1050)
    cls(d, "court", "Court", ["- courtCode: String", "- sport: SportKind", "- status: CourtStatus"],
        ["+ setStatus(status): void"], X1, 40)
    cls(d, "wo", "WorkOrder",
        ["- code: String", "- title: String", "- priority: Priority", "- status: WorkStatus",
         "- blocksCourt: Boolean", "- assignee: String", "- costVnd: Integer", "- resolution: String",
         "- closedAt: DateTime"],
        ["+ start(): void", "+ close(resolution): void"], X0, 40)
    cls(d, "booking", "CourtBooking",
        ["- code: String", "- startAt: DateTime", "- endAt: DateTime", "- status: BookingStatus"], [], X1,
        bottom(d, "court", 60))
    cls(d, "loan", "EquipmentLoan",
        ["- phone: String", "- qty: Integer", "- status: LoanStatus", "- dueAt: DateTime", "- returnedAt: DateTime"],
        ["+ markReturned(): void", "+ markLost(): void"], X1, bottom(d, "booking", 60))
    cls(d, "item", "EquipmentItem",
        ["- sku: String", "- name: String", "- sport: SportKind", "- stock: Integer", "- rentVnd: Integer"],
        ["+ lend(qty, phone): EquipmentLoan"], X1, bottom(d, "loan", 60))
    cls(d, "loanstat", "LoanStatus", ["out", "returned", "lost"], [], X0,
        max(bottom(d, "wo", 50), top(d, "loan", 20)), kind="enum")
    cls(d, "settings", "CenterSettings",
        ["- openTime: Time", "- closeTime: Time", "- slotMinutes: Integer", "- holdMinutes: Integer",
         "- bookAheadDays: Integer", "- maxSlotsPerDay: Integer", "- cancelCourtHours: Integer",
         "- refundManagerVnd: Integer", "- depositPct: Integer", "- freezeMaxDaysYear: Integer",
         "- gateDedupMinutes: Integer", "- loyaltyEarnVnd: Integer", "- dayPassVnd: Integer",
         "- vatRate: Decimal"],
        ["+ current(): CenterSettings", "+ update(patch): void"], X0, bottom(d, "loanstat", 60))
    cls(d, "flag", "FeatureFlag", ["- key: String", "- enabled: Boolean"], ["+ toggle(): void"], X1,
        bottom(d, "item", 60))

    link(d, "court", "wo", "0..1", "0..*", ("L", 80), ("R", 80))
    link(d, "court", "booking", "1", "0..*", ("B", XM1), ("T", XM1))
    link(d, "booking", "loan", "0..1", "0..*", ("B", XM1), ("T", XM1))
    link(d, "item", "loan", "1", "0..*", ("T", XM1), ("B", XM1))
    ly = top(d, "loanstat", 30)
    link(d, "loan", "loanstat", "", "", ("L", ly), ("R", ly), style=USES)
    return d


def build():
    return [booking_courts(), booking_payments(), membership_plans(), membership_classes(),
            coaching_roles(), coaching_training(), operations_accounts(), operations_centre()]
