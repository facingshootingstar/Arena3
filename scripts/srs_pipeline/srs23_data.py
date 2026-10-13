"""Hand-written inputs for SRS v2.3 that the v2.2 text does not hold in the template's shape.

Everything here restates facts already in the v2.2 SRS or in the code: which screen each use case runs
on, what each use case reads, checks and writes (the template's Data Processing block), where each
alternative flow rejoins the normal flow, the renamed messages, the table descriptions of the schema,
and the acronyms used in the body.
"""

# ---------------------------------------------------------------- screens (table 3.1.2, numbered as in v2.2)

SCREENS = [
    # n, portal, feature, name, route, description
    (1, "public", "Public", "Landing page", "/", "Centre introduction, sports, prices, open classes and coach profiles."),
    (2, "public", "Account", "Sign in", "/login", "Sign in by phone or email and password. Each role lands on its own portal."),
    (3, "public", "Account", "Create an account", "/register", "Member sign-up with consent, confirmed by a one-time code."),
    (4, "public", "Account", "Forgot password", "/forgot", "Sends a reset code and sets a new password."),
    (5, "member", "Account", "Account settings", "/account", "Personal details, password, receipts and support requests."),
    (6, "desk", "Account", "Alerts", "/alerts", "Staff alerts, such as an absence streak."),
    (7, "member", "Payment", "Payment result", "/pay/return",
     "Return page after payOS. Asks Arena3 to verify the payment, then shows the outcome."),
    (8, "member", "Member", "My schedule", "/app", "Upcoming bookings and classes, plan balance and waitlist offers."),
    (9, "member", "Booking", "Book a court", "/app/book", "Pick a date and sport, tap a free slot, hold it for 5 minutes and pay."),
    (10, "member", "Classes", "Classes", "/app/classes", "Enrol by sport. A full class offers a first-come waitlist."),
    (11, "member", "Training", "My progress", "/app/train", "Attendance, results, reviews, training plans and homework."),
    (12, "member", "Plans", "Membership plans", "/app/plans", "Order a plan here and pay at the desk."),
    (13, "member", "Loyalty", "My points", "/app/points", "Points balance and history."),
    (14, "member", "Gate", "Gate pass", "/app/pass", "QR pass whose code changes every minute."),
    (15, "member", "Assistant", "AI assistant", "/app/assistant", "Gemini answers grounded in the timetable, plans and coaches."),
    (16, "member", "Notifications", "Notifications", "/app/notifications", "In-app notices for the member."),
    (17, "desk", "Desk", "Front desk", "/desk", "Find a member, sell a plan, take a payment, open and close the shift."),
    (18, "desk", "Desk", "Member profile", "/desk/member/$id",
     "Plans, bookings and payments. Edit, refund, reset password, take a payOS payment."),
    (19, "desk", "Gate", "Gate", "/desk/gate", "Scan a member's QR pass, or look the member up by phone."),
    (20, "desk", "Courts", "Court map", "/desk/courts", "Live court grid. Sells a walk-in slot."),
    (21, "desk", "Classes", "Classes (desk)", "/desk/classes", "Every class with its sessions, court, coach and roster."),
    (22, "desk", "Payments", "Payments", "/desk/payments",
     "Plans awaiting payment, transfers to reconcile, refunds awaiting a manager, receipts."),
    (23, "desk", "Day passes", "Day passes", "/desk/day-passes", "Sell, mark as used or void a day pass."),
    (24, "desk", "Bookings", "Fixed bookings", "/desk/series", "Fixed weekly bookings over 4–12 weeks at 10% off."),
    (25, "desk", "Care", "At risk", "/desk/at-risk", "Members whose attendance has dropped, with a contact log."),
    (26, "desk", "Gear", "Gear", "/desk/gear", "Lend and take back equipment against stock."),
    (27, "desk", "Maintenance", "Maintenance", "/desk/maintenance", "Work orders. An open order can block a court."),
    (28, "coach", "Coach", "Schedule", "/coach", "The coach's own sessions by day, with court, class code and enrolment."),
    (29, "coach", "Coach", "Attendance", "/coach/attendance", "Session register: Present, Late, Absent or Excused, plus results."),
    (30, "coach", "Coach", "Student progress", "/coach/student/$id", "Goal, level, attendance totals, reviews, notes and homework."),
    (31, "coach", "Coach", "Classes (coach)", "/coach/classes", "Classes the coach leads or assists, with plans and homework."),
    (32, "coach", "Coach", "My earnings", "/coach/earnings", "Fee per class plus a fee per student present, by month."),
    (33, "manager", "Reports", "Reports", "/manager",
     "Revenue by day, method, source and shift; capacity and members reports; export."),
    (34, "manager", "Classes", "Classes (manager)", "/manager/classes", "Create, publish, edit and cancel classes. Clashes are blocked."),
    (35, "manager", "Members", "Members", "/manager/members", "Every member with filters, plan and class count."),
    (36, "manager", "Plans", "Membership plans", "/manager/plans", "Create, edit and withdraw plans. A plan is never deleted."),
    (37, "manager", "Promotions", "Promo codes", "/manager/promos", "Create codes and read their redemption history."),
    (38, "manager", "Attendance", "Attendance report", "/manager/attendance", "Attendance across classes, sessions and members."),
    (39, "manager", "Staff", "Staff", "/manager/staff", "Issue, lock and re-role staff accounts; reset passwords."),
    (40, "manager", "Pricing", "Pricing", "/manager/prices",
     "Price rules by sport, court, day type and hour band. A new price applies only to new sales."),
    (41, "manager", "Commission", "Coach commission", "/manager/commission", "Close a month's coach commission and mark it paid."),
    (42, "manager", "Invoices", "E-invoice export", "/manager/invoices", "Export invoices as a spreadsheet or XML."),
    (43, "manager", "Audit", "Audit log", "/manager/audit", "Audit entries filtered by actor, action, entity and date."),
    (44, "manager", "Settings", "Centre settings", "/manager/settings",
     "Opening hours, slot length, windows, limits, VAT, rounding and feature flags."),
]

PORTALS = [
    ("public", "Public Site"), ("member", "Member Portal"), ("desk", "Front Desk Portal"),
    ("coach", "Coach Portal"), ("manager", "Manager Portal"),
]

# Who may open each screen (v2.2 table III.1.3, per portal).
ALL = ("Guest", "Member", "Receptionist", "Coach", "Manager")
SCREEN_ROLES = {}
for _n, _portal, *_ in SCREENS:
    SCREEN_ROLES[_n] = {
        "public": ALL, "member": ("Member",), "desk": ("Receptionist", "Manager"),
        "coach": ("Coach", "Manager"), "manager": ("Manager",),
    }[_portal]
SCREEN_ROLES.update({5: ("Member", "Receptionist", "Coach", "Manager"), 6: ("Receptionist", "Coach", "Manager"),
                     7: ALL})

# The screens each use case runs on; the first one is its Interface and its Screen Layout.
UC_SCREENS = {
    1: [1], 2: [3], 3: [2], 4: [4], 5: [5], 6: [16, 6], 7: [8], 8: [9, 7], 9: [8], 10: [12], 11: [13],
    12: [14], 13: [10, 21], 14: [10, 16], 15: [8], 16: [11], 17: [15], 18: [22], 19: [18, 17, 25], 20: [18],
    21: [20, 24], 22: [22], 23: [23], 24: [18], 25: [20], 26: [19], 27: [26], 28: [27], 29: [17],
    30: [28, 31], 31: [29], 32: [31], 33: [31], 34: [30], 35: [32], 36: [39, 35], 37: [36, 40], 38: [37],
    39: [34], 40: [44], 41: [33, 38, 42], 42: [22], 43: [41], 44: [43],
}

# Roles allowed to perform each use case on its screens. The API allows receptionist and manager on the
# desk endpoints and coach and manager on the coach endpoints, except the cashier shift (receptionist only)
# and the earnings page (coach only); see src/lib/arena3/handlers.
UC_ROLES = {
    1: ALL, 2: ("Guest",), 3: ALL, 4: ("Guest",), 5: ("Member", "Receptionist", "Coach", "Manager"),
    6: ("Member", "Receptionist", "Coach", "Manager"), 18: ("Receptionist",), 35: ("Coach",),
    42: ("Manager",),
}
for _u in range(7, 18):
    UC_ROLES.setdefault(_u, ("Member",))
UC_ROLES[13] = ("Member", "Receptionist", "Manager")
for _u in range(19, 30):
    UC_ROLES.setdefault(_u, ("Receptionist", "Manager"))
for _u in range(30, 36):
    UC_ROLES.setdefault(_u, ("Coach", "Manager"))
for _u in range(36, 45):
    UC_ROLES.setdefault(_u, ("Manager",))

# ---------------------------------------------------------------- actors after the v2.2.1 review

SECONDARY = {
    2: "Mail delivery (SMTP)", 4: "Mail delivery (SMTP)", 8: "payOS", 10: "Receptionist, who takes payment; payOS",
    13: "Receptionist or Manager, enrolling on the member's behalf", 17: "Gemini AI",
    19: "Coach (read only, own students)", 20: "payOS", 22: "payOS",
    24: "Manager, who can raise a refund directly (flow 4b)",
    25: "Member, who shows the booking QR code (flow 3b)", 26: "Member, who shows the gate pass",
    31: "Manager, who corrects closed registers",
}
# actor names only, for table 2.2.2
SECONDARY_NAMES = {
    2: ["Mail delivery (SMTP)"], 4: ["Mail delivery (SMTP)"], 8: ["payOS"], 10: ["Receptionist", "payOS"],
    13: ["Receptionist", "Manager"], 17: ["Gemini AI"], 19: ["Coach"], 20: ["payOS"], 22: ["payOS"],
    24: ["Manager"], 25: ["Member"], 26: ["Member"], 31: ["Manager"],
}

# ---------------------------------------------------------------- Data Processing (template block 3)

# uc: (Data Collect, Data Computation, kind, Data Storage or Data Binding)
DP = {
    1: ("The language chosen in the header.",
        "Selects the sports, courts, plans on sale and open classes; every price shown includes VAT (BR-38).",
        "Binding", "Reads courts, membership_plans and classes with their coaches and seats left, and shows them "
        "on the landing page."),
    2: ("Full name, phone, email, password, date of birth, terms consent and, for a minor, the guardian's name "
        "and phone; then the one-time code.",
        "Checks every field, that the phone and email are unused (BR-01), the password rule (BR-02), the guardian "
        "rule (BR-03) and consent (BR-04); hashes the code, keeps it five minutes and counts wrong attempts.",
        "Storage", "Writes the sign-up challenge to otp_challenges, then the member to users, a session to "
        "sessions_auth and an audit row to audit_logs. The code is sent through Mail delivery (SMTP)."),
    3: ("Phone or email and password; the Sign out action.",
        "Compares the password with its salted hash, counts failed sign-ins and locks sign-in for 15 minutes after "
        "five; sets the session length by role.",
        "Storage", "Writes a hashed session token to sessions_auth at sign-in and revokes it at sign-out; updates the "
        "failed sign-in count and lock time in users."),
    4: ("The account's phone number, the one-time code and the new password entered twice.",
        "Answers the same way whether or not the phone has an account; checks the code, its five-minute life and "
        "the attempts, then the password rule (BR-02).",
        "Storage", "Writes the challenge to otp_challenges, the new password hash to users, revokes the other rows "
        "in sessions_auth and writes audit_logs. The code is sent through Mail delivery (SMTP)."),
    5: ("Name, phone, email, date of birth and language; for a password change, the current and the new password.",
        "Checks the fields, that the phone and email are unused (BR-01) and the password rule (BR-02); refuses "
        "reuse of the current password.",
        "Storage", "Updates the registered user's row in users and writes audit_logs."),
    6: ("The notice opened, or Mark all as read.",
        "Orders the notices newest first and counts the unread ones for the badge.",
        "Storage", "Sets the read time on the registered user's rows in outbox."),
    7: ("None; the screen opens for the signed-in member.",
        "Keeps upcoming items only and flags a plan that ends within seven days (BR-12).",
        "Binding", "Reads the member's court_bookings, enrollments with their sessions, subscriptions and "
        "attendance, and shows them in time order on My schedule."),
    8: ("Sport, date and slot; an optional promo code; the payment method: payOS QR, bank transfer or plan hours.",
        "Checks the booking window, opening hours, court status, daily cap and class clash (BR-05 to BR-10); "
        "prices the slot from price_rules (BR-37); applies the promo code (BR-40, BR-41, BR-42); rounds once "
        "(BR-39); verifies the payOS signature and the amount paid.",
        "Storage", "Writes the hold to court_bookings and occupancies, the payment to payments, the receipt to "
        "invoices and the code use to promotion_redemptions; deducts plan hours from subscriptions when paid by "
        "quota."),
    9: ("The booking, then the new slot or the Cancel choice.",
        "Checks the new slot against the booking rules (BR-05, BR-06, BR-07, BR-09) and the price paid; quotes "
        "the refund by notice: 100%, 50% or 0%.",
        "Storage", "Moves the booking in court_bookings and occupancies, or cancels it, frees the slot, writes the "
        "refund as a negative row in payments and returns plan hours to subscriptions."),
    10: ("The plan chosen and an optional promo code.",
         "Checks the plan is on sale (BR-16), the current plan is not frozen (BR-14), the promo code (BR-40) and "
         "the order rate limit.",
         "Storage", "Writes a pending row to subscriptions; once the desk takes payment, the payment goes to "
         "payments and the receipt to invoices."),
    11: ("The number of points to redeem, or the receipt opened.",
         "Totals the points, checks the minimum of 50 points and the balance, and values each point at 100đ "
         "(BR-40, BR-41 then apply to the code).",
         "Storage", "Writes the points spent to loyalty_adjustments and a single-use code to promotions; a "
         "receipt is read from payments and invoices."),
    12: ("The member's request for a pass; with self check-in, the desk code scanned.",
         "Signs a short-lived token for the member and, with self check-in, checks the desk code (BR-30); spends "
         "no session (BR-32).",
         "Storage", "Writes the token to checkin_tokens and, with self check-in, the visit to attendance."),
    13: ("The class chosen.",
         "Checks the class is open (BR-18), a plan covers the sport and has sessions left (BR-12, BR-19, BR-20), "
         "the capacity (BR-21) and clashes (BR-22).",
         "Storage", "Writes a confirmed or waitlisted row to enrollments, raises the class's enrolled count in "
         "classes and uses a session from subscriptions."),
    14: ("The Accept choice on the offer.",
         "Checks the offer has not expired (BR-23), a seat is free (BR-21) and the plan covers the sport (BR-19).",
         "Storage", "Closes the offer in waitlist_offers and confirms the enrolment in enrollments."),
    15: ("The class to leave.",
         "Checks the next session starts at least 4 hours later (BR-24) and finds the first waitlisted member.",
         "Storage", "Cancels the row in enrollments, lowers the enrolled count in classes, writes an offer to "
         "waitlist_offers and queues a notice in outbox."),
    16: ("Ticked homework items and the personal goal.",
         "Checks the training module is on (BR-52); homework past its due date stays open; nothing here takes "
         "money or changes a plan balance (BR-47).",
         "Storage", "Writes homework progress to homework_recipients and the goal to training_profiles."),
    17: ("A question of up to 800 characters, or a support request.",
         "Builds the prompt from centre facts only, without health notes (BR-46); allows 20 questions a minute; "
         "falls back to rule-based answers when the model is unavailable.",
         "Storage", "Writes an audit row for each question to audit_logs, or the support request to tickets."),
    18: ("The opening float; at close, the cash counted.",
         "Allows one open shift per receptionist and works out the expected cash and the difference; desk "
         "payments need the open shift (BR-44).",
         "Storage", "Writes the shift to cashier_shifts; each desk payment in payments carries the shift."),
    19: ("Search text; for a new member, details, terms consent and guardian details; a follow-up contact.",
         "Checks that the phone and email are unused (BR-01), the guardian rule (BR-03) and consent (BR-04); lists "
         "members at risk by idle days or three absences in a row (BR-36); shows health notes only to those who "
         "need them (BR-46).",
         "Storage", "Writes the member to users, a follow-up to contact_log and an audit row to audit_logs."),
    20: ("The plan or the member's pending order, a promo code, the payment method, or the freeze days.",
         "Prices the plan, applies the promo code (BR-40) and rounds once (BR-39); checks the plan is on sale "
         "(BR-16), the freeze rules (BR-14, BR-15), the plan dates (BR-12) and the open shift (BR-44).",
         "Storage", "Writes subscriptions, payments, invoices and invoice_lines, and an audit row to audit_logs."),
    21: ("The slot, the customer's name and phone; for a series, the court, weekday, time and number of weeks.",
         "Checks the slot (BR-05 to BR-08), prices it from the price rules (BR-37), with 10% off for a series, and "
         "checks the open shift (BR-44).",
         "Storage", "Writes court_bookings and occupancies, booking_series for a series, and payments and "
         "invoices."),
    22: ("The pending item, the amount and the method; Confirm or Reject for a transfer.",
         "Checks the booking state and the balance left, rounds once (BR-39) and checks the open shift (BR-44).",
         "Storage", "Writes payments and invoices and confirms the court_bookings or subscriptions row, or releases "
         "the slot and queues a notice in outbox."),
    23: ("The customer's name or a member's phone, the day and the payment method; Use or Void on the day.",
         "Prices the pass at the day-pass setting, checks the day is not past and checks the open shift (BR-44).",
         "Storage", "Writes day_passes, payments and invoices; a void writes a negative row to payments."),
    24: ("The payment, the refund amount and the reason.",
         "Works out what is still refundable, compares the amount with the refund limit (1,000,000đ) and checks "
         "the open shift for a cash refund (BR-44).",
         "Storage", "Writes a negative row to payments, posted or pending approval; restores a promo code in "
         "promotion_redemptions after a full refund; writes audit_logs (BR-53)."),
    25: ("The booking selected, or its QR code.",
         "Checks the booking is confirmed and the time is inside the check-in window (BR-11).",
         "Storage", "Sets the booking's status in court_bookings to in use."),
    26: ("The scanned member code or the member looked up, and an override reason when needed.",
         "Checks the code (BR-30), today's entitlement and the repeat-scan window (BR-31); spends no session "
         "(BR-32) and fills no register (BR-33).",
         "Storage", "Marks the token used in checkin_tokens, writes the visit to attendance and audits an override "
         "in audit_logs."),
    27: ("The gear item, quantity, member or guest phone and payment method; Return later.",
         "Checks the stock (BR-50) and the open shift (BR-44); charges rent × quantity with an e-invoice (BR-51).",
         "Storage", "Lowers the stock in equipment_items and writes equipment_loans, payments and invoices; a "
         "return closes the loan and restores the stock."),
    28: ("Title, court or area and priority; later the status and the cost.",
         "Checks the title, the priority and a cost that is not negative; a blocking order takes the court out of "
         "use (BR-08).",
         "Storage", "Writes work_orders, sets the court's status in courts to maintenance when needed, and writes "
         "audit_logs (BR-53)."),
    29: ("The reply text, or Close without a reply.",
         "Lists open requests oldest first and checks the reply is not empty.",
         "Storage", "Writes the reply and the status to tickets, queues a notice in outbox and writes audit_logs "
         "(BR-53)."),
    30: ("The week and the class opened.",
         "Limits the classes to those the coach leads or assists (BR-45) and health notes to those who need them "
         "(BR-46).",
         "Binding", "Reads sessions, classes, enrollments, member_levels and attendance, and shows the schedule and "
         "the rosters."),
    31: ("The session and each student's mark; a reason for a manager's correction.",
         "Checks the coach leads or assists the class (BR-45), the lock 2 hours after the session (BR-35), the "
         "marks a coach may set (BR-33, BR-34) and absence streaks (BR-36).",
         "Storage", "Writes attendance, queues streak alerts in outbox and audits a correction in audit_logs."),
    32: ("Plan blocks with title, type, intensity, minutes and description; a template or a suggestion.",
         "Checks the module is on (BR-52), the coach's class (BR-45), 1 to 12 valid blocks (BR-49) and that the "
         "session has no results (BR-48); a suggestion comes from a built-in drill list for the sport and level. "
         "Nothing here takes money (BR-47).",
         "Storage", "Writes training_plans and a new row in training_plan_versions."),
    33: ("Each student's score and note; the homework title, checklist and due date.",
         "Checks the coach's class (BR-45), the homework limits and that the session plan is no longer edited "
         "(BR-48); records never take money (BR-47).",
         "Storage", "Writes session_results, homework and homework_recipients, and queues notices in outbox."),
    34: ("The review period and scores, a level, or a private note.",
         "Checks the student is in the coach's classes (BR-45), scores from 1 to 5 and a 2- or 4-week period; "
         "shows health notes only in scope (BR-46).",
         "Storage", "Writes progress_reviews, member_levels and coach_notes."),
    35: ("The month chosen.",
         "Counts the sessions taught and the students present, and applies the coach's rates.",
         "Binding", "Reads coach_rates, coach_payouts, sessions and attendance, and shows the month's earnings."),
    36: ("Name, phone, email, role and, for a coach, the sports; lock, reset and sign-out actions; member filters.",
         "Checks that the phone and email are unused (BR-01) and a coach's sports (BR-25), and refuses changes to "
         "the manager's own account.",
         "Storage", "Writes users and coach_sports, revokes rows in sessions_auth and writes audit_logs (BR-53)."),
    37: ("Plan fields; price rules by sport, court, weekday and hour band.",
         "Checks the discount is a whole percentage (BR-17), the plan is on sale or withdrawn (BR-16) and each "
         "rule has a price and no overlap (BR-37); prices include VAT (BR-38).",
         "Storage", "Writes membership_plans and price_rules, and writes audit_logs (BR-53)."),
    38: ("Code, kind and value, scope, dates and limits; pause or resume.",
         "Checks the code length and the value ranges, the scope and limits applied at checkout (BR-40, BR-41, "
         "BR-42), and that a used code keeps its code (BR-43).",
         "Storage", "Writes promotions and audit_logs; the use counts come from promotion_redemptions."),
    39: ("Sport, coach, court, weekdays, time, length, capacity and dates; later moves, cancellations, "
         "substitutes and capacity.",
         "Checks the coach (BR-25), the court and coach times (BR-26, BR-08), the capacity (BR-21), late moves "
         "(BR-27), substitutes (BR-28) and sessions given back (BR-29).",
         "Storage", "Writes classes, sessions, occupancies and coach_occupancies, and queues notices in outbox."),
    40: ("Setting values and module switches.",
         "Checks each value's range; a module switched off answers 403 with BR-52.",
         "Storage", "Writes center_settings and feature_flags, and writes audit_logs (BR-53)."),
    41: ("The report, the date range and the export format.",
         "Builds each report from the same queries as the screens; prices include VAT (BR-38) and attendance "
         "follows the locked registers (BR-35).",
         "Binding", "Reads payments, court_bookings, subscriptions, attendance and invoices; an export is built on "
         "request and not stored."),
    42: ("Approve, or Reject with a reason.",
         "Refuses the person who raised the refund, and a refund that was already decided.",
         "Storage", "Posts or closes the refund in payments, queues a notice in outbox and writes audit_logs "
         "(BR-53)."),
    43: ("The month, coach rates, Close month and Mark paid.",
         "Counts each coach's sessions and students and applies the rates; a month closes only after it ends.",
         "Storage", "Writes coach_rates, one row per coach to coach_payouts and audit_logs (BR-53)."),
    44: ("Filters by actor, action, record and date.",
         "Orders the rows newest first; no row can be changed or deleted (BR-53).",
         "Binding", "Reads audit_logs and shows the values before and after each change."),
}

# ---------------------------------------------------------------- flows

# Where an alternative flow rejoins the normal flow; "end" closes the use case. Unlisted: the next step.
ALT_RETURN = {
    (3, "4a"): 5, (5, "3a"): "end", (6, "3a"): "end", (8, "5a"): 9, (8, "5b"): "end",
    (9, "1a"): "end", (9, "1c"): "end", (10, "5a"): "end", (11, "1a"): "end", (12, "3a"): "end",
    (13, "4a"): "end", (13, "4b"): "end", (14, "2a"): "end", (17, "1a"): "end",
    (19, "1a"): 3, (19, "1b"): "end", (19, "5a"): "end", (20, "1b"): "end", (20, "1c"): "end",
    (21, "1a"): "end", (22, "2a"): "end", (22, "2b"): "end", (22, "2c"): "end", (23, "5a"): "end",
    (24, "4a"): "end", (25, "3a"): 3, (25, "3b"): 3, (26, "2a"): 4, (26, "5a"): "end", (26, "5c"): "end",
    (29, "2a"): "end", (31, "1a"): 3, (31, "4a"): "end", (32, "3a"): "end", (36, "1a"): "end",
    (36, "1b"): "end", (38, "3a"): "end", (39, "3a"): "end", (39, "3b"): "end", (39, "3c"): "end",
    (39, "3d"): "end", (41, "1a"): "end", (42, "3a"): "end",
}
# Alternatives written as two lines that are one branch.
ALT_MERGE = {(9, "1a"): ["1b"], (26, "5a"): ["5b"]}
# Exceptions after which the actor tries again; unlisted ones end the use case.
EXC_RETURN = {
    (2, "3a"): 1, (2, "3b"): 1, (2, "3c"): 1, (2, "3d"): 2, (2, "6a"): 5, (2, "6b"): 2, (4, "4a"): 3,
    (4, "4c"): 3, (5, "3b"): 3, (5, "3c"): 3, (5, "4a"): 3, (8, "8a"): 1, (19, "5b"): 5, (19, "5c"): 5,
    (21, "2a"): 2, (26, "3a"): 2, (32, "3b"): 2, (33, "4a"): 4, (34, "3c"): 3, (36, "2a"): 2, (36, "2b"): 2,
    (37, "2b"): 1, (37, "4a"): 3, (38, "2a"): 1, (39, "2a"): 1, (39, "2b"): 1, (40, "4a"): 3, (41, "2a"): 1,
}
# Short titles where the condition text is too long to head a branch.
TITLES = {
    (8, "2b"): "The slot is in the past, too far ahead or outside opening hours",
    (8, "2c"): "The court is not ready, or the member already holds two slots that day",
    (8, "4a"): "The promo code cannot be used",
    (8, "5d"): "Online payment is switched off or cannot start",
    (19, "1b"): "Follow up a member at risk",
    (21, "1a"): "Book a fixed weekly series",
    (26, "2a"): "The code cannot be scanned",
    (9, "1a"): "Cancel the booking",
    (26, "5a"): "The member is not entitled today",
    (20, "1e"): "The plan cannot be frozen",
    (32, "3c"): "The session already has results",
    # alternatives written as one sentence
    (29, "1a"): "Show all requests", (32, "2a"): "Start from a saved template",
    (32, "3a"): "Save as a template or copy a week", (34, "3a"): "Change the student's level",
    (34, "3b"): "Add a private note", (36, "1a"): "Lock, unlock, reset or sign out an account",
    (36, "1b"): "Search the member directory", (37, "2a"): "Withdraw a plan", (38, "3a"): "Pause or resume a code",
    (39, "3a"): "Move a session", (39, "3b"): "Cancel a session", (39, "3c"): "Hand the class to a substitute coach",
    (39, "3d"): "Change the capacity", (41, "1a"): "Export the e-invoices", (43, "1a"): "Change a coach's rate",
    (24, "4b"): "A manager raises the refund", (31, "4a"): "A student reaches three absences in a row",
}

# ---------------------------------------------------------------- messages (5.3)

# new id, old id, text, type, context
MESSAGES = [
    ("ERR_AUTH_01", "MSG01", "That phone or email already has an account.", "Error",
     "Create an account (submit)", "BR-01"),
    ("ERR_AUTH_02", "MSG02", "Password needs at least 8 characters, with letters and numbers.", "Validation",
     "Create an account (submit)", "BR-02"),
    ("ERR_AUTH_03", "MSG03", "Too many OTP attempts — locked for 15 minutes.", "Error",
     "Create an account (verify the code)", None),
    ("ERR_AUTH_04", "MSG04", "5 wrong passwords — locked for 15 minutes.", "Error", "Sign in (sign in)", None),
    ("ERR_AUTH_05", "MSG19", "You do not have permission.", "Error", "Any screen (an action outside the role)", None),
    ("ERR_AUTH_06", "MSG20", "Too many attempts — try again later.", "Error", "AI assistant (send a question)", None),
    ("ERR_BOOK_01", "MSG05", "You can book at most 7 days ahead.", "Error", "Book a court (hold a slot)", "BR-05"),
    ("WARN_BOOK_01", "MSG06", "This slot clashes with a class you are in. Confirm to hold it anyway.", "Warning",
     "Book a court (hold a slot)", "BR-09"),
    ("ERR_BOOK_02", "MSG07", "Someone just took that slot.", "Error", "Book a court (hold a slot)", None),
    ("ERR_BOOK_03", "MSG08", "Your hold has expired.", "Error", "Book a court (pay)", None),
    ("ERR_BOOK_04", "MSG09", "There is no price for that slot yet — ask the desk.", "Error",
     "Book a court (hold a slot)", "BR-37"),
    ("ERR_PAY_01", "MSG10", "That code has expired.", "Error", "Book a court (apply a promo code)", "BR-40"),
    ("ERR_PAY_02", "MSG13", "Open a till shift before taking payment.", "Error", "Member profile (take a payment)",
     "BR-44"),
    ("ERR_PAY_03", "MSG15", "This payment has already been refunded in full.", "Validation",
     "Member profile (raise a refund)", None),
    ("ERR_PAY_04", "MSG16", "You raised this refund, so someone else has to sign it off.", "Error",
     "Payments (approve a refund)", None),
    ("ERR_PAY_05", "MSG17", "That refund is no longer waiting for a decision.", "Error",
     "Payments (approve or reject a refund)", None),
    ("ERR_CLASS_01", "MSG11", "You need an active plan covering this sport.", "Error", "Classes (enrol)", "BR-19"),
    ("ERR_CLASS_02", "MSG12", "That offer has expired.", "Error", "Classes (accept a waitlist offer)", "BR-23"),
    ("ERR_CHECKIN_01", "MSG14", "That code was already used — ask the member to refresh it.", "Error",
     "Gate (scan a pass)", "BR-30"),
    ("ERR_COACH_01", "MSG18", "This register closed 2 hours after the session. Ask a manager to correct it.",
     "Error", "Attendance (save the register)", "BR-35"),
    ("ERR_GEAR_01", "MSG21", "Only {stock} {item} left — you asked for {quantity}.", "Error", "Gear (rent out gear)",
     "BR-50"),
]
BR_MESSAGE = {br: mid for mid, _, _, _, _, br in MESSAGES if br}

# ---------------------------------------------------------------- database (II.2 and 3.1.5 Entities Description)

ENTITY_NAMES = {
    "attendance": "Attendance", "audit_logs": "AuditLog", "booking_series": "BookingSeries",
    "cashier_shifts": "CashierShift", "center_settings": "CenterSettings", "checkin_tokens": "CheckinToken",
    "classes": "TrainingClass", "coach_notes": "CoachNote", "coach_occupancies": "CoachOccupancy",
    "coach_payouts": "CoachPayout", "coach_rates": "CoachRate", "coach_sports": "CoachSport",
    "code_counters": "CodeCounter", "contact_log": "ContactLog", "court_bookings": "CourtBooking", "courts": "Court",
    "day_passes": "DayPass", "enrollments": "Enrollment", "equipment_items": "EquipmentItem",
    "equipment_loans": "EquipmentLoan", "feature_flags": "FeatureFlag", "homework": "Homework",
    "homework_recipients": "HomeworkRecipient", "idempotency_keys": "IdempotencyKey", "invoice_lines": "InvoiceLine",
    "invoices": "Invoice", "loyalty_adjustments": "LoyaltyAdjustment", "member_levels": "MemberLevel",
    "membership_plans": "MembershipPlan", "occupancies": "Occupancy", "otp_challenges": "OtpChallenge",
    "outbox": "Notification", "payments": "Payment", "price_rules": "PriceRule", "progress_reviews": "ProgressReview",
    "promotion_redemptions": "PromotionRedemption", "promotions": "Promotion", "provider_sequences": "ProviderSequence",
    "session_results": "SessionResult", "sessions": "ClassSession", "sessions_auth": "AuthSession",
    "subscriptions": "Subscription", "tickets": "SupportTicket", "training_plan_versions": "TrainingPlanVersion",
    "training_plans": "TrainingPlan", "training_profiles": "TrainingProfile", "users": "User",
    "waitlist_offers": "WaitlistOffer", "work_orders": "WorkOrder",
}

# Tables outside the 17 core entities; the core ones take their sentence from the v2.2 entity table.
TABLE_STORES = {
    "audit_logs": "every audited change with its actor, action, record and the values before and after",
    "booking_series": "fixed weekly bookings of 4 to 12 weeks for one court, weekday and time",
    "center_settings": "the centre's single row of settings: hours, limits, windows, money and loyalty values",
    "checkin_tokens": "the short-lived signed codes behind each gate pass and when each was used",
    "coach_notes": "a coach's private notes about a student",
    "coach_occupancies": "the times a coach is busy with a session, so no coach is booked twice",
    "coach_payouts": "each coach's closed monthly commission and whether it is paid",
    "coach_rates": "each coach's fee per session and per student present",
    "coach_sports": "the sports each coach is qualified to teach",
    "code_counters": "the last number used for each kind of code and year, so codes have no gaps",
    "contact_log": "follow-up contacts made with members at risk of leaving",
    "day_passes": "day passes sold for entry on one day, with their payment and use",
    "enrollments": "each member's place in a class, confirmed or on the waitlist",
    "equipment_loans": "gear lent out, with its quantity, due time and return",
    "feature_flags": "the on or off switch of each optional module",
    "homework": "homework set by a coach for a class or one student",
    "homework_recipients": "each student's progress on a homework checklist",
    "idempotency_keys": "the first response to each request sent with an Idempotency-Key, so a replay returns it",
    "invoice_lines": "the lines of each e-invoice",
    "loyalty_adjustments": "changes to a member's loyalty points, such as points redeemed for a code",
    "member_levels": "a member's skill level in each sport, set by a coach",
    "occupancies": "each court time and its single owner: a booking, a class session or a maintenance block",
    "otp_challenges": "hashed one-time codes for sign-up and password reset, with their expiry and attempts",
    "outbox": "queued and in-app notifications with their delivery attempts and read time",
    "promotion_redemptions": "each use of a promo code against a payment, and its return after a full refund",
    "provider_sequences": "the last order code sent to each payment provider",
    "session_results": "each student's result for a session",
    "sessions_auth": "hashed session tokens of signed-in users and their expiry",
    "tickets": "members' support requests and the desk's replies",
    "training_plan_versions": "each saved version of a training plan",
    "training_profiles": "each member's personal training goal",
    "waitlist_offers": "seat offers made to waitlisted members and their expiry",
}

# ---------------------------------------------------------------- front matter and section openings

ACRONYMS = {
    "AI": "Artificial Intelligence", "API": "Application Programming Interface", "BR": "Business Rule",
    "CSV": "Comma-Separated Values", "DFD": "Data Flow Diagram", "ERD": "Entity Relationship Diagram",
    "FK": "Foreign Key", "FPT": "FPT University (the issuing university)", "HTTP": "Hypertext Transfer Protocol",
    "HTTPS": "Hypertext Transfer Protocol Secure", "ID": "Identifier", "JSON": "JavaScript Object Notation",
    "NFR": "Non-Functional Requirement", "OTP": "One-Time Password", "PDF": "Portable Document Format",
    "PK": "Primary Key", "QR": "Quick Response (code)", "SDD": "Software Design Description",
    "SHA": "Secure Hash Algorithm", "SMTP": "Simple Mail Transfer Protocol", "SQL": "Structured Query Language",
    "SRS": "Software Requirement Specification", "SSR": "Server-Side Rendering", "UC": "Use Case",
    "UI": "User Interface", "UML": "Unified Modeling Language", "UUID": "Universally Unique Identifier",
    "VAT": "Value-Added Tax", "VND": "Vietnamese đồng, the currency (also written đ)",
    "XML": "Extensible Markup Language", "XLSX": "Office Open XML spreadsheet file",
    "ICT": "Indochina Time (UTC+7)", "UTC": "Coordinated Universal Time",
    "REST": "Representational State Transfer", "SMS": "Short Message Service",
}
# Upper-case words in the body that are not abbreviations: HTTP methods, part numerals, code prefixes.
NOT_ACRONYMS = {"GET", "POST", "PRE", "II", "III", "IV"}

PURPOSE = {
    "usability": "Every screen must be usable on a phone and must explain a refusal in words, in English or "
                 "Vietnamese.",
    "auditability": "Every staff change must leave a trace that names who did what and when, and the codes on "
                    "money must never skip a number.",
}
